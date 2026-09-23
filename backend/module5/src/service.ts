import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { FeedbackInput, SessionFactsPort } from './contracts.js';

type SqlRow = Record<string, unknown>;

export class GrowthService {
  constructor(private readonly db: DatabaseSync, private readonly sessionFacts: SessionFactsPort) {}

  createAnonymous(ageMode: 'adult' | 'child') {
    const userId = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare('INSERT INTO user_profile(user_id, age_mode, created_at, updated_at) VALUES(?,?,?,?)').run(userId, ageMode, now, now);
    this.db.prepare('INSERT INTO preference_profile(profile_id, user_id, voice_preference, updated_at) VALUES(?,?,?,?)').run(randomUUID(), userId, 'unspecified', now);
    return { user_id: userId, age_mode: ageMode, pin_configured: false, created_at: now };
  }

  hasUser(userId: string): boolean {
    return Boolean(this.db.prepare('SELECT 1 FROM user_profile WHERE user_id = ?').get(userId));
  }

  async pendingFeedback(userId: string) {
    const fact = await this.sessionFacts.latestCompleted(userId);
    if (!fact) return { pending: false, session: null };
    const submitted = this.db.prepare('SELECT 1 FROM morning_feedback WHERE session_id = ?').get(fact.id);
    return submitted ? { pending: false, session: null } : { pending: true, session: { id: fact.id, ended_at: fact.endedAt, source: fact.source } };
  }

  async submitFeedback(userId: string, input: FeedbackInput, idempotencyKey: string) {
    if (!await this.sessionFacts.isCompletedForUser(input.session_id, userId)) throw new DomainError('SESSION_NOT_COMPLETED', '只能为当前用户已完成的会话提交反馈', 409);
    const existing = this.db.prepare('SELECT * FROM morning_feedback WHERE session_id = ?').get(input.session_id) as SqlRow | undefined;
    if (existing) throw new DomainError('FEEDBACK_ALREADY_EXISTS', '本次会话的反馈已经提交', 409);
    const feedbackId = randomUUID();
    const now = new Date().toISOString();
    try {
      this.db.exec('BEGIN IMMEDIATE');
      this.db.prepare(`INSERT INTO morning_feedback(
        feedback_id,session_id,user_id,fall_asleep_ease,sound_comfort,voice_next_time,story_effect_rating,disliked_content,note,submitted_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(feedbackId, input.session_id, userId, input.fall_asleep_ease, input.sound_comfort, input.voice_next_time, input.story_effect_rating ?? null, input.disliked_content ?? null, input.note ?? null, now);
      this.db.prepare(`UPDATE preference_profile SET voice_preference = ?, last_feedback_id = ?, updated_at = ? WHERE user_id = ?`).run(input.voice_next_time, feedbackId, now, userId);
      this.replaceRelations('preference_forbidden_sound_tag', 'tag', userId, input.forbidden_sound_tags, feedbackId);
      this.replaceRelations('preference_story_theme', 'theme', userId, input.story_themes, feedbackId);
      this.replaceRelations('preference_breath_template', 'template_id', userId, input.breath_templates, feedbackId);
      this.replaceRelations('preference_scene', 'scene_id', userId, input.scenes, feedbackId);
      this.appendPointsInTransaction(userId, 'feedback_submitted', 5, feedbackId, idempotencyKey, '提交次日反馈', now);
      this.db.exec('COMMIT');
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch (_) { /* transaction may not have started */ }
      if (error instanceof DomainError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('UNIQUE constraint failed')) throw new DomainError('CONFLICT', '反馈或积分事件已存在', 409);
      throw error;
    }
    return { feedback: this.feedbackById(feedbackId), points_awarded: 5, balance: this.points(userId).balance };
  }

  preferences(userId: string) {
    const profile = this.db.prepare('SELECT voice_preference, preferred_voice_id, last_feedback_id, updated_at FROM preference_profile WHERE user_id = ?').get(userId) as SqlRow;
    return {
      ...profile,
      forbidden_sound_tags: this.relationValues('preference_forbidden_sound_tag', 'tag', userId),
      story_themes: this.relationValues('preference_story_theme', 'theme', userId),
      breath_templates: this.relationValues('preference_breath_template', 'template_id', userId),
      scenes: this.relationValues('preference_scene', 'scene_id', userId)
    };
  }

  points(userId: string) {
    const rows = this.db.prepare('SELECT ledger_id AS id,event_type,points_delta,source_id,occurred_at,remark FROM points_ledger WHERE user_id = ? ORDER BY occurred_at DESC').all(userId) as SqlRow[];
    let running = rows.reduce((sum, row) => sum + Number(row.points_delta), 0);
    const entries = rows.map((row) => { const entry = { ...row, balance_after: running }; running -= Number(row.points_delta); return entry; });
    return { balance: rows.reduce((sum, row) => sum + Number(row.points_delta), 0), entries };
  }

  archive(userId: string, period: '7d' | '30d') {
    const days = period === '30d' ? 30 : 7;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const feedback = this.db.prepare(`SELECT feedback_id,session_id,fall_asleep_ease,sound_comfort,voice_next_time,note,submitted_at,record_source
      FROM morning_feedback WHERE user_id = ? AND submitted_at >= ? ORDER BY submitted_at DESC`).all(userId, since) as SqlRow[];
    const score: Record<string, number> = { comfortable: 3, acceptable: 2, uncomfortable: 1 };
    return { period, feedback_count: feedback.length, comfort_trend: feedback.slice().reverse().map((item) => ({ submitted_at: item.submitted_at, score: score[String(item.sound_comfort)] })), recent_feedback: feedback.slice(0, 10), source: 'subjective_feedback' };
  }

  recordPlanStarted(userId: string, planId: string, idempotencyKey: string) {
    const now = new Date().toISOString();
    try {
      this.db.exec('BEGIN IMMEDIATE');
      this.appendPointsInTransaction(userId, 'plan_started', 10, planId, idempotencyKey, '按计划开始', now);
      this.db.exec('COMMIT');
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch (_) { /* noop */ }
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('UNIQUE constraint failed')) throw error;
    }
    return this.points(userId);
  }

  private feedbackById(feedbackId: string) { return this.db.prepare('SELECT * FROM morning_feedback WHERE feedback_id = ?').get(feedbackId); }
  private relationValues(table: string, column: string, userId: string): string[] { return (this.db.prepare(`SELECT ${column} AS value FROM ${table} WHERE user_id = ? ORDER BY ${column}`).all(userId) as Array<{ value: string }>).map((row) => row.value); }
  private replaceRelations(table: string, column: string, userId: string, values: string[], feedbackId: string) { this.db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId); const insert = this.db.prepare(`INSERT INTO ${table}(user_id,${column},source_feedback_id) VALUES(?,?,?)`); [...new Set(values)].forEach((value) => insert.run(userId, value, feedbackId)); }
  private appendPointsInTransaction(userId: string, eventType: string, points: number, sourceId: string, idempotencyKey: string, remark: string, occurredAt: string) { this.db.prepare('INSERT INTO points_ledger(ledger_id,user_id,event_type,points_delta,source_id,idempotency_key,occurred_at,remark) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(), userId, eventType, points, sourceId, idempotencyKey, occurredAt, remark); }
}

export class DomainError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) { super(message); }
}

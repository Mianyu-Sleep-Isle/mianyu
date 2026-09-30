import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { PlanningError, type PlanTrack, type SleepPlan } from './types.ts';
type Row = Record<string, string | number | null>;

export class PlanningRepository {
  constructor(private readonly db: DatabaseSync) {}
  save(plan: SleepPlan): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(`INSERT INTO sleep_plan (plan_id,user_id,input_mode,mood,voice_preference,avoid_tags_json,selected_content_ids_json,
        plan_type,reason,planned_duration_sec,fade_out_sec,source,status,user_modified,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        plan.planId, plan.userId, plan.inputMode, plan.mood, plan.voicePreference, JSON.stringify(plan.avoidTags), JSON.stringify(plan.selectedContentIds),
        plan.planType, plan.reason, plan.durationSec, plan.fadeOutSec, plan.source, plan.status, 0, plan.createdAt);
      const insert = this.db.prepare(`INSERT INTO sleep_plan_track (track_id,plan_id,content_id,content_kind,start_offset_sec,volume,loop_mode,sequence_no) VALUES (?,?,?,?,?,?,?,?)`);
      for (const track of plan.tracks) insert.run(track.trackId, plan.planId, track.contentId, track.contentKind, track.startOffsetSec, track.volume, track.loopMode, track.sequenceNo);
      const story = plan.tracks.find((track) => track.contentKind === 'story');
      if (story) this.db.prepare(`INSERT INTO story_config
        (story_config_id,plan_id,content_id,speech_rate,duration_sec,ending_mode) VALUES (?,?,?,?,?,?)`)
        .run(randomUUID(), plan.planId, story.contentId, 0.9, plan.durationSec, 'environment_only_then_fade');
      const breath = plan.tracks.find((track) => track.contentKind === 'breath');
      if (breath) this.db.prepare(`INSERT INTO breath_config
        (breath_config_id,plan_id,content_id,breath_type,inhale_sec,hold_sec,exhale_sec,cycle_count,duration_sec) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(randomUUID(), plan.planId, breath.contentId, 'slow', 4, 0, 6, 12, 120);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  get(planId: string, userId: string): SleepPlan {
    const row = this.db.prepare('SELECT * FROM sleep_plan WHERE plan_id=?').get(planId) as Row | undefined;
    if (!row) throw new PlanningError('PLAN_NOT_FOUND', '方案不存在', 404);
    if (row.user_id !== userId) throw new PlanningError('PLAN_FORBIDDEN', '不能读取其他用户的方案', 403);
    const tracks = (this.db.prepare('SELECT * FROM sleep_plan_track WHERE plan_id=? ORDER BY sequence_no').all(planId) as Row[]).map((track): PlanTrack => ({
      trackId: String(track.track_id), contentId: String(track.content_id), contentKind: String(track.content_kind) as PlanTrack['contentKind'],
      startOffsetSec: Number(track.start_offset_sec), volume: Number(track.volume), loopMode: String(track.loop_mode) as PlanTrack['loopMode'], sequenceNo: Number(track.sequence_no) }));
    return { planId: String(row.plan_id), userId: String(row.user_id), inputMode: String(row.input_mode) as SleepPlan['inputMode'], mood: String(row.mood) as SleepPlan['mood'],
      voicePreference: String(row.voice_preference) as SleepPlan['voicePreference'], avoidTags: JSON.parse(String(row.avoid_tags_json)) as string[],
      selectedContentIds: JSON.parse(String(row.selected_content_ids_json)) as string[], status: String(row.status) as SleepPlan['status'],
      planType: String(row.plan_type) as SleepPlan['planType'], durationSec: Number(row.planned_duration_sec), fadeOutSec: Number(row.fade_out_sec),
      reason: String(row.reason), source: String(row.source) as SleepPlan['source'], sourceLabel: row.source === 'rule' ? '规则建议' : '模型建议', tracks,
      createdAt: String(row.created_at), confirmedAt: row.confirmed_at === null ? null : String(row.confirmed_at), startedSessionId: row.started_session_id === null ? null : String(row.started_session_id) };
  }
  findById(planId: string): SleepPlan | null {
    const row = this.db.prepare('SELECT user_id FROM sleep_plan WHERE plan_id=?').get(planId) as Row | undefined;
    return row ? this.get(planId, String(row.user_id)) : null;
  }
  getCurrent(userId: string): SleepPlan | null {
    const row = this.db.prepare('SELECT plan_id FROM sleep_plan WHERE user_id=? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(userId) as Row | undefined;
    return row ? this.get(String(row.plan_id), userId) : null;
  }
  confirm(planId: string, userId: string, now: string): SleepPlan {
    const current = this.get(planId, userId); if (current.status === 'confirmed') return current;
    if (current.status !== 'draft') throw new PlanningError('PLAN_STATUS_CONFLICT', '当前状态不能确认', 409);
    this.db.prepare("UPDATE sleep_plan SET status='confirmed',confirmed_at=? WHERE plan_id=? AND user_id=?").run(now, planId, userId); return this.get(planId, userId);
  }
  markStarted(planId: string, sessionId: string, now: string): SleepPlan {
    const row = this.db.prepare('SELECT user_id,status,started_session_id FROM sleep_plan WHERE plan_id=?').get(planId) as Row | undefined;
    if (!row) throw new PlanningError('PLAN_NOT_FOUND', '方案不存在', 404);
    if (row.status === 'started' && row.started_session_id === sessionId) return this.get(planId, String(row.user_id));
    if (row.status === 'started') throw new PlanningError('PLAN_ALREADY_STARTED', '方案已经关联其他睡眠会话', 409);
    if (row.status !== 'confirmed') throw new PlanningError('PLAN_STATUS_CONFLICT', '只有已确认方案可以开始', 409);
    this.db.prepare("UPDATE sleep_plan SET status='started',started_session_id=?,started_at=? WHERE plan_id=?").run(sessionId, now, planId); return this.get(planId, String(row.user_id));
  }
  markCompleted(planId: string, sessionId: string, now: string): SleepPlan {
    const row = this.db.prepare('SELECT user_id,status,started_session_id FROM sleep_plan WHERE plan_id=?').get(planId) as Row | undefined;
    if (!row) throw new PlanningError('PLAN_NOT_FOUND', '方案不存在', 404);
    if (row.status === 'completed' && row.started_session_id === sessionId) return this.get(planId, String(row.user_id));
    if (row.status !== 'started' || row.started_session_id !== sessionId) throw new PlanningError('PLAN_STATUS_CONFLICT', '只有对应会话正在执行的方案可以完成', 409);
    this.db.prepare("UPDATE sleep_plan SET status='completed',completed_at=? WHERE plan_id=?").run(now, planId);
    return this.get(planId, String(row.user_id));
  }
  cancel(planId: string, userId: string, now: string): SleepPlan {
    const current = this.get(planId, userId);
    if (current.status === 'cancelled') return current;
    if (current.status === 'completed') throw new PlanningError('PLAN_STATUS_CONFLICT', '已完成方案不能取消', 409);
    this.db.prepare("UPDATE sleep_plan SET status='cancelled',cancelled_at=? WHERE plan_id=? AND user_id=?").run(now, planId, userId);
    return this.get(planId, userId);
  }
  eraseUserData(userId: string): number { return Number(this.db.prepare('DELETE FROM sleep_plan WHERE user_id=?').run(userId).changes); }
}

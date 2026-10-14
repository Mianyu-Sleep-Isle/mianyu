import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { DRAMA_STAGES, type DramaJobStatus, type DramaStage, type DramaStageDetail, type StageRowStatus } from './state-machine.ts';

export interface BriefRecord {
  theme: string;
  mood: 'calm' | 'warm' | 'healing' | 'dreamy';
  setting: string;
  protagonist: string;
  visual_style: 'watercolor' | 'paper_cut' | 'soft_anime' | 'oil_pastel';
  duration_sec: 90 | 120 | 150;
  shot_count: 6 | 7 | 8;
  forbidden_elements: string[];
  voice_id: 'default';
  privacy_replacements: string[];
}

export interface JobRecord {
  job_id: string;
  user_id: string;
  status: DramaJobStatus;
  stage: DramaStage | null;
  stage_detail: DramaStageDetail | null;
  failed_stage: DramaStage | null;
  brief: BriefRecord;
  title: string | null;
  summary: string | null;
  narration: string | null;
  story_source: 'llm' | 'template' | null;
  review_status: 'pending' | 'approved' | 'rejected';
  progress: number;
  notices: string[];
  error_code: string | null;
  error_message: string | null;
  error_retryable: boolean | null;
  manual_retry_count: number;
  seed: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  video_duration_sec: number | null;
  video_size_bytes: number | null;
}

export interface StageRecord {
  stage_key: DramaStage;
  status: StageRowStatus;
  attempt: number;
}

export interface ShotRecord {
  shot_order: number;
  duration_sec: number;
  narration_text: string;
  image_prompt: string;
  negative_prompt: string;
  transition: 'fade' | 'crossfade';
  camera_motion: 'static' | 'zoom_in' | 'zoom_out' | 'pan';
  seed: number;
  image_status: 'pending' | 'generating' | 'completed' | 'failed';
  audio_status: 'pending' | 'generating' | 'completed' | 'failed';
}

type Row = Record<string, unknown>;

const asStage = (value: unknown): DramaStage | null => (typeof value === 'string' && DRAMA_STAGES.includes(value as DramaStage) ? value as DramaStage : null);

function mapJob(row: Row): JobRecord {
  return {
    job_id: String(row.job_id),
    user_id: String(row.user_id),
    status: row.status as DramaJobStatus,
    stage: asStage(row.stage),
    stage_detail: (row.stage_detail as DramaStageDetail | null) ?? null,
    failed_stage: asStage(row.failed_stage),
    brief: JSON.parse(String(row.brief_json)) as BriefRecord,
    title: row.title === null || row.title === undefined ? null : String(row.title),
    summary: row.summary === null || row.summary === undefined ? null : String(row.summary),
    narration: row.narration === null || row.narration === undefined ? null : String(row.narration),
    story_source: (row.story_source as JobRecord['story_source']) ?? null,
    review_status: row.review_status as JobRecord['review_status'],
    progress: Number(row.progress),
    notices: JSON.parse(String(row.notices_json)) as string[],
    error_code: row.error_code === null || row.error_code === undefined ? null : String(row.error_code),
    error_message: row.error_message === null || row.error_message === undefined ? null : String(row.error_message),
    error_retryable: row.error_retryable === null || row.error_retryable === undefined ? null : Number(row.error_retryable) === 1,
    manual_retry_count: Number(row.manual_retry_count),
    seed: Number(row.seed),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    completed_at: row.completed_at === null || row.completed_at === undefined ? null : String(row.completed_at),
    video_duration_sec: row.video_duration_sec === null || row.video_duration_sec === undefined ? null : Number(row.video_duration_sec),
    video_size_bytes: row.video_size_bytes === null || row.video_size_bytes === undefined ? null : Number(row.video_size_bytes),
  };
}

export class DramaRepository {
  constructor(private readonly db: DatabaseSync) {}

  create(input: { userId: string; brief: BriefRecord; idempotencyKey: string; seed: number }): JobRecord {
    const now = new Date().toISOString();
    const jobId = randomUUID();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(`INSERT INTO drama_job(
        job_id, user_id, status, stage, stage_detail, failed_stage, brief_json, review_status, progress, notices_json,
        manual_retry_count, seed, created_at, updated_at
      ) VALUES (?, ?, 'queued', NULL, NULL, NULL, ?, 'pending', 0, '[]', 0, ?, ?, ?)`).run(
        jobId, input.userId, JSON.stringify(input.brief), input.seed, now, now,
      );
      const insertStage = this.db.prepare('INSERT INTO drama_stage(job_id, stage_key, status, attempt) VALUES (?, ?, \'pending\', 0)');
      for (const stage of DRAMA_STAGES) insertStage.run(jobId, stage);
      this.db.prepare('INSERT INTO drama_idempotency(user_id, idempotency_key, job_id, created_at) VALUES (?, ?, ?, ?)').run(
        input.userId, input.idempotencyKey, jobId, now,
      );
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.mustGet(jobId);
  }

  findIdempotent(userId: string, key: string): JobRecord | null {
    const row = this.db.prepare('SELECT job_id FROM drama_idempotency WHERE user_id = ? AND idempotency_key = ?').get(userId, key) as Row | undefined;
    return row ? this.mustGet(String(row.job_id)) : null;
  }

  countActive(): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS count FROM drama_job WHERE status IN ('queued','running','cancelling')`).get() as Row;
    return Number(row.count);
  }

  findActiveByUser(userId: string): JobRecord | null {
    const row = this.db.prepare(`SELECT * FROM drama_job WHERE user_id = ? AND status IN ('queued','running','cancelling') ORDER BY created_at DESC LIMIT 1`).get(userId) as Row | undefined;
    return row ? mapJob(row) : null;
  }

  getForUser(jobId: string, userId: string): JobRecord | null {
    const row = this.db.prepare('SELECT * FROM drama_job WHERE job_id = ? AND user_id = ?').get(jobId, userId) as Row | undefined;
    return row ? mapJob(row) : null;
  }

  mustGet(jobId: string): JobRecord {
    const row = this.db.prepare('SELECT * FROM drama_job WHERE job_id = ?').get(jobId) as Row | undefined;
    if (!row) throw new Error(`missing drama job ${jobId}`);
    return mapJob(row);
  }

  listForUser(userId: string, limit: number): JobRecord[] {
    const rows = this.db.prepare('SELECT * FROM drama_job WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, limit) as Row[];
    return rows.map(mapJob);
  }

  queuePosition(job: JobRecord): number | null {
    if (job.status !== 'queued') return null;
    const row = this.db.prepare(`SELECT COUNT(*) AS count FROM drama_job WHERE status = 'queued' AND created_at < ?`).get(job.created_at) as Row;
    return Number(row.count) + 1;
  }

  stages(jobId: string): StageRecord[] {
    const rows = this.db.prepare('SELECT stage_key, status, attempt FROM drama_stage WHERE job_id = ?').all(jobId) as Row[];
    const byKey = new Map(rows.map((row) => [String(row.stage_key), row]));
    return DRAMA_STAGES.map((stage) => {
      const row = byKey.get(stage);
      return { stage_key: stage, status: (row ? String(row.status) : 'pending') as StageRowStatus, attempt: row ? Number(row.attempt) : 0 };
    });
  }

  shots(jobId: string): ShotRecord[] {
    const rows = this.db.prepare('SELECT * FROM drama_shot WHERE job_id = ? ORDER BY shot_order').all(jobId) as Row[];
    return rows.map((row) => ({
      shot_order: Number(row.shot_order),
      duration_sec: Number(row.duration_sec),
      narration_text: String(row.narration_text),
      image_prompt: String(row.image_prompt),
      negative_prompt: String(row.negative_prompt),
      transition: row.transition as ShotRecord['transition'],
      camera_motion: row.camera_motion as ShotRecord['camera_motion'],
      seed: Number(row.seed),
      image_status: row.image_status as ShotRecord['image_status'],
      audio_status: row.audio_status as ShotRecord['audio_status'],
    }));
  }

  replaceShots(jobId: string, shots: ShotRecord[]): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM drama_shot WHERE job_id = ?').run(jobId);
      const insert = this.db.prepare(`INSERT INTO drama_shot(
        job_id, shot_order, duration_sec, narration_text, image_prompt, negative_prompt, transition, camera_motion, seed, image_status, audio_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const shot of shots) {
        insert.run(jobId, shot.shot_order, shot.duration_sec, shot.narration_text, shot.image_prompt, shot.negative_prompt, shot.transition, shot.camera_motion, shot.seed, shot.image_status, shot.audio_status);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  updateShot(jobId: string, order: number, patch: Partial<Pick<ShotRecord, 'image_status' | 'audio_status'>>): void {
    if (patch.image_status) this.db.prepare('UPDATE drama_shot SET image_status = ? WHERE job_id = ? AND shot_order = ?').run(patch.image_status, jobId, order);
    if (patch.audio_status) this.db.prepare('UPDATE drama_shot SET audio_status = ? WHERE job_id = ? AND shot_order = ?').run(patch.audio_status, jobId, order);
  }

  markStage(jobId: string, stage: DramaStage, status: StageRowStatus, bumpAttempt: boolean): void {
    const now = new Date().toISOString();
    if (bumpAttempt) {
      this.db.prepare(`UPDATE drama_stage SET status = ?, attempt = attempt + 1, started_at = COALESCE(started_at, ?) WHERE job_id = ? AND stage_key = ?`).run(status, now, jobId, stage);
      return;
    }
    this.db.prepare(`UPDATE drama_stage SET status = ?, finished_at = CASE WHEN ? IN ('completed','failed','skipped') THEN ? ELSE finished_at END WHERE job_id = ? AND stage_key = ?`).run(
      status, status, now, jobId, stage,
    );
  }

  patchJob(jobId: string, patch: Partial<{
    status: DramaJobStatus;
    stage: DramaStage | null;
    stage_detail: DramaStageDetail | null;
    failed_stage: DramaStage | null;
    title: string | null;
    summary: string | null;
    narration: string | null;
    story_source: 'llm' | 'template' | null;
    review_status: JobRecord['review_status'];
    progress: number;
    error_code: string | null;
    error_message: string | null;
    error_retryable: boolean | null;
    manual_retry_count: number;
    completed_at: string | null;
    video_duration_sec: number | null;
    video_size_bytes: number | null;
  }>): void {
    const current = this.mustGet(jobId);
    const progress = patch.progress === undefined ? current.progress : Math.max(current.progress, patch.progress);
    this.db.prepare(`UPDATE drama_job SET
      status = ?, stage = ?, stage_detail = ?, failed_stage = ?, title = ?, summary = ?, narration = ?, story_source = ?,
      review_status = ?, progress = ?, error_code = ?, error_message = ?, error_retryable = ?, manual_retry_count = ?,
      completed_at = ?, video_duration_sec = ?, video_size_bytes = ?, updated_at = ?
      WHERE job_id = ?`).run(
      patch.status ?? current.status,
      patch.stage === undefined ? current.stage : patch.stage,
      patch.stage_detail === undefined ? current.stage_detail : patch.stage_detail,
      patch.failed_stage === undefined ? current.failed_stage : patch.failed_stage,
      patch.title === undefined ? current.title : patch.title,
      patch.summary === undefined ? current.summary : patch.summary,
      patch.narration === undefined ? current.narration : patch.narration,
      patch.story_source === undefined ? current.story_source : patch.story_source,
      patch.review_status ?? current.review_status,
      progress,
      patch.error_code === undefined ? current.error_code : patch.error_code,
      patch.error_message === undefined ? current.error_message : patch.error_message,
      patch.error_retryable === undefined ? (current.error_retryable === null ? null : Number(current.error_retryable)) : (patch.error_retryable === null ? null : Number(patch.error_retryable)),
      patch.manual_retry_count ?? current.manual_retry_count,
      patch.completed_at === undefined ? current.completed_at : patch.completed_at,
      patch.video_duration_sec === undefined ? current.video_duration_sec : patch.video_duration_sec,
      patch.video_size_bytes === undefined ? current.video_size_bytes : patch.video_size_bytes,
      new Date().toISOString(),
      jobId,
    );
  }

  addNotice(jobId: string, notice: string): void {
    const current = this.mustGet(jobId);
    if (current.notices.includes(notice)) return;
    this.db.prepare('UPDATE drama_job SET notices_json = ?, updated_at = ? WHERE job_id = ?').run(
      JSON.stringify([...current.notices, notice]), new Date().toISOString(), jobId,
    );
  }

  claimNext(): JobRecord | null {
    const row = this.db.prepare(`SELECT job_id FROM drama_job WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1`).get() as Row | undefined;
    if (!row) return null;
    const now = new Date().toISOString();
    const changed = this.db.prepare(`UPDATE drama_job SET status = 'running', updated_at = ? WHERE job_id = ? AND status = 'queued'`).run(now, String(row.job_id));
    if (Number(changed.changes) !== 1) return this.claimNext();
    return this.mustGet(String(row.job_id));
  }

  runningIds(): string[] {
    return (this.db.prepare(`SELECT job_id FROM drama_job WHERE status = 'running'`).all() as Row[]).map((row) => String(row.job_id));
  }

  recover(): void {
    const now = new Date().toISOString();
    const stale = new Date(Date.now() - 120_000).toISOString();
    this.db.prepare(`UPDATE drama_job SET status = 'cancelled', updated_at = ? WHERE status = 'cancelling'`).run(now);
    this.db.prepare(`UPDATE drama_job SET status = 'queued', updated_at = ? WHERE status = 'running'`).run(now);
    this.db.prepare(`UPDATE drama_gpu_lock SET job_id = NULL, stage = NULL, heartbeat_at = NULL WHERE lock_id = 1 AND (heartbeat_at IS NULL OR heartbeat_at < ?)`).run(stale);
  }

  textStageBusy(): boolean {
    const row = this.db.prepare(`SELECT 1 FROM drama_job WHERE status = 'running' AND stage IN ('generating_story','reviewing','generating_storyboard') LIMIT 1`).get();
    return Boolean(row);
  }

  gpuLockHeld(): boolean {
    const row = this.db.prepare('SELECT job_id FROM drama_gpu_lock WHERE lock_id = 1').get() as Row | undefined;
    return Boolean(row?.job_id);
  }

  setLock(jobId: string | null, stage: string | null): void {
    this.db.prepare('UPDATE drama_gpu_lock SET job_id = ?, stage = ?, heartbeat_at = ? WHERE lock_id = 1').run(
      jobId, stage, jobId ? new Date().toISOString() : null,
    );
  }

  jobIdsForUser(userId: string): string[] {
    return (this.db.prepare('SELECT job_id FROM drama_job WHERE user_id = ?').all(userId) as Row[]).map((row) => String(row.job_id));
  }

  deleteJob(jobId: string): void {
    this.db.prepare('DELETE FROM drama_job WHERE job_id = ?').run(jobId);
  }

  deleteUser(userId: string): number {
    const result = this.db.prepare('DELETE FROM drama_job WHERE user_id = ?').run(userId);
    return Number(result.changes);
  }
}

import { DatabaseSync } from 'node:sqlite';
import { SessionError, type EventRecord, type SessionFacts, type SessionRecord, type StageRecord } from './types.ts';

type Row = Record<string, unknown>;
const c = (row: Row, key: string) => row[key] as never;
function sessionFrom(row: Row): SessionRecord {
  return {
    sessionId:c(row,'session_id'), userId:c(row,'user_id'), planId:c(row,'plan_id'), sceneConfigId:c(row,'scene_config_id'),
    status:c(row,'status'), currentStage:c(row,'current_stage'), plannedDurationSec:c(row,'planned_duration_sec'), fadeOutSec:c(row,'fade_out_sec'),
    startedAt:c(row,'started_at'), endedAt:c(row,'ended_at'), activePlaybackSec:c(row,'active_playback_sec'), pausedSec:c(row,'paused_sec'),
    stopReason:c(row,'stop_reason'), masterVolumeStart:c(row,'master_volume_start'), masterVolumeEnd:c(row,'master_volume_end'),
    noiseCaptureAuthorized: Boolean(row.noise_capture_authorized), deviceDataAuthorized:Boolean(row.device_data_authorized),
    recordSource:'playback_record', createdAt:c(row,'created_at'), updatedAt:c(row,'updated_at'),
  };
}
function stageFrom(row: Row): StageRecord {
  return {
    stageId:c(row,'stage_id'), sessionId:c(row,'session_id'), stageType:c(row,'stage_type'), sequenceNo:c(row,'sequence_no'),
    status:c(row,'status'), plannedDurationSec:c(row,'planned_duration_sec'), actualDurationSec:c(row,'actual_duration_sec'),
    startedAt:c(row,'started_at'), endedAt:c(row,'ended_at'), skipReason:c(row,'skip_reason'),
    recordSource:'playback_record', createdAt:c(row,'created_at'), updatedAt:c(row,'updated_at'),
  };
}
function eventFrom(row: Row): EventRecord {
  return {
    eventId:c(row,'event_id'), sessionId:c(row,'session_id'), stageId:c(row,'stage_id'), sceneAudioSourceId:c(row,'scene_audio_source_id'),
    eventType:c(row,'event_type'), occurredAt:c(row,'occurred_at'), oldValue:c(row,'old_value'), newValue:c(row,'new_value'),
    errorCode:c(row,'error_code'), detailJson:c(row,'detail_json'), recordSource:'playback_record', createdAt:c(row,'created_at'),
  };
}

export class SleepSessionRepository {
  private readonly db: DatabaseSync;
  constructor(db: DatabaseSync) { this.db=db; db.exec('PRAGMA foreign_keys = ON'); }

  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result=fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  createSession(s: SessionRecord): void {
    this.db.prepare(`INSERT INTO sleep_session
      (session_id,user_id,plan_id,scene_config_id,status,current_stage,planned_duration_sec,fade_out_sec,started_at,ended_at,active_playback_sec,paused_sec,stop_reason,master_volume_start,master_volume_end,noise_capture_authorized,device_data_authorized,record_source,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      s.sessionId,s.userId,s.planId,s.sceneConfigId,s.status,s.currentStage,s.plannedDurationSec,s.fadeOutSec,s.startedAt,s.endedAt,s.activePlaybackSec,s.pausedSec,s.stopReason,s.masterVolumeStart,s.masterVolumeEnd,Number(s.noiseCaptureAuthorized),Number(s.deviceDataAuthorized),s.recordSource,s.createdAt,s.updatedAt);
  }
  updateSession(s: SessionRecord): void {
    const result=this.db.prepare(`UPDATE sleep_session SET status=?,current_stage=?,started_at=?,ended_at=?,active_playback_sec=?,paused_sec=?,stop_reason=?,master_volume_end=?,updated_at=? WHERE session_id=? AND user_id=?`).run(
      s.status,s.currentStage,s.startedAt,s.endedAt,s.activePlaybackSec,s.pausedSec,s.stopReason,s.masterVolumeEnd,s.updatedAt,s.sessionId,s.userId);
    if (result.changes !== 1) throw new SessionError('not_found','Session not found');
  }
  getSession(sessionId: string): SessionRecord | null {
    const row=this.db.prepare('SELECT * FROM sleep_session WHERE session_id=?').get(sessionId) as Row | undefined;
    return row ? sessionFrom(row) : null;
  }
  listSessions(userId: string, since: string): SessionRecord[] {
    return (this.db.prepare('SELECT * FROM sleep_session WHERE user_id=? AND started_at>=? ORDER BY started_at DESC, session_id DESC').all(userId,since) as Row[]).map(sessionFrom);
  }
  createStage(s: StageRecord): void {
    this.db.prepare(`INSERT INTO playback_stage
      (stage_id,session_id,stage_type,sequence_no,status,planned_duration_sec,actual_duration_sec,started_at,ended_at,skip_reason,record_source,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(s.stageId,s.sessionId,s.stageType,s.sequenceNo,s.status,s.plannedDurationSec,s.actualDurationSec,s.startedAt,s.endedAt,s.skipReason,s.recordSource,s.createdAt,s.updatedAt);
  }
  updateStage(s: StageRecord): void {
    const result=this.db.prepare('UPDATE playback_stage SET status=?,actual_duration_sec=?,started_at=?,ended_at=?,skip_reason=?,updated_at=? WHERE stage_id=? AND session_id=?').run(
      s.status,s.actualDurationSec,s.startedAt,s.endedAt,s.skipReason,s.updatedAt,s.stageId,s.sessionId);
    if (result.changes !== 1) throw new SessionError('not_found','Stage not found');
  }
  listStages(sessionId: string): StageRecord[] {
    return (this.db.prepare('SELECT * FROM playback_stage WHERE session_id=? ORDER BY sequence_no').all(sessionId) as Row[]).map(stageFrom);
  }
  appendEvent(e: EventRecord): boolean {
    const existing=this.getEvent(e.eventId);
    if (existing) {
      if (existing.sessionId!==e.sessionId || existing.eventType!==e.eventType || existing.stageId!==e.stageId ||
        existing.sceneAudioSourceId!==e.sceneAudioSourceId || existing.occurredAt!==e.occurredAt ||
        existing.oldValue!==e.oldValue || existing.newValue!==e.newValue || existing.errorCode!==e.errorCode ||
        existing.detailJson!==e.detailJson) throw new SessionError('state_conflict','Event ID already belongs to another fact');
      return false;
    }
    this.db.prepare(`INSERT INTO playback_event
      (event_id,session_id,stage_id,scene_audio_source_id,event_type,occurred_at,old_value,new_value,error_code,detail_json,record_source,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(e.eventId,e.sessionId,e.stageId,e.sceneAudioSourceId,e.eventType,e.occurredAt,e.oldValue,e.newValue,e.errorCode,e.detailJson,e.recordSource,e.createdAt);
    return true;
  }
  getEvent(eventId: string): EventRecord | null {
    const row=this.db.prepare('SELECT * FROM playback_event WHERE event_id=?').get(eventId) as Row | undefined;
    return row ? eventFrom(row) : null;
  }
  listEvents(sessionId: string): EventRecord[] {
    return (this.db.prepare('SELECT * FROM playback_event WHERE session_id=? ORDER BY rowid').all(sessionId) as Row[]).map(eventFrom);
  }
  facts(sessionId: string, userId: string): SessionFacts | null {
    const session=this.getSession(sessionId);
    return session?.userId===userId ? {session,stages:this.listStages(sessionId),events:this.listEvents(sessionId)} : null;
  }
  eraseUserData(userId: string): number {
    return this.transaction(() => Number(this.db.prepare('DELETE FROM sleep_session WHERE user_id=?').run(userId).changes));
  }
}

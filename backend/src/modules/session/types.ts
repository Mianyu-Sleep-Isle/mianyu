export type SessionStatus = 'preparing' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
export type StageType = 'breath' | 'story' | 'soundscape' | 'fade_out';
export type StageStatus = 'pending' | 'running' | 'paused' | 'completed' | 'skipped' | 'failed';
export type StopReason = 'timer_completed' | 'user_ended' | 'user_cancelled_before_start' | 'app_interrupted' | 'audio_engine_error' | 'resource_load_failed' | 'validation_failed';
export type EventType = 'session_preparing' | 'session_started' | 'stage_started' | 'stage_completed' | 'stage_skipped' | 'paused' | 'resumed' | 'track_started' | 'track_stopped' | 'volume_changed' | 'story_finished' | 'voice_removed' | 'fade_started' | 'fade_completed' | 'session_ended' | 'resource_missing' | 'playback_error';

// Module-local read projections. The team lead can adapt the frozen shared Ports
// to these views without this module importing another feature's internals.
export interface PlanExecutionView {
  planId: string;
  userId: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  plannedDurationSec: number;
  fadeOutSec: number;
  masterVolume: number;
  breathDurationSec?: number;
  storyDurationSec?: number;
}
export interface SceneSourceView {
  sourceId: string;
  trackId: string;
  enabled: boolean;
  required: boolean;
}
export interface SceneExecutionView {
  sceneConfigId: string;
  userId: string;
  sourcePlanId: string | null;
  lifecycleStatus: 'draft' | 'handed_off' | 'retired';
  sources: SceneSourceView[];
}
export interface ResourceView { trackId: string; playable: boolean; }
export interface PlanQueryPort { getPlan(planId: string): Promise<PlanExecutionView | null>; }
export interface SceneConfigQueryPort { getScene(sceneConfigId: string): Promise<SceneExecutionView | null>; }
export interface PlayableResourceResolverPort { resolve(trackId: string, userId: string): Promise<ResourceView | null>; }
export interface PlanStartedFact { eventId: string; userId: string; planId: string; sessionId: string; startedAt: string; }
export interface DomainEventPublisherPort { publishPlanStarted(fact: PlanStartedFact): Promise<void>; }
export interface Clock { now(): Date; }

export interface SessionRecord {
  sessionId: string; userId: string; planId: string; sceneConfigId: string;
  status: SessionStatus; currentStage: StageType | null;
  plannedDurationSec: number; fadeOutSec: number;
  startedAt: string | null; endedAt: string | null;
  activePlaybackSec: number; pausedSec: number; stopReason: StopReason | null;
  masterVolumeStart: number; masterVolumeEnd: number | null;
  noiseCaptureAuthorized: boolean; deviceDataAuthorized: boolean;
  recordSource: 'playback_record'; createdAt: string; updatedAt: string;
}
export interface StageRecord {
  stageId: string; sessionId: string; stageType: StageType; sequenceNo: number;
  status: StageStatus; plannedDurationSec: number | null; actualDurationSec: number;
  startedAt: string | null; endedAt: string | null; skipReason: string | null;
  recordSource: 'playback_record'; createdAt: string; updatedAt: string;
}
export interface EventRecord {
  eventId: string; sessionId: string; stageId: string | null; sceneAudioSourceId: string | null;
  eventType: EventType; occurredAt: string; oldValue: string | null; newValue: string | null;
  errorCode: string | null; detailJson: string | null; recordSource: 'playback_record'; createdAt: string;
}
export interface SessionFacts { session: SessionRecord; stages: StageRecord[]; events: EventRecord[]; }

export class SessionError extends Error {
  readonly code: 'validation_error' | 'not_found' | 'forbidden_by_age' | 'forbidden_by_preference' | 'content_not_approved' | 'resource_unavailable' | 'storage_error' | 'playback_error' | 'external_service_error' | 'state_conflict' | 'forbidden';
  constructor(code: SessionError['code'], message: string) {
    super(message);
    this.code=code;
  }
}

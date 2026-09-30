import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { ApiError, idempotencyKeyFrom, requireUserId } from '../../shared/http.ts';
import type { SleepSessionService } from './service.ts';
import { SessionError, type SessionFacts, type SessionRecord } from './types.ts';

const statusByCode: Record<SessionError['code'], number> = {
  validation_error: 400, not_found: 404, forbidden: 403, forbidden_by_age: 403, forbidden_by_preference: 403,
  content_not_approved: 403, resource_unavailable: 409, state_conflict: 409, playback_error: 409,
  storage_error: 500, external_service_error: 503,
};

export const sessionErrorTranslator = (error: unknown): ApiError | null =>
  error instanceof SessionError ? new ApiError(error.code.toUpperCase(), error.message, statusByCode[error.code]) : null;

// Supplied by the composition root: turns the page's plan/scene references into
// a confirmed plan and a handed-off scene without this module reading their tables.
export interface SessionTargetResolver {
  resolve(userId: string, input: { planId: string | undefined; sceneId: string | undefined }): Promise<{ planId: string; sceneConfigId: string }>;
}

export interface SessionLifecycleHooks { onEnded(session: SessionRecord): void }

const startSchema = z.object({
  plan_id: z.string().trim().min(1).max(64).optional(),
  scene_id: z.string().trim().min(1).max(64).optional(),
  planId: z.string().trim().min(1).max(64).optional(),
  sceneConfigId: z.string().trim().min(1).max(64).optional(),
});
const observationTypes = ['track_started', 'track_stopped', 'resource_missing', 'playback_error'] as const;
const eventSchema = z.object({
  type: z.enum([...observationTypes, 'stage_completed', 'stage_skipped', 'volume_changed']),
  payload: z.object({
    event_id: z.string().trim().min(1).max(100).optional(),
    occurred_at: z.iso.datetime().optional(),
    scene_audio_source_id: z.string().trim().min(1).max(64).optional(),
    error_code: z.string().trim().min(1).max(64).optional(),
    reason: z.string().trim().min(1).max(100).optional(),
    volume: z.number().min(0).max(1).optional(),
  }).passthrough().default({}),
});
const historyQuery = z.object({ period: z.enum(['7d', '30d']).default('7d') });

export function toSessionDto(record: SessionRecord) {
  return {
    ...record,
    id: record.sessionId,
    plan_id: record.planId,
    scene_id: record.sceneConfigId,
    started_at: record.startedAt,
    ended_at: record.endedAt,
    playback_minutes: Math.floor(record.activePlaybackSec / 60),
  };
}

const factsDto = (facts: SessionFacts) => ({ ...toSessionDto(facts.session), stages: facts.stages });

export function createSessionRouter(service: SleepSessionService, targets: SessionTargetResolver, hooks: SessionLifecycleHooks): Router {
  const router = Router();
  const preparedByKey = new Map<string, string>();
  const afterChange = (facts: SessionFacts) => {
    if (facts.session.endedAt) hooks.onEnded(facts.session);
    return facts;
  };

  // Prepare only: the session stays `preparing` until the client reports that
  // audio actually started via POST /sessions/:id/start.
  router.post('/sessions', async (request, response) => {
    const userId = requireUserId(request);
    const key = idempotencyKeyFrom(request);
    const cachedId = key ? preparedByKey.get(`${userId}:${key}`) : undefined;
    if (cachedId) {
      response.status(201).json({ data: factsDto(service.getSessionFacts(cachedId, userId)) });
      return;
    }
    const body = startSchema.parse(request.body ?? {});
    const target = await targets.resolve(userId, { planId: body.plan_id ?? body.planId, sceneId: body.scene_id ?? body.sceneConfigId });
    const prepared = await service.prepare(userId, target.planId, target.sceneConfigId);
    if (key) preparedByKey.set(`${userId}:${key}`, prepared.session.sessionId);
    response.status(201).json({ data: factsDto(prepared) });
  });
  router.post('/sessions/:sessionId/start', async (request, response) => {
    response.json({ data: factsDto(await service.start(requireUserId(request), String(request.params.sessionId))) });
  });
  router.get('/sessions/history', (request, response) => {
    const { period } = historyQuery.parse(request.query);
    response.json({ data: service.listHistory(requireUserId(request), period === '30d' ? 30 : 7).map(toSessionDto) });
  });
  router.get('/sessions/:sessionId', (request, response) => {
    const facts = service.getSessionFacts(String(request.params.sessionId), requireUserId(request));
    response.json({ data: { ...factsDto(facts), events: facts.events } });
  });
  router.post('/sessions/:sessionId/pause', (request, response) => {
    response.json({ data: factsDto(service.pause(requireUserId(request), String(request.params.sessionId))) });
  });
  router.post('/sessions/:sessionId/resume', (request, response) => {
    response.json({ data: factsDto(service.resume(requireUserId(request), String(request.params.sessionId))) });
  });
  router.post('/sessions/:sessionId/stop', (request, response) => {
    const userId = requireUserId(request);
    const sessionId = String(request.params.sessionId);
    const current = service.getSessionFacts(sessionId, userId);
    if (current.session.endedAt) {
      response.json({ data: factsDto(current) });
      return;
    }
    const reason = current.session.status === 'preparing' ? 'user_cancelled_before_start' : 'user_ended';
    response.json({ data: factsDto(afterChange(service.end(userId, sessionId, reason))) });
  });
  router.post('/sessions/:sessionId/events', (request, response) => {
    const userId = requireUserId(request);
    const sessionId = String(request.params.sessionId);
    const { type, payload } = eventSchema.parse(request.body ?? {});
    const occurredAt = payload.occurred_at ?? new Date().toISOString();
    const eventId = payload.event_id ?? idempotencyKeyFrom(request) ?? randomUUID();
    let accepted = true;
    let facts: SessionFacts;
    if (type === 'stage_completed') facts = afterChange(service.completeStage(userId, sessionId));
    else if (type === 'stage_skipped') facts = service.skipStage(userId, sessionId, payload.reason ?? 'user_skipped');
    else if (type === 'volume_changed') {
      if (payload.volume === undefined) throw new ApiError('INVALID_REQUEST', 'volume_changed 需要 payload.volume', 400);
      facts = service.setMasterVolume(userId, sessionId, payload.volume);
    } else {
      accepted = service.appendObservation(userId, sessionId, {
        eventId, eventType: type, occurredAt,
        ...(payload.scene_audio_source_id ? { sceneAudioSourceId: payload.scene_audio_source_id } : {}),
        ...(payload.error_code ? { errorCode: payload.error_code } : {}),
      });
      facts = service.getSessionFacts(sessionId, userId);
    }
    response.status(201).json({ data: { id: eventId, session_id: sessionId, type, payload, occurred_at: occurredAt, accepted, session: factsDto(facts) } });
  });
  return router;
}

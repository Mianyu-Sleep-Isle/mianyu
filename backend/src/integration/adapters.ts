import { ApiError } from '../shared/http.ts';
import type { UserDirectory } from '../modules/common/users.ts';
import type { ContentCatalog } from '../modules/content/catalog.ts';
import type { SessionFact, SessionFactsPort } from '../modules/growth/contracts.ts';
import type { GrowthService } from '../modules/growth/service.ts';
import type { PreferenceQueryService, PlanningService } from '../modules/planning/service.ts';
import { PlanningError } from '../modules/planning/types.ts';
import { isUuid, type SceneAssetDirectory } from '../modules/scene/frontend-compat.ts';
import { PlanQueryUnavailable, type PlanQueryService, type SceneService } from '../modules/scene/service.ts';
import type { SessionLifecycleHooks, SessionTargetResolver } from '../modules/session/routes.ts';
import type { SleepSessionService } from '../modules/session/service.ts';
import type {
  DomainEventPublisherPort, PlanExecutionView, PlanQueryPort, PlayableResourceResolverPort, SceneConfigQueryPort, SessionRecord,
} from '../modules/session/types.ts';

const DEFAULT_MASTER_VOLUME = 0.7;
const DEFAULT_BREATH_SEC = 120;
const DEFAULT_STORY_SEC = 300;

const logFailure = (scope: string) => (error: unknown) => console.error(`[integration:${scope}]`, error);

export function sceneAssetDirectory(catalog: ContentCatalog): SceneAssetDirectory {
  return {
    resolveAssetId: (idOrAssetId) => catalog.find(idOrAssetId)?.assetId,
    describe: (assetId) => {
      const entry = catalog.find(assetId);
      return entry ? { contentId: entry.contentId, name: entry.name, assetPath: entry.imagePath, defaultSpace: entry.defaultSpace } : undefined;
    },
  };
}

export function planPreferences(growth: GrowthService, users: UserDirectory): PreferenceQueryService {
  return { async getPreferences(userId) { return { avoidTags: users.hasUser(userId) ? growth.forbiddenSoundTags(userId) : [] }; } };
}

export function confirmedPlansForScene(planning: PlanningService): PlanQueryService {
  return {
    async getConfirmedPlan(planId, userId) {
      let plan;
      try {
        plan = planning.getPlan(planId, userId);
      } catch (error) {
        if (error instanceof PlanningError && error.status === 404) throw new PlanQueryUnavailable('not_found');
        if (error instanceof PlanningError && error.status === 403) throw new PlanQueryUnavailable('forbidden');
        throw error;
      }
      if (plan.status !== 'confirmed') throw new PlanQueryUnavailable('not_confirmed');
      return { planId: plan.planId, userId: plan.userId, tracks: plan.tracks.map((track) => ({ contentId: track.contentId, volume: track.volume, loopMode: track.loopMode })) };
    },
  };
}

export function plansForSession(planning: PlanningService, catalog: ContentCatalog): PlanQueryPort {
  return {
    async getPlan(planId) {
      const plan = planning.findPlan(planId);
      if (!plan) return null;
      const breath = plan.tracks.find((track) => track.contentKind === 'breath');
      const story = plan.tracks.find((track) => track.contentKind === 'story');
      const view: PlanExecutionView = {
        planId: plan.planId,
        userId: plan.userId,
        // Started or completed plans cannot open another session.
        status: plan.status === 'draft' || plan.status === 'confirmed' ? plan.status : 'cancelled',
        plannedDurationSec: plan.durationSec,
        fadeOutSec: plan.fadeOutSec,
        masterVolume: plan.tracks.length > 0 ? Math.max(...plan.tracks.map((track) => track.volume)) : DEFAULT_MASTER_VOLUME,
      };
      if (breath) view.breathDurationSec = catalog.find(breath.contentId)?.durationSec ?? DEFAULT_BREATH_SEC;
      if (story) view.storyDurationSec = catalog.find(story.contentId)?.durationSec ?? DEFAULT_STORY_SEC;
      return view;
    },
  };
}

export function scenesForSession(scenes: SceneService): SceneConfigQueryPort {
  return {
    async getScene(sceneConfigId) {
      const snapshot = scenes.findSnapshot(sceneConfigId);
      if (!snapshot) return null;
      return {
        sceneConfigId: snapshot.sceneConfigId,
        userId: snapshot.userId,
        sourcePlanId: snapshot.sourcePlanId,
        lifecycleStatus: snapshot.status,
        sources: snapshot.sources.map((source) => ({ sourceId: source.sourceId, trackId: source.assetId, enabled: source.enabled, required: false })),
      };
    },
  };
}

export function resourcesForSession(catalog: ContentCatalog): PlayableResourceResolverPort {
  return { resolve: (trackId, userId) => catalog.resolveTrack(trackId, userId) };
}

// PlanStarted fan-out: planning records the session link, growth awards +10 once.
// Failures are logged, never surfaced: playback has already started.
export function planStartedPublisher(planning: PlanningService, growth: GrowthService, users: UserDirectory): DomainEventPublisherPort {
  return {
    async publishPlanStarted(fact) {
      try { planning.markStarted(fact.planId, fact.sessionId); } catch (error) { logFailure('plan-started:planning')(error); }
      if (!users.hasUser(fact.userId)) return;
      try { growth.recordPlanStarted(fact.userId, fact.planId, `plan-started:${fact.eventId}`); } catch (error) { logFailure('plan-started:growth')(error); }
    },
  };
}

export function sessionLifecycle(planning: PlanningService): SessionLifecycleHooks {
  return {
    onEnded(session) {
      if (session.status !== 'completed') return;
      try { planning.markCompleted(session.planId, session.sessionId); } catch (error) { logFailure('session-completed:planning')(error); }
    },
  };
}

// Scenes are frozen when playback starts; the preview page sends placeholder
// IDs (plan-demo / scene-demo), which fall back to the user's current records.
export function sessionTargets(planning: PlanningService, scenes: SceneService): SessionTargetResolver {
  return {
    async resolve(userId, input) {
      const planId = isUuid(input.planId) ? input.planId : planning.getCurrentPlan(userId)?.planId;
      if (!planId) throw new ApiError('PLAN_NOT_FOUND', '没有可开始的方案', 404);
      let scene = isUuid(input.sceneId) ? scenes.get(userId, input.sceneId) : scenes.current(userId);
      if (!scene) throw new ApiError('SCENE_NOT_FOUND', '没有可播放的场景', 404);
      if (scene.status === 'draft') scene = await scenes.handOff(userId, scene.sceneConfigId);
      return { planId, sceneConfigId: scene.sceneConfigId };
    },
  };
}

const qualifiesForFeedback = (session: SessionRecord) => session.startedAt !== null && session.endedAt !== null
  && (session.stopReason === 'timer_completed' || session.stopReason === 'user_ended');

export function sessionFactsForGrowth(sessions: SleepSessionService): SessionFactsPort {
  return {
    async latestCompleted(userId) {
      const latest = sessions.listHistory(userId, 30).filter(qualifiesForFeedback)
        .sort((a, b) => String(b.endedAt).localeCompare(String(a.endedAt)))[0];
      return latest ? { id: latest.sessionId, userId, endedAt: String(latest.endedAt), source: 'module4' } satisfies SessionFact : null;
    },
    async isCompletedForUser(sessionId, userId) {
      try {
        return qualifiesForFeedback(sessions.getSessionFacts(sessionId, userId).session);
      } catch {
        return false;
      }
    },
  };
}

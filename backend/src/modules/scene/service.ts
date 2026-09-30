import { randomUUID } from 'node:crypto';
import { SceneRepository } from './repository.ts';
import {
  SceneError,
  type SceneAudioSource,
  type SceneSnapshot,
  type SceneSpaceType,
} from './types.ts';
import { parseCreateScene, parseSceneSnapshot } from './validator.ts';

export interface ConfirmedPlanTrack {
  contentId: string;
  volume: number;
  loopMode: 'once' | 'loop';
}

export interface ConfirmedPlan {
  planId: string;
  userId: string;
  tracks: ConfirmedPlanTrack[];
}

export type PlanQueryFailure = 'not_found' | 'forbidden' | 'not_confirmed';

export class PlanQueryUnavailable extends Error {
  constructor(readonly failure: PlanQueryFailure) {
    super(failure);
  }
}

export interface PlanQueryService {
  getConfirmedPlan(planId: string, userId: string): Promise<ConfirmedPlan>;
}

export interface CatalogAsset {
  assetId: string;
  playable: boolean;
  allowedSpaceTypes: SceneSpaceType[];
}

export interface ResolvedContent {
  contentId: string;
  assetId: string;
}

export interface ContentCatalogService {
  validateAssets(assetIds: string[], userId: string): Promise<CatalogAsset[]>;
  resolveContentIds(contentIds: string[], userId: string): Promise<ResolvedContent[]>;
}

interface AssetUse {
  assetId: string;
  spaceType: SceneSpaceType;
  contentId?: string;
}

export class SceneService {
  private readonly idempotentResults = new Map<string, SceneSnapshot>();

  constructor(
    private readonly repository: SceneRepository,
    private readonly plans: PlanQueryService,
    private readonly catalog: ContentCatalogService,
  ) {}

  async create(userId: string, unknownInput: unknown, idempotencyKey?: string): Promise<SceneSnapshot> {
    const key = this.cacheKey(userId, 'create', idempotencyKey);
    const cached = this.recall(key);
    if (cached) return cached;
    const input = parseCreateScene(unknownInput);
    const sources = input.sourcePlanId
      ? await this.sourcesFromPlan(input.sourcePlanId, userId, input.spaceType)
      : [];
    const now = new Date().toISOString();
    const draft = this.repository.createDraft(userId, input, now);
    if (sources.length === 0) return this.remember(key, draft);
    const saved = this.repository.replaceDraftSnapshot(draft.sceneConfigId, userId, {
      spaceType: input.spaceType,
      environmentType: input.environmentType,
      reverbType: input.reverbType,
      sources,
      elements: [],
    }, now);
    return this.remember(key, saved);
  }

  get(userId: string, sceneConfigId: string): SceneSnapshot {
    return this.repository.getOwnedSnapshot(sceneConfigId, userId);
  }

  getSceneSnapshot(sceneConfigId: string, userId: string): SceneSnapshot {
    return this.repository.getHandedOffSnapshot(sceneConfigId, userId);
  }

  async save(userId: string, sceneConfigId: string, unknownInput: unknown, idempotencyKey?: string): Promise<SceneSnapshot> {
    const key = this.cacheKey(userId, 'save', idempotencyKey, sceneConfigId);
    const cached = this.recall(key);
    if (cached) return cached;
    const input = parseSceneSnapshot(unknownInput);
    const current = this.repository.getOwnedSnapshot(sceneConfigId, userId);
    if (current.status === 'handed_off') throw new SceneError('SCENE_ALREADY_HANDED_OFF', '已交接的场景不能再修改', 409);
    if (current.status !== 'draft') throw new SceneError('SCENE_STATUS_CONFLICT', '当前状态不能保存', 409);
    await this.assertAssetsCompatible(userId, [...input.sources, ...input.elements]);
    const saved = this.repository.replaceDraftSnapshot(sceneConfigId, userId, input, new Date().toISOString());
    return this.remember(key, saved);
  }

  async handOff(userId: string, sceneConfigId: string, idempotencyKey?: string): Promise<SceneSnapshot> {
    const key = this.cacheKey(userId, 'hand-off', idempotencyKey, sceneConfigId);
    const cached = this.recall(key);
    if (cached) return cached;
    const current = this.repository.getOwnedSnapshot(sceneConfigId, userId);
    if (current.status === 'handed_off') return this.remember(key, this.repository.handOff(sceneConfigId, userId, new Date().toISOString()));
    if (!current.sources.some((source) => source.enabled)) {
      throw new SceneError('SCENE_NO_ENABLED_SOURCE', '交接前至少需要一个启用的声源', 409);
    }
    await this.assertAssetsCompatible(userId, [...current.sources, ...current.elements]);
    return this.remember(key, this.repository.handOff(sceneConfigId, userId, new Date().toISOString()));
  }

  copy(userId: string, sceneConfigId: string, idempotencyKey?: string): SceneSnapshot {
    const key = this.cacheKey(userId, 'copy', idempotencyKey, sceneConfigId);
    const cached = this.recall(key);
    if (cached) return cached;
    return this.remember(key, this.repository.copyAsNextVersion(sceneConfigId, userId, new Date().toISOString()));
  }

  eraseUserData(userId: string): number {
    return this.repository.eraseUserData(userId);
  }

  private async sourcesFromPlan(planId: string, userId: string, spaceType: SceneSpaceType): Promise<SceneAudioSource[]> {
    const plan = await this.loadConfirmedPlan(planId, userId);
    for (const track of plan.tracks) {
      if (track.volume < 0 || track.volume > 1) {
        throw new SceneError('INVALID_REQUEST', '方案轨道音量超出范围', 400, [{ contentId: track.contentId }]);
      }
    }
    if (plan.tracks.length === 0) return [];
    const resolved = await this.catalog.resolveContentIds(plan.tracks.map((track) => track.contentId), userId);
    const assetByContent = new Map(resolved.map((item) => [item.contentId, item.assetId]));
    const sources: SceneAudioSource[] = [];
    for (const track of plan.tracks) {
      const assetId = assetByContent.get(track.contentId);
      if (!assetId) throw new SceneError('SCENE_ASSET_UNAVAILABLE', '素材不可用', 409, [{ contentId: track.contentId }]);
      sources.push({
        sourceId: randomUUID(),
        assetId,
        spaceType,
        volume: track.volume,
        loopMode: track.loopMode,
        fadeInSec: 0,
        fadeOutSec: 0,
        enabled: true,
      });
    }
    await this.assertAssetsCompatible(userId, sources);
    return sources;
  }

  private async loadConfirmedPlan(planId: string, userId: string): Promise<ConfirmedPlan> {
    try {
      return await this.plans.getConfirmedPlan(planId, userId);
    } catch (error) {
      if (error instanceof PlanQueryUnavailable) this.raisePlanFailure(error.failure);
      throw error;
    }
  }

  private raisePlanFailure(failure: PlanQueryFailure): never {
    if (failure === 'not_found') throw new SceneError('PLAN_NOT_FOUND', '方案不存在', 404);
    if (failure === 'forbidden') throw new SceneError('PLAN_FORBIDDEN', '不能读取其他用户的方案', 403);
    throw new SceneError('PLAN_NOT_CONFIRMED', '只有已确认方案可以生成场景', 409);
  }

  private async assertAssetsCompatible(userId: string, items: AssetUse[]): Promise<void> {
    const assetIds = [...new Set(items.map((item) => item.assetId))];
    if (assetIds.length === 0) return;
    const assets = await this.catalog.validateAssets(assetIds, userId);
    const byId = new Map(assets.map((asset) => [asset.assetId, asset]));
    const unavailable = new Set<string>();
    const incompatible: AssetUse[] = [];
    for (const item of items) {
      const asset = byId.get(item.assetId);
      if (!asset?.playable) {
        unavailable.add(item.assetId);
        continue;
      }
      if (!asset.allowedSpaceTypes.includes(item.spaceType)) incompatible.push(item);
    }
    if (unavailable.size > 0) {
      throw new SceneError('SCENE_ASSET_UNAVAILABLE', '素材不可用', 409, [...unavailable].map((assetId) => ({ assetId })));
    }
    if (incompatible.length > 0) {
      throw new SceneError('SCENE_SPACE_INCOMPATIBLE', '素材与空间不兼容', 409, incompatible.map((item) => ({
        assetId: item.assetId,
        spaceType: item.spaceType,
      })));
    }
  }

  private cacheKey(userId: string, operation: string, idempotencyKey: string | undefined, targetId = '-'): string | null {
    const trimmed = idempotencyKey?.trim();
    if (!trimmed) return null;
    return `${operation}:${userId}:${targetId}:${trimmed}`;
  }

  private recall(key: string | null): SceneSnapshot | undefined {
    if (!key) return undefined;
    return this.idempotentResults.get(key);
  }

  private remember(key: string | null, snapshot: SceneSnapshot): SceneSnapshot {
    if (key) this.idempotentResults.set(key, snapshot);
    return snapshot;
  }
}

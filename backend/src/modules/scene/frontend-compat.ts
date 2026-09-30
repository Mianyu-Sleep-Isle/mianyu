import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SceneService } from './service.ts';
import { SceneError, type SceneAudioSource, type SceneElement, type SceneSnapshot, type SceneSnapshotInput, type SceneSpaceType } from './types.ts';

export interface SceneAssetInfo { contentId: string; name: string; assetPath: string | null; defaultSpace: SceneSpaceType }

// Module 1 lookups needed to translate the page's display IDs (A03) to asset UUIDs and back.
export interface SceneAssetDirectory {
  resolveAssetId(idOrAssetId: string): string | undefined;
  describe(assetId: string): SceneAssetInfo | undefined;
}

const environments: Record<string, { name: string; spaceType: SceneSpaceType; reverbType: string }> = {
  bedroom: { name: '我的睡前小屋', spaceType: 'indoor', reverbType: 'indoor_soft' },
  rain_yard: { name: '雨夜小院', spaceType: 'outdoor', reverbType: 'outdoor_open' },
};

const spaceType = z.enum(['indoor', 'outdoor']);
const frontendSourceSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  track: z.object({ asset_id: z.string().trim().min(1).max(64) }).passthrough(),
  space: spaceType.optional(),
  x: z.number().finite().default(50),
  y: z.number().finite().default(50),
  volume: z.number().min(0).max(1).default(0.6),
  enabled: z.boolean().default(true),
}).passthrough();

export const frontendSceneSchema = z.object({
  id: z.string().max(64).optional(),
  name: z.string().max(64).optional(),
  space_type: spaceType.optional(),
  environment_type: z.string().trim().min(1).max(64).optional(),
  sources: z.array(frontendSourceSchema).max(32),
}).passthrough();

export type FrontendSceneInput = z.infer<typeof frontendSceneSchema>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: string | undefined): value is string => Boolean(value && uuidPattern.test(value));

// Page coordinates are percentages; values within 0..1 are treated as already normalised.
const toUnit = (value: number) => Math.min(1, Math.max(0, value > 1 ? value / 100 : value));
const toPercent = (value: number) => Math.round(value * 10000) / 100;

export function toSnapshotInput(dto: FrontendSceneInput, assets: SceneAssetDirectory): SceneSnapshotInput {
  const environmentType = dto.environment_type ?? (dto.name === environments.rain_yard?.name || dto.space_type === 'outdoor' ? 'rain_yard' : 'bedroom');
  const environment = environments[environmentType];
  const sceneSpace = dto.space_type ?? environment?.spaceType ?? 'indoor';
  const sources: SceneAudioSource[] = [];
  const elements: Array<Omit<SceneElement, 'elementId'>> = [];
  const unavailable: Array<{ assetId: string }> = [];
  const clientIds = new Set<string>();
  dto.sources.forEach((item, index) => {
    const assetId = assets.resolveAssetId(item.track.asset_id);
    if (!assetId) {
      unavailable.push({ assetId: item.track.asset_id });
      return;
    }
    const itemSpace = item.space ?? assets.describe(assetId)?.defaultSpace ?? sceneSpace;
    const sourceId = randomUUID();
    let clientElementId = item.id ?? item.track.asset_id;
    if (clientIds.has(clientElementId)) clientElementId = `${clientElementId.slice(0, 56)}#${index}`;
    clientIds.add(clientElementId);
    sources.push({ sourceId, assetId, spaceType: itemSpace, volume: item.volume, loopMode: 'loop', fadeInSec: 0, fadeOutSec: 0, enabled: item.enabled });
    elements.push({ clientElementId, assetId, sourceId, spaceType: itemSpace, positionX: toUnit(item.x), positionY: toUnit(item.y), scale: 1, zOrder: index });
  });
  if (unavailable.length > 0) throw new SceneError('SCENE_ASSET_UNAVAILABLE', '素材不可用', 409, unavailable);
  return {
    spaceType: sceneSpace,
    environmentType,
    reverbType: environment?.reverbType ?? (sceneSpace === 'outdoor' ? 'outdoor_open' : 'indoor_soft'),
    sources,
    elements,
  };
}

// Canonical camelCase fields stay in place; the snake_case aliases serve frontend-api.
export function toFrontendScene(snapshot: SceneSnapshot, assets: SceneAssetDirectory) {
  return {
    ...snapshot,
    id: snapshot.sceneConfigId,
    name: environments[snapshot.environmentType]?.name ?? snapshot.environmentType,
    version: snapshot.configVersion,
    sources: snapshot.sources.map((source) => {
      const element = snapshot.elements.find((item) => item.sourceId === source.sourceId);
      const info = assets.describe(source.assetId);
      return {
        ...source,
        id: element?.clientElementId ?? source.sourceId,
        track: {
          asset_id: info?.contentId ?? source.assetId,
          name: info?.name ?? source.assetId,
          asset_path: info?.assetPath ?? null,
          default_space: info?.defaultSpace ?? source.spaceType,
        },
        space: source.spaceType,
        x: element ? toPercent(element.positionX) : 50,
        y: element ? toPercent(element.positionY) : 50,
      };
    }),
  };
}

// PUT /scenes/current: edit the given or latest draft; a handed-off scene is copied first.
export async function saveCurrentDraft(service: SceneService, userId: string, body: unknown, assets: SceneAssetDirectory, idempotencyKey?: string): Promise<SceneSnapshot> {
  const dto = frontendSceneSchema.parse(body);
  const input = toSnapshotInput(dto, assets);
  let target = isUuid(dto.id) ? service.get(userId, dto.id) : service.current(userId);
  if (target && target.status !== 'draft') target = service.copy(userId, target.sceneConfigId);
  if (!target) target = await service.create(userId, { spaceType: input.spaceType, environmentType: input.environmentType, reverbType: input.reverbType });
  return service.save(userId, target.sceneConfigId, input, idempotencyKey);
}

import type {
  SceneAudioSource,
  SceneConfig,
  SceneElement,
  SceneLoopMode,
  SceneSnapshot,
  SceneSpaceType,
  SceneStatus,
} from './types.ts';

export type SqlRow = Record<string, string | number | bigint | null>;

function cell(row: SqlRow, key: string): string | number | bigint | null | undefined {
  return row[key];
}

function requiredText(row: SqlRow, key: string): string {
  const value = cell(row, key);
  if (typeof value !== 'string') throw new Error(`场景字段 ${key} 不是文本`);
  return value;
}

function nullableText(row: SqlRow, key: string): string | null {
  const value = cell(row, key);
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error(`场景字段 ${key} 不是文本`);
  return value;
}

function requiredNumber(row: SqlRow, key: string): number {
  const value = cell(row, key);
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  throw new Error(`场景字段 ${key} 不是数字`);
}

function requiredStatus(row: SqlRow): SceneStatus {
  const value = requiredText(row, 'status');
  if (value === 'draft' || value === 'handed_off' || value === 'retired') return value;
  throw new Error(`未知场景状态 ${value}`);
}

function requiredSpace(row: SqlRow, key: string): SceneSpaceType {
  const value = requiredText(row, key);
  if (value === 'indoor' || value === 'outdoor') return value;
  throw new Error(`未知空间类型 ${value}`);
}

function requiredLoop(row: SqlRow): SceneLoopMode {
  const value = requiredText(row, 'loop_mode');
  if (value === 'once' || value === 'loop' || value === 'intermittent') return value;
  throw new Error(`未知循环方式 ${value}`);
}

export function mapSceneConfig(row: SqlRow): SceneConfig {
  return {
    sceneConfigId: requiredText(row, 'scene_config_id'),
    sceneFamilyId: requiredText(row, 'scene_family_id'),
    configVersion: requiredNumber(row, 'config_version'),
    previousVersionId: nullableText(row, 'previous_version_id'),
    userId: requiredText(row, 'user_id'),
    sourcePlanId: nullableText(row, 'source_plan_id'),
    presetSceneId: nullableText(row, 'preset_scene_id'),
    status: requiredStatus(row),
    spaceType: requiredSpace(row, 'space_type'),
    environmentType: requiredText(row, 'environment_type'),
    reverbType: requiredText(row, 'reverb_type'),
    handedOffAt: nullableText(row, 'handed_off_at'),
    createdAt: requiredText(row, 'created_at'),
    updatedAt: requiredText(row, 'updated_at'),
  };
}

export function mapSceneAudioSource(row: SqlRow): SceneAudioSource {
  return {
    sourceId: requiredText(row, 'source_id'),
    assetId: requiredText(row, 'asset_id'),
    spaceType: requiredSpace(row, 'space_type'),
    volume: requiredNumber(row, 'volume'),
    loopMode: requiredLoop(row),
    fadeInSec: requiredNumber(row, 'fade_in_sec'),
    fadeOutSec: requiredNumber(row, 'fade_out_sec'),
    enabled: requiredNumber(row, 'enabled') === 1,
  };
}

export function mapSceneElement(row: SqlRow): SceneElement {
  return {
    elementId: requiredText(row, 'element_id'),
    clientElementId: requiredText(row, 'client_element_id'),
    assetId: requiredText(row, 'asset_id'),
    sourceId: nullableText(row, 'source_id'),
    spaceType: requiredSpace(row, 'space_type'),
    positionX: requiredNumber(row, 'position_x'),
    positionY: requiredNumber(row, 'position_y'),
    scale: requiredNumber(row, 'scale'),
    zOrder: requiredNumber(row, 'z_order'),
  };
}

export function toSceneSnapshot(config: SceneConfig, sources: SceneAudioSource[], elements: SceneElement[]): SceneSnapshot {
  return { ...config, sources, elements };
}

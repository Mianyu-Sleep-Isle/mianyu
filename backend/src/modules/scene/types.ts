export type SceneStatus = 'draft' | 'handed_off' | 'retired';
export type SceneSpaceType = 'indoor' | 'outdoor';
export type SceneLoopMode = 'once' | 'loop' | 'intermittent';

export type SceneErrorCode =
  | 'SCENE_NOT_FOUND'
  | 'SCENE_FORBIDDEN'
  | 'SCENE_ALREADY_HANDED_OFF'
  | 'SCENE_STATUS_CONFLICT'
  | 'SCENE_NO_ENABLED_SOURCE'
  | 'SCENE_ASSET_UNAVAILABLE'
  | 'SCENE_SPACE_INCOMPATIBLE'
  | 'PLAN_NOT_FOUND'
  | 'PLAN_FORBIDDEN'
  | 'PLAN_NOT_CONFIRMED'
  | 'INVALID_REQUEST'
  | 'IDENTITY_REQUIRED';

export interface SceneAudioSource {
  sourceId: string;
  assetId: string;
  spaceType: SceneSpaceType;
  volume: number;
  loopMode: SceneLoopMode;
  fadeInSec: number;
  fadeOutSec: number;
  enabled: boolean;
}

export interface SceneElement {
  elementId: string;
  clientElementId: string;
  assetId: string;
  sourceId: string | null;
  spaceType: SceneSpaceType;
  positionX: number;
  positionY: number;
  scale: number;
  zOrder: number;
}

export interface SceneConfig {
  sceneConfigId: string;
  sceneFamilyId: string;
  configVersion: number;
  previousVersionId: string | null;
  userId: string;
  sourcePlanId: string | null;
  presetSceneId: string | null;
  status: SceneStatus;
  spaceType: SceneSpaceType;
  environmentType: string;
  reverbType: string;
  handedOffAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SceneSnapshot extends SceneConfig {
  sources: SceneAudioSource[];
  elements: SceneElement[];
}

export interface CreateSceneInput {
  sourcePlanId?: string | undefined;
  presetSceneId?: string | undefined;
  spaceType: SceneSpaceType;
  environmentType: string;
  reverbType: string;
}

export interface SceneSnapshotInput {
  spaceType: SceneSpaceType;
  environmentType: string;
  reverbType: string;
  sources: SceneAudioSource[];
  elements: Array<Omit<SceneElement, 'elementId'>>;
}

export class SceneError extends Error {
  constructor(
    public readonly code: SceneErrorCode,
    message: string,
    public readonly status: number,
    public readonly details: unknown[] = [],
  ) {
    super(message);
  }
}

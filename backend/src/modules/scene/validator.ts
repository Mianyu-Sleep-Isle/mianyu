import { createSceneSchema, sceneSnapshotSchema } from './schema.ts';
import type { CreateSceneInput, SceneSnapshotInput } from './types.ts';

export function parseCreateScene(input: unknown): CreateSceneInput {
  return createSceneSchema.parse(input);
}

export function parseSceneSnapshot(input: unknown): SceneSnapshotInput {
  return sceneSnapshotSchema.parse(input);
}

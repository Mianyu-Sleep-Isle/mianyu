import { z } from 'zod';

const uuid = z.uuid();
const spaceType = z.enum(['indoor', 'outdoor']);
const loopMode = z.enum(['once', 'loop', 'intermittent']);

export const createSceneSchema = z.object({
  sourcePlanId: uuid.optional(),
  presetSceneId: uuid.optional(),
  spaceType: spaceType.default('indoor'),
  environmentType: z.string().trim().min(1).max(64).default('bedroom'),
  reverbType: z.string().trim().min(1).max(64).default('indoor_soft'),
}).strict().superRefine((value, ctx) => {
  if (value.sourcePlanId && value.presetSceneId) {
    ctx.addIssue({ code: 'custom', path: ['presetSceneId'], message: '方案和预设不能同时作为场景来源' });
  }
});

const sourceSchema = z.object({
  sourceId: uuid,
  assetId: uuid,
  spaceType,
  volume: z.number().min(0).max(1),
  loopMode,
  fadeInSec: z.number().int().min(0),
  fadeOutSec: z.number().int().min(0),
  enabled: z.boolean(),
}).strict();

const elementSchema = z.object({
  clientElementId: z.string().trim().min(1).max(64),
  assetId: uuid,
  sourceId: uuid.nullable().default(null),
  spaceType,
  positionX: z.number().min(0).max(1),
  positionY: z.number().min(0).max(1),
  scale: z.number().positive(),
  zOrder: z.number().int().min(0),
}).strict();

export const sceneSnapshotSchema = z.object({
  spaceType,
  environmentType: z.string().trim().min(1).max(64),
  reverbType: z.string().trim().min(1).max(64),
  sources: z.array(sourceSchema),
  elements: z.array(elementSchema),
}).strict().superRefine((value, ctx) => {
  const sourceIds = new Set<string>();
  value.sources.forEach((source, index) => {
    if (sourceIds.has(source.sourceId)) {
      ctx.addIssue({ code: 'custom', path: ['sources', index, 'sourceId'], message: '声源编号重复' });
    }
    sourceIds.add(source.sourceId);
  });
  const clientIds = new Set<string>();
  value.elements.forEach((element, index) => {
    if (clientIds.has(element.clientElementId)) {
      ctx.addIssue({ code: 'custom', path: ['elements', index, 'clientElementId'], message: '元素编号重复' });
    }
    clientIds.add(element.clientElementId);
    if (element.sourceId && !sourceIds.has(element.sourceId)) {
      ctx.addIssue({ code: 'custom', path: ['elements', index, 'sourceId'], message: '元素绑定的声源不在本次快照中' });
    }
  });
});

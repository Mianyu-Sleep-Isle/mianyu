export const DRAMA_STAGES = [
  'generating_story',
  'reviewing',
  'generating_storyboard',
  'generating_character_reference',
  'generating_images',
  'synthesizing_voice',
  'composing_video',
] as const;

export type DramaStage = (typeof DRAMA_STAGES)[number];
export type DramaJobStatus = 'queued' | 'running' | 'cancelling' | 'completed' | 'failed' | 'cancelled';
export type DramaStageDetail = 'waiting_gpu' | 'loading_model' | 'running' | 'retrying';
export type StageRowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export const STAGE_WEIGHTS: Record<DramaStage, number> = {
  generating_story: 10,
  reviewing: 5,
  generating_storyboard: 5,
  generating_character_reference: 10,
  generating_images: 40,
  synthesizing_voice: 15,
  composing_video: 15,
};

export const SHOT_STAGES = new Set<DramaStage>(['generating_images', 'synthesizing_voice']);

const STAGE_INDEX = new Map(DRAMA_STAGES.map((stage, index) => [stage, index]));

export function stagesFrom(start: DramaStage | null): DramaStage[] {
  const index = start ? STAGE_INDEX.get(start) ?? 0 : 0;
  return DRAMA_STAGES.slice(index);
}

export function isForwardMove(from: DramaStage | null, to: DramaStage): boolean {
  if (!from) return to === 'generating_story';
  const left = STAGE_INDEX.get(from);
  const right = STAGE_INDEX.get(to);
  return left !== undefined && right !== undefined && right >= left;
}

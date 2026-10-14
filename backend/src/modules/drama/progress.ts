import { DRAMA_STAGES, SHOT_STAGES, STAGE_WEIGHTS, type DramaStage, type StageRowStatus } from './state-machine.ts';

export function computeProgress(
  stageStatus: ReadonlyMap<DramaStage, StageRowStatus>,
  current: DramaStage | null,
  done: number,
  total: number,
): number {
  let value = 0;
  for (const stage of DRAMA_STAGES) {
    const status = stageStatus.get(stage);
    if (status === 'completed' || status === 'skipped') {
      value += STAGE_WEIGHTS[stage];
      continue;
    }
    if (stage === current && total > 0) value += Math.floor((STAGE_WEIGHTS[stage] * done) / total);
    break;
  }
  return Math.min(100, value);
}

export function stageFraction(stage: DramaStage | null, done: number, total: number): { done: number; total: number } | null {
  if (!stage || !SHOT_STAGES.has(stage) || total <= 0) return null;
  return { done, total };
}

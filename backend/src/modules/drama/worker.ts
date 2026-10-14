import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { DramaCalls } from './providers/fake.ts';
import { boardFromTemplate, negativePrompt, presetBytes, stylePrompt } from './providers/fake.ts';
import { silentWav } from './providers/tts.ts';
import type { GpuSupervisor, ImageProvider, LlmProvider, TtsProvider, VideoComposer } from './providers/types.ts';
import { ProviderError } from './providers/types.ts';
import { computeProgress } from './progress.ts';
import { deterministicReview } from './review.ts';
import type { DramaRepository, JobRecord, ShotRecord } from './repository.ts';
import { stageError } from './prompts.ts';
import { stagesFrom, type DramaStage, type StageRowStatus } from './state-machine.ts';
import { templateByTheme } from './templates.ts';

export interface WorkerInjection {
  failStage?: DramaStage;
  failTimes: number;
  unsafeStory?: boolean;
}

export interface DramaWorkerDeps {
  repo: DramaRepository;
  calls: DramaCalls;
  dataDir: string;
  presetPath: string;
  llm: LlmProvider;
  images: ImageProvider;
  tts: TtsProvider;
  composer: VideoComposer;
  gpu: GpuSupervisor;
  injection?: WorkerInjection;
  beforeStage?: (stage: DramaStage, jobId: string) => void | Promise<void>;
}

export class DramaWorker {
  private busy = false;
  private gpuHeld = false;
  private heartbeat: NodeJS.Timeout | undefined;

  constructor(private readonly deps: DramaWorkerDeps) {}

  async flush(): Promise<void> {
    while (await this.step()) { /* drain the in-memory queue */ }
  }

  async step(): Promise<boolean> {
    if (this.busy) return false;
    const job = this.deps.repo.claimNext();
    if (!job) return false;
    this.busy = true;
    try {
      await this.run(job);
    } finally {
      this.busy = false;
    }
    return true;
  }

  private async run(job: JobRecord): Promise<void> {
    const start = job.failed_stage ?? job.stage;
    try {
      for (const stage of stagesFrom(start)) {
        const current = this.deps.repo.stages(job.job_id).find((row) => row.stage_key === stage);
        if (current?.status === 'completed' || current?.status === 'skipped') continue;
        if (await this.cancelled(job.job_id, stage)) return;
        await this.attempt(job.job_id, stage);
        if (await this.cancelled(job.job_id, stage)) return;
      }
      const finished = this.deps.repo.mustGet(job.job_id);
      this.publish(job.job_id, null, 1, 1, {
        status: 'completed',
        stage: null,
        stage_detail: null,
        failed_stage: null,
        progress: 100,
        error_code: null,
        error_message: null,
        error_retryable: null,
        completed_at: new Date().toISOString(),
        video_duration_sec: finished.video_duration_sec,
        video_size_bytes: finished.video_size_bytes,
      });
    } catch (error) {
      if (this.deps.repo.mustGet(job.job_id).status === 'cancelled') return;
      const code = error instanceof ProviderError ? error.code : 'INTERNAL_ERROR';
      const message = error instanceof ProviderError ? error.message : '生成失败';
      const retryable = error instanceof ProviderError ? error.retryable : false;
      const failedStage = this.deps.repo.mustGet(job.job_id).stage ?? 'generating_story';
      this.deps.repo.markStage(job.job_id, failedStage, 'failed', false);
      this.publish(job.job_id, failedStage, 0, 1, {
        status: 'failed',
        stage: failedStage,
        stage_detail: null,
        failed_stage: failedStage,
        error_code: code,
        error_message: message,
        error_retryable: retryable,
      });
    } finally {
      this.stopHeartbeat();
      if (this.gpuHeld) {
        this.gpuHeld = false;
        this.deps.repo.setLock(null, null);
        await this.deps.gpu.endImages().catch(() => undefined);
      }
    }
  }

  private async attempt(jobId: string, stage: DramaStage): Promise<void> {
    let tries = 0;
    while (tries < 3) {
      this.deps.repo.markStage(jobId, stage, 'running', true);
      this.publish(jobId, stage, 0, 1, { status: 'running', stage, stage_detail: tries ? 'retrying' : 'running', failed_stage: null, error_code: null, error_message: null, error_retryable: null });
      try {
        this.consumeInjection(stage);
        await this.execute(jobId, stage);
        this.deps.repo.markStage(jobId, stage, 'completed', false);
        const map = this.stageMap(jobId);
        map.set(stage, 'completed');
        this.publish(jobId, stage, 1, 1, { stage, stage_detail: 'running', progress: computeProgress(map, stage, 1, 1) });
        return;
      } catch (error) {
        tries += 1;
        const injected = error instanceof ProviderError && error.injected;
        if (tries < 3) continue;
        if (!injected && await this.fallback(jobId, stage)) {
          this.deps.repo.markStage(jobId, stage, 'completed', false);
          const map = this.stageMap(jobId);
          map.set(stage, 'completed');
          this.publish(jobId, stage, 1, 1, { stage, stage_detail: 'running', progress: computeProgress(map, stage, 1, 1) });
          return;
        }
        throw error instanceof ProviderError ? error : new ProviderError(stageError(stage).code, stageError(stage).message);
      }
    }
  }

  private async fallback(jobId: string, stage: DramaStage): Promise<boolean> {
    const job = this.deps.repo.mustGet(jobId);
    if (stage === 'generating_story' || stage === 'reviewing') {
      const template = templateByTheme(job.brief.theme);
      this.deps.repo.addNotice(jobId, 'STORY_TEMPLATE_FALLBACK');
      this.deps.repo.patchJob(jobId, {
        title: template.title, summary: template.summary, narration: template.narration, story_source: 'template', review_status: 'approved',
      });
      return true;
    }
    if (stage === 'generating_storyboard') {
      const template = templateByTheme(job.brief.theme);
      const drafted = boardFromTemplate(template, job.brief.shot_count);
      const durations = allocateDurations(drafted.length, job.brief.duration_sec);
      this.deps.repo.replaceShots(jobId, drafted.map((shot, index) => ({
        shot_order: index + 1,
        duration_sec: durations[index] ?? 12,
        narration_text: shot.narration_text,
        image_prompt: stylePrompt(job.brief.visual_style, job.brief.protagonist, shot.image_prompt),
        negative_prompt: negativePrompt(shot.negative_prompt, job.brief.forbidden_elements),
        transition: 'fade',
        camera_motion: shot.camera_motion,
        seed: job.seed + index + 1,
        image_status: 'pending',
        audio_status: 'pending',
      })));
      return true;
    }
    if (stage === 'generating_character_reference') {
      const dir = path.join(this.deps.dataDir, jobId);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'character.png'), presetBytes(this.deps.presetPath));
      this.deps.repo.addNotice(jobId, 'CHARACTER_PRESET_FALLBACK');
      return true;
    }
    return false;
  }

  private consumeInjection(stage: DramaStage): void {
    const injection = this.deps.injection;
    if (!injection?.failStage || injection.failStage !== stage || injection.failTimes <= 0) return;
    injection.failTimes -= 1;
    const mapped = stageError(stage);
    throw new ProviderError(mapped.code, mapped.message, mapped.retryable, true);
  }

  private async execute(jobId: string, stage: DramaStage): Promise<void> {
    if (stage === 'generating_story') await this.writeStory(jobId);
    else if (stage === 'reviewing') await this.reviewStory(jobId);
    else if (stage === 'generating_storyboard') await this.writeBoard(jobId);
    else if (stage === 'generating_character_reference' || stage === 'generating_images') await this.draw(jobId, stage);
    else if (stage === 'synthesizing_voice') await this.speak(jobId);
    else await this.compose(jobId);
  }

  private async writeStory(jobId: string): Promise<void> {
    const job = this.deps.repo.mustGet(jobId);
    const draft = await this.deps.llm.story(job.brief);
    this.deps.repo.patchJob(jobId, { title: draft.title, summary: draft.summary, narration: draft.narration, story_source: 'llm', review_status: 'pending' });
  }

  private async reviewStory(jobId: string): Promise<void> {
    let job = this.deps.repo.mustGet(jobId);
    let narration = job.narration ?? '';
    let title = job.title ?? '';
    let summary = job.summary ?? '';
    for (let rewrite = 0; rewrite < 3; rewrite += 1) {
      const verdict = deterministicReview({ narration, prompts: [], forbidden: job.brief.forbidden_elements, shotCount: null, actualShots: null });
      if (verdict.approved && !this.deps.injection?.unsafeStory) break;
      if (rewrite === 2 || (verdict.approved && this.deps.injection?.unsafeStory)) {
        const template = templateByTheme(job.brief.theme);
        narration = template.narration;
        title = template.title;
        summary = template.summary;
        this.deps.repo.addNotice(jobId, 'STORY_TEMPLATE_FALLBACK');
        this.deps.repo.patchJob(jobId, { title, summary, narration, story_source: 'template', review_status: 'approved' });
        return;
      }
      const draft = await this.deps.llm.story(job.brief, verdict.rewriteAdvice || verdict.reasons[0] || '改成更安静的睡前故事');
      narration = draft.narration;
      title = draft.title;
      summary = draft.summary;
    }
    const finalVerdict = deterministicReview({ narration, prompts: [], forbidden: job.brief.forbidden_elements, shotCount: null, actualShots: null });
    if (!finalVerdict.approved) {
      const template = templateByTheme(job.brief.theme);
      this.deps.repo.addNotice(jobId, 'STORY_TEMPLATE_FALLBACK');
      this.deps.repo.patchJob(jobId, {
        title: template.title, summary: template.summary, narration: template.narration, story_source: 'template', review_status: 'approved',
      });
      return;
    }
    this.deps.repo.patchJob(jobId, { title, summary, narration, story_source: job.story_source ?? 'llm', review_status: 'approved' });
  }

  private async writeBoard(jobId: string): Promise<void> {
    const job = this.deps.repo.mustGet(jobId);
    const narration = job.narration ?? templateByTheme(job.brief.theme).narration;
    const drafted = await this.deps.llm.storyboard(narration, job.brief.shot_count, job.brief.forbidden_elements);
    const durations = allocateDurations(drafted.length || job.brief.shot_count, job.brief.duration_sec);
    const shots: ShotRecord[] = drafted.map((shot, index) => ({
      shot_order: index + 1,
      duration_sec: durations[index] ?? 12,
      narration_text: shot.narration_text,
      image_prompt: stylePrompt(job.brief.visual_style, job.brief.protagonist, shot.image_prompt),
      negative_prompt: negativePrompt(shot.negative_prompt, job.brief.forbidden_elements),
      transition: 'fade',
      camera_motion: shot.camera_motion,
      seed: job.seed + index + 1,
      image_status: 'pending',
      audio_status: 'pending',
    }));
    this.deps.repo.replaceShots(jobId, shots);
  }

  private async draw(jobId: string, stage: 'generating_character_reference' | 'generating_images'): Promise<void> {
    if (!this.gpuHeld) {
      this.publish(jobId, stage, 0, 1, { stage_detail: 'waiting_gpu' });
      await this.deps.gpu.beginImages(jobId, stage);
      this.gpuHeld = true;
      this.deps.repo.setLock(jobId, stage);
      this.startHeartbeat(jobId, stage);
    }
    this.requireApproved(jobId);
    const job = this.deps.repo.mustGet(jobId);
    const dir = path.join(this.deps.dataDir, jobId);
    mkdirSync(dir, { recursive: true });
    if (stage === 'generating_character_reference') {
      try {
        const image = await this.deps.images.character(
          stylePrompt(job.brief.visual_style, job.brief.protagonist, 'character sheet, front view, standing, simple warm background'),
          job.seed,
        );
        writeFileSync(path.join(dir, 'character.png'), image);
      } catch {
        writeFileSync(path.join(dir, 'character.png'), presetBytes(this.deps.presetPath));
        this.deps.repo.addNotice(jobId, 'CHARACTER_PRESET_FALLBACK');
      }
      return;
    }
    const shots = this.deps.repo.shots(jobId);
    let retried = false;
    for (const [index, shot] of shots.entries()) {
      if (await this.cancelled(jobId, stage)) return;
      let saved = false;
      for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
        try {
          const image = await this.deps.images.shot(shot.image_prompt, shot.negative_prompt, shot.seed + (1000 * attempt), attempt ? 640 : 768, attempt ? 1136 : 1344);
          const name = `shot-${String(shot.shot_order).padStart(3, '0')}.jpg`;
          writeFileSync(path.join(dir, name), image);
          writeFileSync(path.join(dir, `thumb-${String(shot.shot_order).padStart(3, '0')}.jpg`), image);
          if (index === 0) writeFileSync(path.join(dir, 'cover.jpg'), image);
          this.deps.repo.updateShot(jobId, shot.shot_order, { image_status: 'completed' });
          saved = true;
          if (attempt > 0) retried = true;
        } catch {
          this.deps.repo.updateShot(jobId, shot.shot_order, { image_status: 'failed' });
        }
      }
      if (!saved) throw new ProviderError('IMAGE_GENERATION_FAILED', '画面生成失败');
      this.publish(jobId, stage, index + 1, shots.length, { stage_detail: 'running' });
    }
    if (retried) this.deps.repo.addNotice(jobId, 'SHOT_IMAGE_RETRIED');
    this.deps.repo.setLock(null, null);
    await this.deps.gpu.endImages();
    this.gpuHeld = false;
  }

  private async speak(jobId: string): Promise<void> {
    this.requireApproved(jobId);
    const shots = this.deps.repo.shots(jobId);
    const dir = path.join(this.deps.dataDir, jobId);
    mkdirSync(dir, { recursive: true });
    let silent = 0;
    for (const [index, shot] of shots.entries()) {
      if (await this.cancelled(jobId, 'synthesizing_voice')) return;
      let spoken = false;
      for (let attempt = 0; attempt < 3 && !spoken; attempt += 1) {
        try {
          const audio = await this.deps.tts.synthesize(shot.narration_text);
          writeFileSync(path.join(dir, `voice-${String(shot.shot_order).padStart(3, '0')}.wav`), audio);
          spoken = true;
        } catch { /* next attempt */ }
      }
      if (!spoken) {
        silent += 1;
        writeFileSync(path.join(dir, `voice-${String(shot.shot_order).padStart(3, '0')}.wav`), silentWav(8));
      }
      this.deps.repo.updateShot(jobId, shot.shot_order, { audio_status: spoken ? 'completed' : 'failed' });
      this.publish(jobId, 'synthesizing_voice', index + 1, shots.length, { stage_detail: 'running' });
    }
    if (silent >= 3) throw new ProviderError('TTS_GENERATION_FAILED', '旁白生成失败');
  }

  private async compose(jobId: string): Promise<void> {
    this.requireApproved(jobId);
    const shots = this.deps.repo.shots(jobId);
    const dir = path.join(this.deps.dataDir, jobId);
    const rendered = await this.deps.composer.compose({
      jobDir: dir,
      shots: shots.map((shot) => ({ order: shot.shot_order, durationSec: shot.duration_sec, cameraMotion: shot.camera_motion, narrationText: shot.narration_text })),
    });
    this.deps.repo.patchJob(jobId, { video_duration_sec: rendered.durationSec, video_size_bytes: rendered.sizeBytes });
  }

  private requireApproved(jobId: string): void {
    if (this.deps.repo.mustGet(jobId).review_status !== 'approved') {
      throw new ProviderError('STORY_REVIEW_REJECTED', '故事没有通过审核', false);
    }
  }

  private startHeartbeat(jobId: string, stage: string): void {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => this.deps.repo.setLock(jobId, stage), 15_000);
    this.heartbeat.unref();
  }

  private stopHeartbeat(): void {
    if (!this.heartbeat) return;
    clearInterval(this.heartbeat);
    this.heartbeat = undefined;
  }

  private async cancelled(jobId: string, stage: DramaStage): Promise<boolean> {
    await this.deps.beforeStage?.(stage, jobId);
    const job = this.deps.repo.mustGet(jobId);
    if (job.status !== 'cancelling' && job.status !== 'cancelled') return false;
    this.publish(jobId, stage, 0, 1, { status: 'cancelled', stage_detail: null });
    return true;
  }

  private stageMap(jobId: string): Map<DramaStage, StageRowStatus> {
    return new Map(this.deps.repo.stages(jobId).map((row) => [row.stage_key, row.status]));
  }

  private publish(jobId: string, stage: DramaStage | null, done: number, total: number, patch: Parameters<DramaRepository['patchJob']>[1]): void {
    const map = this.stageMap(jobId);
    if (stage) map.set(stage, map.get(stage) === 'completed' ? 'completed' : 'running');
    const progress = patch.progress ?? computeProgress(map, stage, done, total);
    this.deps.repo.patchJob(jobId, { ...patch, progress });
    this.deps.calls.progress.push(this.deps.repo.mustGet(jobId).progress);
  }
}

export function allocateDurations(count: number, total: number): number[] {
  if (count <= 0) return [];
  const base = Math.min(25, Math.max(8, Math.floor(total / count)));
  const durations = Array.from({ length: count }, () => base);
  let drift = total - (base * count);
  for (let index = count - 1; index >= 0 && drift !== 0; index -= 1) {
    const room = drift > 0 ? 25 - (durations[index] ?? 8) : (durations[index] ?? 8) - 8;
    const step = Math.sign(drift) * Math.min(Math.abs(drift), room);
    durations[index] = (durations[index] ?? base) + step;
    drift -= step;
  }
  const last = durations.length - 1;
  if (last >= 0 && durations[last] !== undefined) durations[last] = (durations[last] ?? 0) + drift;
  return durations;
}

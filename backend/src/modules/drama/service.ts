import { rmSync } from 'node:fs';
import path from 'node:path';
import { ApiError } from '../../shared/http.ts';
import { mediaPath, signMedia } from './media-sign.ts';
import { stageFraction } from './progress.ts';
import { crisisHit, fieldUnsafe } from './review.ts';
import type { BriefRecord, DramaRepository, JobRecord, ShotRecord } from './repository.ts';
import type { DramaCalls } from './providers/fake.ts';
import type { GuideDraft, LlmProvider } from './providers/types.ts';
import { ProviderError } from './providers/types.ts';
import type { DramaStage } from './state-machine.ts';
import { lighthouseTemplate } from './templates.ts';
import type { DramaWorker } from './worker.ts';

const PHONE = /1\d{10}/;
const MISSING_ORDER = ['theme', 'mood', 'setting'] as const;

export interface ShowcaseShot { order: number; narration_text: string; duration_sec: number }
export interface ShowcaseFile {
  job_id: string;
  title: string;
  summary: string;
  narration: string;
  story_source: 'llm' | 'template';
  duration_sec: number;
  size_bytes: number;
  created_at: string;
  shots: ShowcaseShot[];
}

export interface DramaRuntime {
  enabled: boolean;
  mode: 'fake' | 'real';
  repo: DramaRepository;
  worker: DramaWorker;
  llm: LlmProvider;
  calls: DramaCalls;
  dataDir: string;
  signingSecret: string;
  mediaTtlSec: number;
  showcase: ShowcaseFile[];
  llmReady?: () => Promise<'ready' | 'busy' | 'down'>;
  mediaReady?: () => Promise<'ready' | 'degraded' | 'down'>;
}

export class DramaService {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly runtime: DramaRuntime) {}

  capabilities(ageMode: 'adult' | 'child', userId: string) {
    const active = this.runtime.repo.findActiveByUser(userId);
    return {
      enabled: this.runtime.enabled,
      age_mode_allowed: ageMode === 'adult',
      llm: 'ready' as const,
      media_pipeline: 'ready' as const,
      queue_length: this.runtime.repo.countActive(),
      active_job_id: active?.job_id ?? null,
      max_user_rounds: 6,
      duration_options_sec: [90, 120, 150],
      shot_count_options: [6, 7, 8],
      visual_styles: [
        { id: 'watercolor', label: '水彩绘本' },
        { id: 'paper_cut', label: '剪纸夜景' },
        { id: 'soft_anime', label: '柔和动画' },
        { id: 'oil_pastel', label: '油画棒' },
      ],
      voice: { id: 'default', label: '默认旁白（温和女声）' },
    };
  }

  async capabilitiesLive(ageMode: 'adult' | 'child', userId: string) {
    const base = this.capabilities(ageMode, userId);
    if (this.runtime.mode === 'fake') return base;
    const llm = this.runtime.llmReady ? await this.runtime.llmReady() : 'down';
    const media = this.runtime.mediaReady ? await this.runtime.mediaReady() : 'down';
    return { ...base, llm, media_pipeline: media };
  }

  async chat(userId: string, input: { messages: Array<{ role: 'user' | 'assistant'; content: string }> }) {
    this.guardEnabled();
    this.limit(userId);
    const round = input.messages.filter((message) => message.role === 'user').length;
    if (round > 6) throw new ApiError('DRAMA_CHAT_ROUND_LIMIT', '对话已经足够了，可以直接生成故事', 400);
    this.assertTurns(input.messages);
    let draft: GuideDraft;
    try {
      draft = await this.runtime.llm.chat(input.messages, null);
    } catch (error) {
      throw this.llmError(error);
    }
    if (round >= 6) {
      draft = {
        ...draft,
        theme: draft.theme || '一个安静的小故事',
        mood: draft.mood ?? 'calm',
        setting: draft.setting || '安静的小屋',
        reply: /[?？]/.test(draft.reply) ? '这些就够了，可以生成故事了。' : draft.reply,
      };
    }
    const missing = MISSING_ORDER.filter((field) => !draft[field]);
    return {
      reply: draft.reply.slice(0, 120),
      guide_state: {
        theme: draft.theme,
        mood: draft.mood,
        setting: draft.setting,
        protagonist: draft.protagonist,
        visual_style: draft.visual_style,
        forbidden_elements: draft.forbidden_elements.slice(0, 8),
        missing,
      },
      suggestions: draft.suggestions.slice(0, 4).map((item) => [...item].slice(0, 10).join('')),
      ready: missing.length === 0,
      round,
      rounds_left: 6 - round,
    };
  }

  async brief(userId: string, input: { messages: Array<{ role: 'user' | 'assistant'; content: string }> }) {
    this.guardEnabled();
    this.limit(userId);
    const round = input.messages.filter((message) => message.role === 'user').length;
    if (round > 6) throw new ApiError('DRAMA_CHAT_ROUND_LIMIT', '对话已经足够了，可以直接生成故事', 400);
    const text = input.messages.map((message) => message.content).join('\n');
    if (crisisHit(text)) throw new ApiError('PRODUCT_BOUNDARY_CRISIS', '本产品不能提供危机干预，请立即联系可信任的人或当地紧急援助', 400, []);
    let brief: BriefRecord;
    try {
      brief = await this.runtime.llm.brief(input.messages, null);
    } catch (error) {
      throw this.llmError(error);
    }
    const phone = PHONE.test(text);
    const cleaned = phone ? stripPhone(brief) : brief;
    if (phone) cleaned.privacy_replacements = ['已替换联系方式'];
    const missing = (['theme', 'mood', 'setting'] as const).filter((field) => !cleaned[field]);
    if (missing.length) throw new ApiError('DRAMA_BRIEF_INCOMPLETE', '还差一点信息', 422, missing.map((field) => ({ field })));
    const unsafe = fieldUnsafe({ theme: cleaned.theme, setting: cleaned.setting, protagonist: cleaned.protagonist });
    if (unsafe) throw new ApiError('DRAMA_BRIEF_UNSAFE', '这部分内容不适合睡前故事', 422, [{ field: unsafe }]);
    return { brief: cleaned };
  }

  createJob(userId: string, idempotencyKey: string | undefined, brief: BriefRecord): { status: 200 | 202; job: ReturnType<DramaService['jobDto']> } {
    this.guardEnabled();
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
      throw new ApiError('IDEMPOTENCY_KEY_REQUIRED', '生成请求无效，请重试', 400);
    }
    const existing = this.runtime.repo.findIdempotent(userId, idempotencyKey);
    if (existing) return { status: 200, job: this.jobDto(existing) };
    const unsafe = fieldUnsafe({
      theme: brief.theme, setting: brief.setting, protagonist: brief.protagonist, forbidden: brief.forbidden_elements.join(' '),
    });
    if (unsafe) throw new ApiError('DRAMA_BRIEF_UNSAFE', '这部分内容不适合睡前故事', 422, [{ field: unsafe === 'forbidden' ? 'forbidden_elements' : unsafe }]);
    const active = this.runtime.repo.findActiveByUser(userId);
    if (active) throw new ApiError('DRAMA_JOB_ALREADY_RUNNING', '你已有一个故事正在生成', 409, [{ job_id: active.job_id }]);
    if (this.runtime.repo.countActive() >= 3) throw new ApiError('DRAMA_QUEUE_FULL', '现在排队的人有点多，请几分钟后再试', 503);
    const job = this.runtime.repo.create({ userId, brief, idempotencyKey, seed: Math.floor(Math.random() * 1_000_000) });
    return { status: 202, job: this.jobDto(job) };
  }

  list(userId: string, limit: number) {
    return { items: this.runtime.repo.listForUser(userId, limit).map((job) => this.summary(job)) };
  }

  get(userId: string, jobId: string) {
    return this.jobDto(this.mustOwn(userId, jobId));
  }

  cancel(userId: string, jobId: string) {
    const job = this.mustOwn(userId, jobId);
    if (job.status === 'queued') this.runtime.repo.patchJob(jobId, { status: 'cancelled', stage_detail: null });
    else if (job.status === 'running') this.runtime.repo.patchJob(jobId, { status: 'cancelling' });
    else throw new ApiError('DRAMA_JOB_INVALID_STATE', '当前状态不能执行此操作', 409);
    return this.jobDto(this.runtime.repo.mustGet(jobId));
  }

  retry(userId: string, jobId: string) {
    const job = this.mustOwn(userId, jobId);
    if (job.status !== 'failed') throw new ApiError('DRAMA_JOB_INVALID_STATE', '当前状态不能执行此操作', 409);
    if (job.manual_retry_count >= 3 || job.error_retryable === false) throw new ApiError('DRAMA_RETRY_LIMIT', '已多次重试仍未成功，建议重新创建', 409);
    const other = this.runtime.repo.findActiveByUser(userId);
    if (other) throw new ApiError('DRAMA_JOB_ALREADY_RUNNING', '你已有一个故事正在生成', 409, [{ job_id: other.job_id }]);
    const stage = job.failed_stage;
    if (stage) this.runtime.repo.markStage(jobId, stage, 'pending', false);
    this.runtime.repo.patchJob(jobId, {
      status: 'queued',
      stage,
      failed_stage: stage,
      error_code: null,
      error_message: null,
      error_retryable: null,
      manual_retry_count: job.manual_retry_count + 1,
    });
    return this.jobDto(this.runtime.repo.mustGet(jobId));
  }

  result(userId: string, jobId: string) {
    const job = this.mustOwn(userId, jobId);
    if (job.status !== 'completed' || !job.title || !job.summary || !job.narration || !job.story_source) {
      throw new ApiError('DRAMA_RESULT_NOT_READY', '故事还在生成中', 409);
    }
    return this.resultDto({
      jobId: job.job_id,
      showcase: false,
      title: job.title,
      summary: job.summary,
      narration: job.narration,
      storySource: job.story_source,
      durationSec: job.video_duration_sec ?? job.brief.duration_sec,
      sizeBytes: job.video_size_bytes ?? 0,
      createdAt: job.created_at,
      shots: this.runtime.repo.shots(job.job_id).map((shot, index, all) => ({
        order: shot.shot_order,
        narration_text: shot.narration_text,
        duration_sec: shot.duration_sec,
        start_sec: all.slice(0, index).reduce((sum, item) => sum + item.duration_sec, 0),
      })),
    });
  }

  showcase() {
    const items = (this.runtime.showcase.length ? this.runtime.showcase : [fallbackShowcase()]).map((item) => this.resultDto({
      jobId: item.job_id,
      showcase: true,
      title: item.title,
      summary: item.summary,
      narration: item.narration,
      storySource: item.story_source,
      durationSec: item.duration_sec,
      sizeBytes: item.size_bytes,
      createdAt: item.created_at,
      shots: item.shots.map((shot, index, all) => ({
        ...shot,
        start_sec: all.slice(0, index).reduce((sum, itemShot) => sum + itemShot.duration_sec, 0),
      })),
    }));
    return { items };
  }

  remove(userId: string, jobId: string) {
    const job = this.mustOwn(userId, jobId);
    if (job.status === 'queued' || job.status === 'running' || job.status === 'cancelling') {
      throw new ApiError('DRAMA_JOB_INVALID_STATE', '当前状态不能执行此操作', 409);
    }
    this.runtime.repo.deleteJob(jobId);
    rmSync(path.join(this.runtime.dataDir, jobId), { recursive: true, force: true });
    return { deleted: true };
  }

  eraseUser(userId: string): number {
    const ids = this.runtime.repo.jobIdsForUser(userId);
    const count = this.runtime.repo.deleteUser(userId);
    for (const jobId of ids) rmSync(path.join(this.runtime.dataDir, jobId), { recursive: true, force: true });
    return count;
  }

  private jobDto(job: JobRecord) {
    const shots = this.runtime.repo.shots(job.job_id);
    const current = this.currentShot(job, shots);
    return {
      id: job.job_id,
      status: job.status,
      stage: job.status === 'completed' ? null : job.stage,
      stage_detail: job.stage_detail,
      failed_stage: job.status === 'failed' ? job.failed_stage : null,
      progress: job.progress,
      stage_progress: stageFraction(job.stage, current.done, current.total),
      stages: this.runtime.repo.stages(job.job_id).map((stage) => ({ key: stage.stage_key, status: stage.status })),
      queue_position: this.runtime.repo.queuePosition(job),
      title: job.review_status === 'approved' ? job.title : null,
      story_source: job.story_source,
      brief: job.brief,
      shots: shots.map((shot) => ({
        order: shot.shot_order,
        image_status: shot.image_status,
        audio_status: shot.audio_status,
        thumbnail_url: shot.image_status === 'completed' ? this.signed(job.job_id, `thumb-${String(shot.shot_order).padStart(3, '0')}.jpg`) : null,
      })),
      notices: job.notices,
      error: job.status === 'failed' && job.error_code && job.error_message ? { code: job.error_code, message: job.error_message, retryable: job.error_retryable !== false } : null,
      can_cancel: job.status === 'queued' || job.status === 'running',
      can_retry: job.status === 'failed' && job.manual_retry_count < 3 && job.error_retryable !== false,
      created_at: job.created_at,
      updated_at: job.updated_at,
      completed_at: job.completed_at,
    };
  }

  private summary(job: JobRecord) {
    return {
      id: job.job_id,
      status: job.status,
      stage: job.status === 'completed' ? null : job.stage,
      progress: job.progress,
      title: job.title,
      cover_url: job.status === 'completed' ? this.signed(job.job_id, 'cover.jpg') : null,
      duration_sec: job.video_duration_sec,
      created_at: job.created_at,
      completed_at: job.completed_at,
    };
  }

  private resultDto(input: {
    jobId: string;
    showcase: boolean;
    title: string;
    summary: string;
    narration: string;
    storySource: 'llm' | 'template';
    durationSec: number;
    sizeBytes: number;
    createdAt: string;
    shots: Array<{ order: number; narration_text: string; duration_sec: number; start_sec: number }>;
  }) {
    const exp = Math.floor(Date.now() / 1000) + this.runtime.mediaTtlSec;
    return {
      job_id: input.jobId,
      is_showcase: input.showcase,
      title: input.title,
      summary: input.summary,
      narration: input.narration,
      story_source: input.storySource,
      ai_generated: true as const,
      duration_sec: input.durationSec,
      video: { url: this.signed(input.jobId, 'final.mp4', exp), mime: 'video/mp4' as const, width: 720 as const, height: 1280 as const, size_bytes: input.sizeBytes },
      cover_url: this.signed(input.jobId, 'cover.jpg', exp),
      subtitles_url: this.signed(input.jobId, 'subtitles.vtt', exp),
      shots: input.shots.map((shot) => ({
        order: shot.order,
        image_url: this.signed(input.jobId, `shot-${String(shot.order).padStart(3, '0')}.jpg`, exp),
        narration_text: shot.narration_text,
        start_sec: shot.start_sec,
        duration_sec: shot.duration_sec,
      })),
      media_expires_at: new Date(exp * 1000).toISOString(),
      created_at: input.createdAt,
    };
  }

  private signed(jobId: string, fileName: string, exp = Math.floor(Date.now() / 1000) + this.runtime.mediaTtlSec): string {
    if (!this.runtime.signingSecret) throw new ApiError('INTERNAL_ERROR', '媒体签名未配置', 500);
    return mediaPath(jobId, fileName, exp, signMedia(this.runtime.signingSecret, jobId, fileName, exp));
  }

  private currentShot(job: JobRecord, shots: ShotRecord[]): { done: number; total: number } {
    if (!shots.length) return { done: 0, total: 0 };
    if (job.stage === 'generating_images') return { done: shots.filter((shot) => shot.image_status === 'completed').length, total: shots.length };
    if (job.stage === 'synthesizing_voice') return { done: shots.filter((shot) => shot.audio_status === 'completed').length, total: shots.length };
    return { done: 0, total: shots.length };
  }

  private mustOwn(userId: string, jobId: string): JobRecord {
    const job = this.runtime.repo.getForUser(jobId, userId);
    if (!job) throw new ApiError('DRAMA_JOB_NOT_FOUND', '没有找到这个故事', 404);
    return job;
  }

  private guardEnabled(): void {
    if (!this.runtime.enabled) throw new ApiError('DRAMA_DISABLED', '故事短片功能暂未开放', 503);
  }

  private limit(userId: string): void {
    const now = Date.now();
    const recent = (this.hits.get(userId) ?? []).filter((stamp) => now - stamp < 60_000);
    if (recent.length >= 10) throw new ApiError('DRAMA_RATE_LIMITED', '说得有点快了，稍等几秒再试', 429);
    recent.push(now);
    this.hits.set(userId, recent);
  }

  private assertTurns(messages: Array<{ role: string }>): void {
    if (messages[0]?.role !== 'user' || messages[messages.length - 1]?.role !== 'user') {
      throw new ApiError('INVALID_REQUEST', '请求字段不合法', 400);
    }
    for (let index = 1; index < messages.length; index += 1) {
      if (messages[index]?.role === messages[index - 1]?.role) throw new ApiError('INVALID_REQUEST', '请求字段不合法', 400);
    }
  }

  private llmError(error: unknown): ApiError {
    if (error instanceof ApiError) return error;
    if (error instanceof ProviderError && error.code === 'LLM_UNAVAILABLE') {
      return new ApiError('LLM_UNAVAILABLE', 'AI 暂时不可用，可以先看看示例作品', 503, [{ reason: 'down', retry_after_sec: 30 }]);
    }
    return new ApiError('LLM_UNAVAILABLE', 'AI 暂时不可用，可以先看看示例作品', 503, [{ reason: 'down', retry_after_sec: 30 }]);
  }
}

function stripPhone(brief: BriefRecord): BriefRecord {
  const clean = (value: string) => value.replace(PHONE, '').trim();
  return { ...brief, theme: clean(brief.theme), setting: clean(brief.setting), protagonist: clean(brief.protagonist) };
}

function fallbackShowcase(): ShowcaseFile {
  const template = lighthouseTemplate();
  return {
    job_id: 'showcase-01',
    title: template.title,
    summary: template.summary,
    narration: template.narration,
    story_source: 'template',
    duration_sec: 120,
    size_bytes: 32,
    created_at: '2026-10-08T00:00:00.000Z',
    shots: template.shots.map((shot, index) => ({ order: index + 1, narration_text: shot.narrationText, duration_sec: 20 })),
  };
}

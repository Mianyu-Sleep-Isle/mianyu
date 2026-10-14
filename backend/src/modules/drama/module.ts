import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import type { Router } from 'express';
import type { UserService } from '../common/users.ts';
import {
  createCalls, createFakeComposer, createFakeGpu, createFakeImages, createFakeLlm, createFakeTts, type DramaCalls,
} from './providers/fake.ts';
import { assertFfmpeg } from './providers/ffmpeg.ts';
import { resolveLlmAvailability, type LlmConfig } from './providers/llm.ts';
import { createRealComposer, createRealImages, createRealLlm, createRealTts } from './providers/real.ts';
import { createRealGpu } from './gpu-supervisor.ts';
import { DramaRepository } from './repository.ts';
import { createDramaRouter, type MediaAccess } from './routes.ts';
import { DramaService, type ShowcaseFile } from './service.ts';
import { DramaWorker, type WorkerInjection } from './worker.ts';
import type { DramaStage } from './state-machine.ts';

export interface DramaModuleOptions {
  database: DatabaseSync;
  mode?: 'fake' | 'real';
  enabled?: boolean;
  dataDir?: string;
  showcaseDir?: string;
  signingSecret?: string;
  isolate?: boolean;
  injection?: WorkerInjection;
  hooks?: { beforeStage?: (stage: DramaStage, jobId: string) => void | Promise<void> };
  fetchImpl?: typeof fetch;
}

export interface DramaHandle {
  router: Router;
  service: DramaService;
  flush: () => Promise<void>;
  recover: () => void;
  dataDir: string;
  calls: DramaCalls;
  startWorker: () => void;
  mode: 'fake' | 'real';
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultTiny = path.resolve(moduleDir, '../../../fixtures/drama/tiny.mp4');
const defaultPreset = path.resolve(moduleDir, '../../../../deploy/assets/character-preset.png');
const defaultShowcase = path.resolve(moduleDir, '../../../fixtures/drama/showcase');

export function createDramaModule(options: DramaModuleOptions, users: UserService): DramaHandle {
  const mode = options.mode ?? 'fake';
  const dataDir = options.dataDir ?? (options.isolate === false ? path.resolve(moduleDir, '../../../data/drama-jobs') : mkdtempSync(path.join(tmpdir(), 'mianyu-drama-')));
  const showcaseDir = options.showcaseDir ?? defaultShowcase;
  const signingSecret = options.signingSecret ?? (mode === 'fake' ? 'test-media-secret' : '');
  const calls = createCalls();
  const repo = new DramaRepository(options.database);
  const llmConfig: LlmConfig = {
    baseUrl: process.env.LLM_BASE_URL || 'http://127.0.0.1:8081/v1',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'Qwen3.8-27B',
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  };
  const llm = mode === 'real'
    ? createRealLlm(llmConfig)
    : createFakeLlm({ unsafeStory: options.injection?.unsafeStory === true, calls });
  const workflowPath = path.resolve(moduleDir, '../../../../services/comfyui/workflows/flux_shot_api.json');
  const worker = new DramaWorker({
    repo,
    calls,
    dataDir,
    presetPath: defaultPreset,
    llm,
    images: mode === 'real' ? createRealImages({ baseUrl: process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188', workflowPath, ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}) }) : createFakeImages(calls),
    tts: mode === 'real' ? createRealTts(process.env.TTS_BASE_URL || 'http://127.0.0.1:9880', options.fetchImpl) : createFakeTts(calls),
    composer: mode === 'real' ? createRealComposer(process.env.FFMPEG_PATH || 'ffmpeg', path.resolve(moduleDir, '../../../../deploy/fonts/NotoSansSC-Regular.otf')) : createFakeComposer(defaultTiny),
    gpu: mode === 'real' ? createRealGpu({
      configPath: process.env.SUPERVISOR_CONFIG || '/hy-tmp/mianyu/deploy/supervisord.conf',
      llamaHealthUrl: 'http://127.0.0.1:8081/health',
      comfyHealthUrl: 'http://127.0.0.1:8188/system_stats',
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    }) : createFakeGpu(),
    ...(options.injection ? { injection: options.injection } : {}),
    ...(options.hooks?.beforeStage ? { beforeStage: options.hooks.beforeStage } : {}),
  });
  const service = new DramaService({
    enabled: options.enabled !== false,
    mode,
    repo,
    worker,
    llm,
    calls,
    dataDir,
    signingSecret,
    mediaTtlSec: Number(process.env.MEDIA_URL_TTL_SEC ?? 21600),
    showcase: loadShowcase(showcaseDir),
    llmReady: async () => resolveLlmAvailability({
      mode,
      gpuBusy: repo.gpuLockHeld(),
      textBusy: repo.textStageBusy(),
      healthOk: mode === 'fake' ? true : await probe(process.env.LLM_BASE_URL, options.fetchImpl),
    }),
    mediaReady: async () => {
      if (mode === 'fake') return 'ready';
      const ffmpeg = await assertFfmpeg(process.env.FFMPEG_PATH ?? 'ffmpeg');
      if (!ffmpeg) return 'down';
      const tts = await probe(process.env.TTS_BASE_URL, options.fetchImpl);
      return tts ? 'ready' : 'degraded';
    },
  });
  const media: MediaAccess = {
    secret: signingSecret,
    resolve(jobId, fileName) {
      const candidates = [path.join(dataDir, jobId, fileName), path.join(showcaseDir, jobId, fileName)];
      return candidates.find((candidate) => existsSync(candidate)) ?? null;
    },
  };
  let timer: NodeJS.Timeout | undefined;
  return {
    router: createDramaRouter(service, users, media),
    service,
    flush: () => worker.flush(),
    recover: () => {
      const running = repo.runningIds();
      repo.recover();
      for (const jobId of running) {
        if (!missingStageFile(dataDir, repo, jobId)) continue;
        const job = repo.mustGet(jobId);
        repo.patchJob(jobId, {
          status: 'failed',
          failed_stage: job.stage,
          error_code: 'JOB_INTERRUPTED',
          error_message: '生成被中断，可以从失败的阶段继续',
          error_retryable: true,
        });
      }
    },
    dataDir,
    calls,
    mode,
    startWorker() {
      if (timer) return;
      timer = setInterval(() => { void worker.step().catch((error) => console.error('[drama]', error)); }, 2000);
    },
  };
}

function missingStageFile(dataDir: string, repo: DramaRepository, jobId: string): boolean {
  for (const shot of repo.shots(jobId)) {
    const order = String(shot.shot_order).padStart(3, '0');
    if (shot.image_status === 'completed' && !existsSync(path.join(dataDir, jobId, `shot-${order}.jpg`))) return true;
    if (shot.audio_status === 'completed' && !existsSync(path.join(dataDir, jobId, `voice-${order}.wav`))) return true;
  }
  const video = repo.stages(jobId).find((stage) => stage.stage_key === 'composing_video');
  return video?.status === 'completed' && !existsSync(path.join(dataDir, jobId, 'final.mp4'));
}

function loadShowcase(directory: string): ShowcaseFile[] {
  const file = path.join(directory, 'showcase-01', 'result.json');
  if (!existsSync(file)) return [];
  return [JSON.parse(readFileSync(file, 'utf8')) as ShowcaseFile];
}

async function probe(baseUrl: string | undefined, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!baseUrl) return false;
  const root = baseUrl.replace(/\/$/, '').replace(/\/v1$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetchImpl(`${root}/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

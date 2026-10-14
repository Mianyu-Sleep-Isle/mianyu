import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DramaStage } from './state-machine.ts';
import type { GpuSupervisor } from './providers/types.ts';
import { ProviderError } from './providers/types.ts';

const exec = promisify(execFile);

export interface SupervisorConfig {
  configPath: string;
  llamaHealthUrl: string;
  comfyHealthUrl: string;
  fetchImpl?: typeof fetch;
}

async function run(file: string, args: string[]): Promise<void> {
  await exec(file, args, { windowsHide: true });
}

async function memoryUsed(): Promise<number[]> {
  const { stdout } = await exec('nvidia-smi', ['--query-gpu=memory.used', '--format=csv,noheader,nounits'], { windowsHide: true, encoding: 'utf8' });
  return stdout.split(/\r?\n/).map((line) => Number(line.trim())).filter((value) => Number.isFinite(value));
}

async function waitUntil(check: () => Promise<boolean>, timeoutMs: number, code: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new ProviderError(code, code === 'GPU_SERVICE_UNAVAILABLE' ? '绘图或配音服务启动失败' : '生成超时');
}

export function createRealGpu(config: SupervisorConfig): GpuSupervisor {
  const ctl = async (action: 'start' | 'stop', program: string) => {
    await run('supervisorctl', ['-c', config.configPath, action, program]);
  };
  const fetchImpl = config.fetchImpl ?? fetch;
  let holding = false;

  const restoreLlama = async () => {
    await ctl('stop', 'comfyui').catch(() => undefined);
    await waitUntil(async () => (await memoryUsed().catch(() => [9999])).every((value) => value < 1500), 90_000, 'GPU_STAGE_TIMEOUT').catch(() => undefined);
    await ctl('start', 'llamacpp');
    await waitUntil(async () => (await fetchImpl(config.llamaHealthUrl)).ok, 180_000, 'GPU_SERVICE_UNAVAILABLE');
  };

  return {
    async beginImages(jobId, stage: DramaStage) {
      void jobId;
      void stage;
      holding = true;
      try {
        await ctl('stop', 'llamacpp');
        await waitUntil(async () => (await memoryUsed()).every((value) => value < 1500), 90_000, 'GPU_STAGE_TIMEOUT');
        await ctl('start', 'comfyui');
        await waitUntil(async () => (await fetchImpl(config.comfyHealthUrl)).ok, 120_000, 'GPU_SERVICE_UNAVAILABLE');
      } catch (error) {
        await restoreLlama().catch(() => undefined);
        holding = false;
        throw error;
      }
    },
    async endImages() {
      if (!holding) return;
      try {
        await restoreLlama();
      } finally {
        holding = false;
      }
    },
  };
}

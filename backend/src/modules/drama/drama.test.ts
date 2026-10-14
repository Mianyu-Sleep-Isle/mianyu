import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { createApp } from '../../app.ts';
import { signMedia } from './media-sign.ts';
import { completeStructured } from './providers/llm.ts';
import { patchWorkflow, type WorkflowNode } from './providers/comfyui.ts';
import { subtitleFontReady, zoomExpression } from './providers/ffmpeg.ts';
import { hanCount } from './review.ts';
import { lighthouseTemplate } from './templates.ts';

type Json = Record<string, any>;
const servers: Server[] = [];

afterEach(async () => {
  while (servers.length) {
    const server = servers.pop();
    if (!server) continue;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

async function listen(app: ReturnType<typeof createApp>['app']): Promise<string> {
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
}

async function call(base: string, method: string, route: string, userId?: string, body?: unknown, key?: string): Promise<{ status: number; body: Json; headers: Headers }> {
  const headers: Record<string, string> = {};
  if (userId) headers['X-User-Id'] = userId;
  if (key) headers['Idempotency-Key'] = key;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${route}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) as Json : {} };
}

async function user(base: string, age: 'adult' | 'child' = 'adult'): Promise<string> {
  const created = await call(base, 'POST', '/users/anonymous', undefined, { age_mode: age });
  assert.equal(created.status, 201);
  return String(created.body.data.user_id);
}

const brief = {
  theme: '灯塔里看雨的猫', mood: 'calm', setting: '海边灯塔', protagonist: '一只橘猫',
  visual_style: 'watercolor', duration_sec: 120, shot_count: 6, forbidden_elements: [], voice_id: 'default', privacy_replacements: [],
};

test('儿童模式不能生成，能力接口仍返回', async () => {
  const built = createApp();
  const base = await listen(built.app);
  const child = await user(base, 'child');
  const caps = await call(base, 'GET', '/drama/capabilities', child);
  assert.equal(caps.status, 200);
  assert.equal(caps.body.data.age_mode_allowed, false);
  const chat = await call(base, 'POST', '/drama/chat', child, { messages: [{ role: 'user', content: '想听故事' }], guide_state: null });
  assert.equal(chat.status, 403);
  assert.equal(chat.body.error.code, 'DRAMA_CHILD_MODE_FORBIDDEN');
  built.database.close();
});

test('第 7 轮被拒绝，危机内容不回显也不入库', async () => {
  const built = createApp();
  const base = await listen(built.app);
  const adult = await user(base);
  const messages = Array.from({ length: 7 }, () => ({ role: 'user', content: '想听一个安静的故事' }));
  const limited = await call(base, 'POST', '/drama/chat', adult, { messages, guide_state: null });
  assert.equal(limited.status, 400);
  assert.equal(limited.body.error.code, 'DRAMA_CHAT_ROUND_LIMIT');
  const crisis = await call(base, 'POST', '/drama/chat', adult, { messages: [{ role: 'user', content: '我不想活了' }], guide_state: null });
  assert.equal(crisis.status, 400);
  assert.equal(crisis.body.error.code, 'PRODUCT_BOUNDARY_CRISIS');
  assert.deepEqual(crisis.body.error.details, []);
  assert.equal(JSON.stringify(crisis.body).includes('不想活'), false);
  const count = built.database.prepare('SELECT COUNT(*) AS count FROM drama_job').get() as { count: number };
  assert.equal(Number(count.count), 0);
  built.database.close();
});

test('幂等创建、重复任务和 fake 成片', async () => {
  const built = createApp();
  const base = await listen(built.app);
  const adult = await user(base);
  const first = await call(base, 'POST', '/drama/jobs', adult, { brief }, 'idem-drama-001');
  assert.equal(first.status, 202);
  assert.equal(first.body.data.status, 'queued');
  const again = await call(base, 'POST', '/drama/jobs', adult, { brief: { ...brief, theme: '另一件事' } }, 'idem-drama-001');
  assert.equal(again.status, 200);
  assert.equal(again.body.data.id, first.body.data.id);
  const second = await call(base, 'POST', '/drama/jobs', adult, { brief }, 'idem-drama-002');
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, 'DRAMA_JOB_ALREADY_RUNNING');
  assert.equal(second.body.error.details[0].job_id, first.body.data.id);
  await built.services.drama.flush();
  const progress = built.services.drama.calls.progress;
  assert.ok(progress.every((value: number, index: number) => index === 0 || value >= (progress[index - 1] ?? 0)));
  const done = await call(base, 'GET', `/drama/jobs/${first.body.data.id}`, adult);
  assert.equal(done.body.data.status, 'completed');
  assert.equal(done.body.data.story_source, 'llm');
  assert.equal(done.body.data.notices.includes('STORY_TEMPLATE_FALLBACK'), false);
  const result = await call(base, 'GET', `/drama/jobs/${first.body.data.id}/result`, adult);
  assert.match(result.body.data.video.url, /exp=\d+&sig=[0-9a-f]+/);
  const mediaRoute = String(result.body.data.video.url).replace(/^\/api\/v1/, '');
  const played = await fetch(`${base}${mediaRoute}`);
  assert.equal(played.status, 200);
  assert.match(played.headers.get('content-type') ?? '', /video\/mp4/);
  const broken = mediaRoute.replace(/sig=[0-9a-f]+/, 'sig=deadbeef');
  const denied = await call(base, 'GET', broken, adult);
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, 'MEDIA_LINK_EXPIRED');
  const escaped = await call(base, 'GET', `/drama/media/abc..secret/final.mp4?exp=1&sig=00`, adult);
  assert.equal(escaped.status, 403);
  assert.equal(escaped.body.error.code, 'MEDIA_LINK_EXPIRED');
  const exp = Math.floor(Date.now() / 1000) + 60;
  const missing = signMedia('test-media-secret', 'missing-job', 'final.mp4', exp);
  const absent = await call(base, 'GET', `/drama/media/missing-job/final.mp4?exp=${exp}&sig=${missing}`, adult);
  assert.equal(absent.status, 404);
  built.database.close();
});

test('不安全故事降级到模板，取消发生在出图之前', async () => {
  const unsafe = createApp({ drama: { injection: { failTimes: 0, unsafeStory: true } } });
  const base = await listen(unsafe.app);
  const adult = await user(base);
  const created = await call(base, 'POST', '/drama/jobs', adult, { brief }, 'idem-unsafe-001');
  await unsafe.services.drama.flush();
  const result = await call(base, 'GET', `/drama/jobs/${created.body.data.id}/result`, adult);
  const template = lighthouseTemplate();
  assert.equal(result.body.data.story_source, 'template');
  assert.equal(result.body.data.narration, template.narration);
  assert.equal(result.body.data.narration.includes('杀人'), false);
  const job = await call(base, 'GET', `/drama/jobs/${created.body.data.id}`, adult);
  assert.equal(job.body.data.notices.includes('STORY_TEMPLATE_FALLBACK'), true);
  assert.ok(unsafe.services.drama.calls.ttsTexts.every((text: string) => !text.includes('杀人') && template.narration.includes(text)));
  unsafe.database.close();

  let cancelApp: ReturnType<typeof createApp>;
  cancelApp = createApp({
    drama: {
      hooks: {
        beforeStage(stage: string, jobId: string) {
          if (stage !== 'generating_storyboard') return;
          const row = cancelApp.database.prepare('SELECT user_id FROM drama_job WHERE job_id = ?').get(jobId) as { user_id: string };
          cancelApp.services.drama.service.cancel(row.user_id, jobId);
        },
      },
    },
  });
  const cancelBase = await listen(cancelApp.app);
  const owner = await user(cancelBase);
  const jobCreated = await call(cancelBase, 'POST', '/drama/jobs', owner, { brief }, 'idem-cancel-001');
  await cancelApp.services.drama.flush();
  const cancelled = await call(cancelBase, 'GET', `/drama/jobs/${jobCreated.body.data.id}`, owner);
  assert.equal(cancelled.body.data.status, 'cancelled');
  assert.equal(cancelApp.services.drama.calls.images, 0);
  assert.equal(cancelApp.services.drama.calls.ttsTexts.length, 0);
  cancelApp.database.close();
});

test('中断恢复不回退阶段，删除用户时清掉成片目录', async () => {
  const built = createApp();
  const base = await listen(built.app);
  const adult = await user(base);
  const created = await call(base, 'POST', '/drama/jobs', adult, { brief }, 'idem-recover-001');
  const jobId = String(created.body.data.id);
  built.database.prepare(`UPDATE drama_job SET status = 'running', stage = 'generating_storyboard' WHERE job_id = ?`).run(jobId);
  built.database.prepare(`UPDATE drama_stage SET status = 'completed' WHERE job_id = ? AND stage_key = 'generating_story'`).run(jobId);
  built.services.drama.recover();
  const row = built.database.prepare(`SELECT status, stage FROM drama_job WHERE job_id = ?`).get(jobId) as { status: string; stage: string };
  const stage = built.database.prepare(`SELECT status FROM drama_stage WHERE job_id = ? AND stage_key = 'generating_story'`).get(jobId) as { status: string };
  assert.equal(row.status, 'queued');
  assert.equal(row.stage, 'generating_storyboard');
  assert.equal(stage.status, 'completed');
  built.database.prepare(`UPDATE drama_job SET status = 'cancelled' WHERE job_id = ?`).run(jobId);
  await built.services.drama.flush();
  const finished = await call(base, 'POST', '/drama/jobs', adult, { brief }, 'idem-erase-001');
  await built.services.drama.flush();
  const dir = path.join(built.services.drama.dataDir, String(finished.body.data.id));
  assert.equal(existsSync(dir), true);
  const erased = await call(base, 'DELETE', '/users/me/data', adult);
  assert.equal(erased.status, 200);
  assert.equal(existsSync(dir), false);
  const left = built.database.prepare('SELECT COUNT(*) AS count FROM drama_job WHERE user_id = ?').get(adult) as { count: number };
  assert.equal(Number(left.count), 0);
  built.database.close();
});

test('模板长度、工作流补丁和模型请求不离开本机', async () => {
  const template = lighthouseTemplate();
  const count = hanCount(template.narration);
  assert.ok(count >= 300 && count <= 600, String(count));
  const workflow: Record<string, WorkflowNode> = JSON.parse(readFileSync(new URL('../../../../services/comfyui/workflows/flux_shot_api.json', import.meta.url), 'utf8'));
  const patched = patchWorkflow(workflow, { positive: 'rain', negative: 'text', seed: 7, width: 768, height: 1344, filenamePrefix: 'drama-job-1' });
  assert.equal(patched['1']?.inputs?.text, 'rain');
  assert.equal(patched['3']?.inputs?.seed, 7);
  assert.equal(patched['4']?.inputs?.width, 768);
  assert.equal(zoomExpression('zoom_in', 30).z, 'min(1.08,1+0.0006*on)');
  assert.equal(subtitleFontReady(path.join('deploy', 'fonts', 'missing.otf')), false);
  const seen: Array<{ url: string; authorization: string; body: Json }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const body = JSON.parse(String(init?.body)) as Json;
    const headers = new Headers(init?.headers);
    seen.push({ url: String(input), authorization: headers.get('authorization') ?? '', body });
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const parsed = await completeStructured({
    baseUrl: 'http://127.0.0.1:9/v1', apiKey: 'test-key', model: 'local', fetchImpl,
  }, {
    temperature: 0.2, maxTokens: 20, timeoutMs: 1000, schemaName: 'demo', schema: { type: 'object' },
    messages: [{ role: 'user', content: 'hi' }],
  });
  assert.deepEqual(parsed, { ok: true });
  assert.equal(seen[0]?.url, 'http://127.0.0.1:9/v1/chat/completions');
  assert.equal(seen[0]?.authorization, 'Bearer test-key');
  assert.equal(seen[0]?.body.chat_template_kwargs.enable_thinking, false);
  assert.equal(seen[0]?.body.response_format.type, 'json_schema');
  assert.equal(String(seen[0]?.url).includes('gpushare'), false);
});

test('穿越路径不能读到目录外，缺文件的恢复标记为中断', async () => {
  const built = createApp();
  const base = await listen(built.app);
  const adult = await user(base);
  const origin = new URL(base);
  const status = await new Promise<number>((resolve, reject) => {
    const request = http.request({
      hostname: origin.hostname,
      port: origin.port,
      path: '/api/v1/drama/media/job/../final.mp4?exp=1&sig=00',
      method: 'GET',
      headers: { 'X-User-Id': adult },
    }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode ?? 0));
    });
    request.on('error', reject);
    request.end();
  });
  assert.ok(status === 403 || status === 404);

  const created = await call(base, 'POST', '/drama/jobs', adult, { brief }, 'idem-interrupt-001');
  const jobId = String(created.body.data.id);
  built.database.prepare(`UPDATE drama_job SET status = 'running', stage = 'generating_images' WHERE job_id = ?`).run(jobId);
  built.database.prepare(`INSERT INTO drama_shot(
    job_id, shot_order, duration_sec, narration_text, image_prompt, negative_prompt, transition, camera_motion, seed, image_status, audio_status
  ) VALUES (?, 1, 12, '安静', 'cat', 'text', 'fade', 'static', 1, 'completed', 'pending')`).run(jobId);
  built.services.drama.recover();
  const row = built.database.prepare(`SELECT status, error_code FROM drama_job WHERE job_id = ?`).get(jobId) as { status: string; error_code: string };
  assert.equal(row.status, 'failed');
  assert.equal(row.error_code, 'JOB_INTERRUPTED');
  built.database.close();
});

test('注入的阶段失败三次后可以接着重试', async () => {
  const built = createApp({ drama: { injection: { failStage: 'generating_images', failTimes: 3 } } });
  const base = await listen(built.app);
  const adult = await user(base);
  const created = await call(base, 'POST', '/drama/jobs', adult, { brief }, 'idem-retry-001');
  await built.services.drama.flush();
  const failed = await call(base, 'GET', `/drama/jobs/${created.body.data.id}`, adult);
  assert.equal(failed.body.data.status, 'failed');
  assert.equal(failed.body.data.failed_stage, 'generating_images');
  const retried = await call(base, 'POST', `/drama/jobs/${created.body.data.id}/retry`, adult, {});
  assert.equal(retried.status, 200);
  await built.services.drama.flush();
  const done = await call(base, 'GET', `/drama/jobs/${created.body.data.id}`, adult);
  assert.equal(done.body.data.status, 'completed');
  built.database.close();
});

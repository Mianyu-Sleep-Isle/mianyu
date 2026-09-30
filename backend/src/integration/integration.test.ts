import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, test } from 'node:test';
import { createApp } from '../app.ts';

type Json = Record<string, any>;
let server: Server;
let base: string;
let built: ReturnType<typeof createApp>;

beforeEach(async () => {
  built = createApp();
  server = built.app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  built.database.close();
});

let keySeq = 0;
async function call(method: string, path: string, userId?: string, body?: unknown): Promise<{ status: number; body: Json }> {
  const headers: Record<string, string> = { 'Idempotency-Key': `integration-${++keySeq}` };
  if (userId) headers['X-User-Id'] = userId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) as Json : {} };
}

const sceneDto = (sources: string[]) => ({
  id: 'scene-demo', name: '我的睡前小屋', status: 'draft', version: 1,
  sources: sources.map((assetId, index) => ({ id: `source-${assetId}`, track: { asset_id: assetId, name: assetId }, space: 'indoor', x: 22 + index * 26, y: 35, volume: 0.5, enabled: true })),
});

test('迁移按模块号顺序执行且可重复运行', () => {
  assert.deepEqual(built.migrations.map((item) => item.version), [10, 100, 200, 300, 400, 500]);
  const again = createApp({ database: built.database });
  assert.deepEqual(again.migrations, []);
  assert.deepEqual(built.database.prepare('PRAGMA foreign_key_check').all(), []);
});

test('跨模块主路径：匿名用户→方案→场景→会话→反馈→积分→档案→删除', async () => {
  const user = await call('POST', '/users/anonymous', undefined, { age_mode: 'adult' });
  assert.equal(user.status, 201);
  const userId = String(user.body.data.user_id);

  const plan = await call('POST', '/plans', userId, { emotion: 'wants_company', voice_preference: 'unspecified', available_minutes: 25, forbidden_tags: ['远雷'] });
  assert.equal(plan.status, 201);
  assert.equal(plan.body.data.duration_minutes, 20);
  assert.ok(plan.body.data.tracks.some((track: Json) => track.contentKind === 'story'));
  assert.ok(plan.body.data.tracks.every((track: Json) => track.asset_id !== 'A12' && typeof track.name === 'string'));
  const planId = String(plan.body.data.id);
  assert.equal((await call('POST', `/plans/${planId}/confirm`, userId)).body.data.status, 'confirmed');

  const saved = await call('PUT', '/scenes/current', userId, sceneDto(['A03', 'A04']));
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.status, 'draft');
  assert.deepEqual(saved.body.data.sources.map((source: Json) => source.track.asset_id).sort(), ['A03', 'A04']);
  assert.equal(saved.body.data.sources.find((source: Json) => source.track.asset_id === 'A03').x, 22);
  const sceneId = String(saved.body.data.id);
  const resaved = await call('PUT', '/scenes/current', userId, sceneDto(['A03']));
  assert.equal(resaved.body.data.id, sceneId);
  assert.equal((await call('GET', '/scenes/current', userId)).body.data.sources.length, 1);

  const prepared = await call('POST', '/sessions', userId, { plan_id: planId, scene_id: sceneId });
  assert.equal(prepared.status, 201);
  assert.equal(prepared.body.data.status, 'preparing');
  assert.equal(prepared.body.data.plan_id, planId);
  assert.equal(prepared.body.data.scene_id, sceneId);
  const sessionId = String(prepared.body.data.id);
  assert.equal((await call('GET', `/scenes/${sceneId}`, userId)).body.data.status, 'handed_off');
  assert.equal((await call('GET', `/plans/${planId}`, userId)).body.data.status, 'confirmed');
  const started = await call('POST', `/sessions/${sessionId}/start`, userId);
  assert.equal(started.body.data.status, 'running');
  assert.equal((await call('POST', `/sessions/${sessionId}/start`, userId)).body.data.status, 'running');
  assert.equal((await call('GET', `/plans/${planId}`, userId)).body.data.status, 'started');

  assert.equal((await call('POST', `/sessions/${sessionId}/pause`, userId)).body.data.status, 'paused');
  assert.equal((await call('POST', `/sessions/${sessionId}/resume`, userId)).body.data.status, 'running');
  const observed = await call('POST', `/sessions/${sessionId}/events`, userId, { type: 'track_started', payload: {} });
  assert.equal(observed.status, 201);
  assert.equal(observed.body.data.accepted, true);
  const stopped = await call('POST', `/sessions/${sessionId}/stop`, userId);
  assert.equal(stopped.body.data.status, 'cancelled');
  assert.equal(stopped.body.data.stopReason, 'user_ended');
  assert.equal((await call('POST', `/sessions/${sessionId}/stop`, userId)).status, 200);
  assert.equal((await call('GET', '/sessions/history', userId)).body.data[0].id, sessionId);

  const pending = await call('GET', '/feedback/pending', userId);
  assert.equal(pending.body.data.pending, true);
  assert.equal(pending.body.data.session.id, sessionId);
  const feedback = await call('POST', '/feedback', userId, { session_id: sessionId, fall_asleep_ease: 'easy', sound_comfort: 'comfortable', voice_next_time: 'avoid', forbidden_sound_tags: ['keyboard'] });
  assert.equal(feedback.status, 201);
  const points = await call('GET', '/points', userId);
  assert.equal(points.body.data.balance, 15);
  assert.deepEqual(points.body.data.entries.map((entry: Json) => entry.event_type).sort(), ['feedback_submitted', 'plan_started']);
  assert.equal((await call('GET', '/archive?period=7d', userId)).body.data.feedback_count, 1);
  assert.equal((await call('GET', '/feedback/pending', userId)).body.data.pending, false);

  const next = await call('POST', '/plans', userId, { emotion: 'calm', voice_preference: 'avoid', available_minutes: 30, forbidden_tags: [] });
  assert.ok(next.body.data.tracks.every((track: Json) => track.asset_id !== 'A10'));

  const erased = await call('DELETE', '/users/me/data', userId);
  assert.equal(erased.body.data.erased, true);
  assert.equal(erased.body.data.modules.session, 1);
  assert.equal((await call('GET', '/users/me', userId)).status, 401);
  for (const table of ['sleep_plan', 'scene_config', 'sleep_session', 'morning_feedback', 'points_ledger', 'preference_profile', 'user_profile']) {
    assert.equal(Number((built.database.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count), 0, table);
  }
});

test('计时完成走完所有阶段后方案标记为完成', async () => {
  const userId = String((await call('POST', '/users/anonymous', undefined, {})).body.data.user_id);
  const plan = await call('POST', '/plans', userId, { emotion: 'calm', voice_preference: 'avoid', available_minutes: 10, forbidden_tags: [] });
  const planId = String(plan.body.data.id);
  await call('POST', `/plans/${planId}/confirm`, userId);
  await call('PUT', '/scenes/current', userId, sceneDto(['A07']));
  const sessionId = String((await call('POST', '/sessions', userId, { plan_id: 'plan-demo', scene_id: 'scene-demo' })).body.data.id);
  await call('POST', `/sessions/${sessionId}/start`, userId);
  let facts = (await call('GET', `/sessions/${sessionId}`, userId)).body.data;
  assert.equal(facts.plan_id, planId);
  for (let guard = 0; facts.status === 'running' && guard < 6; guard++) {
    if (facts.currentStage === 'fade_out') await call('POST', `/sessions/${sessionId}/events`, userId, { type: 'volume_changed', payload: { volume: 0 } });
    facts = (await call('POST', `/sessions/${sessionId}/events`, userId, { type: 'stage_completed', payload: {} })).body.data.session;
  }
  assert.equal(facts.status, 'completed');
  assert.equal((await call('GET', `/plans/${planId}`, userId)).body.data.status, 'completed');
  assert.equal((await call('GET', '/feedback/pending', userId)).body.data.session.id, sessionId);
});

test('音频开始前退出不计分，也不能提交反馈', async () => {
  const userId = String((await call('POST', '/users/anonymous', undefined, {})).body.data.user_id);
  const planId = String((await call('POST', '/plans', userId, { emotion: 'anxious', voice_preference: 'avoid', available_minutes: 15, forbidden_tags: [] })).body.data.id);
  await call('POST', `/plans/${planId}/confirm`, userId);
  await call('PUT', '/scenes/current', userId, sceneDto(['A11']));
  const sessionId = String((await call('POST', '/sessions', userId, { plan_id: planId })).body.data.id);
  const stopped = await call('POST', `/sessions/${sessionId}/stop`, userId);
  assert.equal(stopped.body.data.stopReason, 'user_cancelled_before_start');
  assert.equal((await call('GET', '/points', userId)).body.data.balance, 0);
  assert.equal((await call('GET', '/feedback/pending', userId)).body.data.pending, false);
  const rejected = await call('POST', '/feedback', userId, { session_id: sessionId, fall_asleep_ease: 'easy', sound_comfort: 'comfortable', voice_next_time: 'unspecified' });
  assert.equal(rejected.status, 409);
  assert.equal(rejected.body.error.code, 'SESSION_NOT_COMPLETED');
});

test('内容目录、收藏与年龄限制', async () => {
  const userId = String((await call('POST', '/users/anonymous', undefined, { age_mode: 'child' })).body.data.user_id);
  const sounds = await call('GET', '/content?category=%E5%A3%B0%E9%9F%B3&age_mode=child', userId);
  assert.equal(sounds.body.data.length, 12);
  const stories = (await call('GET', '/content?category=%E6%95%85%E4%BA%8B&age_mode=child', userId)).body.data as Json[];
  assert.equal(stories.find((item) => item.id === 'ST01')?.age_mode, 'adult');
  assert.equal(stories.find((item) => item.id === 'ST04')?.age_mode, 'child');
  assert.equal((await call('GET', '/content/ST01/playable?age_mode=child', userId)).status, 403);
  assert.equal((await call('GET', '/content/A03/playable', userId)).body.data.url, 'assets/audio/indoor/A03_fireplace.mp3');
  assert.equal((await call('PUT', '/content/A01/favorite', userId, { favorite: true })).body.data.favorite, true);
  const favorites = await call('GET', '/content?category=%E6%94%B6%E8%97%8F&age_mode=child', userId);
  assert.deepEqual(favorites.body.data.map((item: Json) => item.id), ['A01']);
  assert.equal((await call('GET', '/content?category=unknown&age_mode=adult', userId)).status, 400);
});

test('公共身份、PIN 与统一错误包络', async () => {
  const userId = String((await call('POST', '/users/anonymous', undefined, {})).body.data.user_id);
  const updated = await call('PATCH', '/users/me', userId, { pin: '2468', non_medical_accepted: true });
  assert.equal(updated.body.data.pin_configured, true);
  assert.equal(updated.body.data.non_medical_accepted, true);
  assert.equal((await call('POST', '/auth/pin/verify', userId, { pin: '2468' })).body.data, true);
  assert.equal((await call('POST', '/auth/pin/verify', userId, { pin: '1357' })).body.data, false);
  assert.equal(JSON.stringify(built.database.prepare('SELECT * FROM user_profile').all()).includes('2468'), false);

  const missing = await call('GET', '/points');
  assert.equal(missing.status, 401);
  assert.equal(missing.body.error.code, 'UNAUTHORIZED');
  assert.match(String(missing.body.error.requestId), /^[0-9a-f-]{36}$/);
  const unknownRoute = await call('GET', '/nope', userId);
  assert.equal(unknownRoute.status, 404);
  assert.equal(unknownRoute.body.error.code, 'NOT_FOUND');
  const noSession = await call('POST', '/sessions/00000000-0000-4000-8000-000000000000/pause', userId);
  assert.equal(noSession.status, 404);
  assert.equal(noSession.body.error.code, 'NOT_FOUND');
  const noPlan = await call('POST', '/sessions', userId, {});
  assert.equal(noPlan.body.error.code, 'PLAN_NOT_FOUND');
  const badScene = await call('PUT', '/scenes/current', userId, sceneDto(['ZZ99']));
  assert.equal(badScene.status, 409);
  assert.equal(badScene.body.error.code, 'SCENE_ASSET_UNAVAILABLE');

  const preflight = await fetch(`${base}/scenes/current`, { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:4173' } });
  assert.equal(preflight.status, 204);
  assert.match(String(preflight.headers.get('access-control-allow-methods')), /PUT/);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://127.0.0.1:4173');
});

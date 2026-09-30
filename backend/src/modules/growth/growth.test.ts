import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from '../../app.ts';
import { DevelopmentSessionFactsAdapter } from './testing/session-facts.ts';
import type { GrowthService } from './service.ts';

let server: Server;
let baseUrl: string;
let facts: DevelopmentSessionFactsAdapter;
let service: GrowthService;

beforeEach(async () => {
  facts = new DevelopmentSessionFactsAdapter();
  const built = createApp({ sessionFacts: facts });
  service = built.services.growth;
  server = built.app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});
afterEach(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

async function createUser(age_mode: 'adult' | 'child' = 'adult') {
  const response = await fetch(`${baseUrl}/users/anonymous`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ age_mode }) });
  assert.equal(response.status, 201);
  return (await response.json()).data as { user_id: string };
}

async function submit(userId: string, sessionId: string, overrides: object = {}) {
  return fetch(`${baseUrl}/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Id': userId, 'Idempotency-Key': `feedback-${sessionId}` }, body: JSON.stringify({ session_id: sessionId, fall_asleep_ease: 'easy', sound_comfort: 'comfortable', voice_next_time: 'unspecified', forbidden_sound_tags: ['thunder'], ...overrides }) });
}

test('匿名用户拥有隔离的偏好与积分', async () => {
  const first = await createUser();
  const second = await createUser('child');
  facts.ensureForUser(first.user_id);
  const response = await submit(first.user_id, `dev-session-${first.user_id}`);
  assert.equal(response.status, 201);
  const firstPoints = await (await fetch(`${baseUrl}/points`, { headers: { 'X-User-Id': first.user_id } })).json();
  const secondPoints = await (await fetch(`${baseUrl}/points`, { headers: { 'X-User-Id': second.user_id } })).json();
  assert.equal(firstPoints.data.balance, 5);
  assert.equal(secondPoints.data.balance, 0);
});

test('一次会话最多一条反馈且积分不重复', async () => {
  const user = await createUser();
  const sessionId = `dev-session-${user.user_id}`;
  facts.ensureForUser(user.user_id);
  assert.equal((await submit(user.user_id, sessionId)).status, 201);
  assert.equal((await submit(user.user_id, sessionId)).status, 409);
  const points = await (await fetch(`${baseUrl}/points`, { headers: { 'X-User-Id': user.user_id } })).json();
  assert.equal(points.data.balance, 5);
  assert.equal(points.data.entries.length, 1);
});

test('反馈、偏好和积分形成同一闭环', async () => {
  const user = await createUser();
  const sessionId = `dev-session-${user.user_id}`;
  facts.ensureForUser(user.user_id);
  const response = await submit(user.user_id, sessionId, { voice_next_time: 'avoid', story_themes: ['quiet_room'] });
  assert.equal(response.status, 201);
  const preference = await (await fetch(`${baseUrl}/preferences`, { headers: { 'X-User-Id': user.user_id } })).json();
  assert.equal(preference.data.voice_preference, 'avoid');
  assert.deepEqual(preference.data.forbidden_sound_tags, ['thunder']);
  assert.deepEqual(preference.data.story_themes, ['quiet_room']);
  const pending = await (await fetch(`${baseUrl}/feedback/pending`, { headers: { 'X-User-Id': user.user_id } })).json();
  assert.equal(pending.data.pending, false);
});

test('拒绝其他用户或未完成会话的反馈', async () => {
  const first = await createUser();
  const second = await createUser();
  facts.ensureForUser(first.user_id);
  const response = await submit(second.user_id, `dev-session-${first.user_id}`);
  assert.equal(response.status, 409);
  const points = await (await fetch(`${baseUrl}/points`, { headers: { 'X-User-Id': second.user_id } })).json();
  assert.equal(points.data.balance, 0);
});

test('验证枚举与 note 长度并保持事务无写入', async () => {
  const user = await createUser();
  facts.ensureForUser(user.user_id);
  const response = await submit(user.user_id, `dev-session-${user.user_id}`, { voice_next_time: 'either', note: 'x'.repeat(501) });
  assert.equal(response.status, 400);
  const points = await (await fetch(`${baseUrl}/points`, { headers: { 'X-User-Id': user.user_id } })).json();
  assert.equal(points.data.balance, 0);
});

test('积分冲突会回滚同一事务中的反馈与偏好', async () => {
  const user = await createUser();
  const firstSession = `dev-session-${user.user_id}`;
  facts.ensureForUser(user.user_id);
  const first = await fetch(`${baseUrl}/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Id': user.user_id, 'Idempotency-Key': 'same-idempotency-key' }, body: JSON.stringify({ session_id: firstSession, fall_asleep_ease: 'easy', sound_comfort: 'comfortable', voice_next_time: 'want' }) });
  assert.equal(first.status, 201);
  const secondSession = 'completed-session-2';
  facts.add({ id: secondSession, userId: user.user_id, endedAt: new Date().toISOString(), source: 'module4' });
  const second = await fetch(`${baseUrl}/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Id': user.user_id, 'Idempotency-Key': 'same-idempotency-key' }, body: JSON.stringify({ session_id: secondSession, fall_asleep_ease: 'difficult', sound_comfort: 'uncomfortable', voice_next_time: 'avoid' }) });
  assert.equal(second.status, 409);
  const pending = await (await fetch(`${baseUrl}/feedback/pending`, { headers: { 'X-User-Id': user.user_id } })).json();
  assert.equal(pending.data.pending, true);
  assert.equal(pending.data.session.id, secondSession);
  const preference = await (await fetch(`${baseUrl}/preferences`, { headers: { 'X-User-Id': user.user_id } })).json();
  assert.equal(preference.data.voice_preference, 'want');
});

test('真实开始事实的 +10 积分按来源幂等', async () => {
  const user = await createUser();
  service.recordPlanStarted(user.user_id, 'plan-1', 'plan-started-1');
  service.recordPlanStarted(user.user_id, 'plan-1', 'plan-started-retry');
  const points = await (await fetch(`${baseUrl}/points`, { headers: { 'X-User-Id': user.user_id } })).json();
  assert.equal(points.data.balance, 10);
  assert.equal(points.data.entries.length, 1);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../app.ts';
import { PlanningError } from './types.ts';
import { toStructuredIntent } from './intent-parser.ts';
import { PlanningRepository } from './repository.ts';
import { composeRulePlan } from './rule-engine.ts';
import type { ContentCandidate } from './types.ts';

const candidates: ContentCandidate[] = [
  { contentId: 'A01', contentKind: 'audio', tags: ['rain'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'licensed', enabled: true },
  { contentId: 'A03', contentKind: 'audio', tags: ['fire'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
  { contentId: 'A12', contentKind: 'audio', tags: ['thunder'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'licensed', enabled: true },
  { contentId: 'S01', contentKind: 'story', tags: ['gentle'], ageMode: 'adult', hasVoice: true, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
  { contentId: 'S02', contentKind: 'story', tags: ['gentle'], ageMode: 'child', hasVoice: true, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
  { contentId: 'B01', contentKind: 'breath', tags: ['calm'], ageMode: 'all', hasVoice: true, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
];

const sentence = (freeText: string) => toStructuredIntent({ inputMode: 'sentence', mood: 'calm', voicePreference: 'either', avoidTags: [], durationSec: 1200, selectedContentIds: [], freeText });

test('四条固定句转换为结构化意图', () => {
  const rain = sentence('赶作业，想听雨，不要打雷。');
  assert.deepEqual(rain.avoidTags, ['thunder']); assert.deepEqual(rain.selectedContentIds, ['A01']);
  assert.equal(sentence('明天考试，只剩十五分钟。').durationSec, 900);
  assert.equal(sentence('不要人声。').voicePreference, 'avoid');
  assert.equal(sentence('心情不好，想有人陪一会儿。').voicePreference, 'wanted');
});

test('想听雨不会自动添加禁雷', () => { assert.deepEqual(sentence('今晚想听雨。').avoidTags, []); });

test('三十分钟不会被误识别为十分钟', () => {
  const intent = sentence('心情不好，想有人陪一会儿，听三十分钟。');
  assert.equal(intent.durationSec, 1800);
  assert.equal(intent.voicePreference, 'wanted');
});

test('禁雷和不要人声规则不会产生不安全轨道', () => {
  const intent = sentence('想听雨，不要打雷，也不要人声。');
  const plan = composeRulePlan({ userId: 'u1', ageMode: 'adult', intent, candidates, now: '2026-09-28T00:00:00.000Z' });
  assert.equal(plan.status, 'draft'); assert.ok(plan.tracks.every((track) => track.contentId !== 'A12' && track.contentKind !== 'story'));
});

test('短时间优先生成含呼吸的方案', () => {
  const plan = composeRulePlan({ userId: 'u1', ageMode: 'adult', intent: sentence('明天考试，只剩十五分钟。'), candidates });
  assert.ok(plan.tracks.some((track) => track.contentKind === 'breath')); assert.ok(plan.fadeOutSec <= plan.durationSec);
});

test('儿童模式不会选择成人故事', () => {
  const intent = sentence('心情不好，想有人陪一会儿。');
  const plan = composeRulePlan({ userId: 'child', ageMode: 'child', intent, candidates });
  assert.ok(plan.tracks.every((track) => track.contentId !== 'S01'));
  assert.ok(plan.tracks.some((track) => track.contentId === 'S02'));
});

test('偏好服务失败会降级，内容目录失败会中止', async () => {
  const degraded = createApp({
    catalog: { async listCandidates() { return candidates; } },
    preferences: { async getPreferences() { throw new Error('offline'); } },
  });
  const result = await degraded.service.compose('u1', 'adult', {
    inputMode: 'choices', mood: 'calm', voicePreference: 'avoid', avoidTags: [], durationSec: 1200, selectedContentIds: [],
  });
  assert.equal(result.meta?.degraded, true);
  const unavailable = createApp({
    catalog: { async listCandidates(): Promise<ContentCandidate[]> { throw new Error('offline'); } },
    preferences: { async getPreferences() { return { avoidTags: [] }; } },
  });
  await assert.rejects(() => unavailable.service.compose('u1', 'adult', {
    inputMode: 'choices', mood: 'calm', voicePreference: 'either', avoidTags: [], durationSec: 1200, selectedContentIds: [],
  }), (error: unknown) => error instanceof PlanningError && error.code === 'CONTENT_CATALOG_UNAVAILABLE');
});

test('当晚主动选择优先于历史偏好', async () => {
  const { service } = createApp({
    catalog: { async listCandidates() { return candidates; } },
    preferences: { async getPreferences() { return { avoidTags: ['rain'] }; } },
  });
  const result = await service.compose('u1', 'adult', {
    inputMode: 'choices', mood: 'calm', voicePreference: 'either', avoidTags: [], durationSec: 1200, selectedContentIds: ['A01'],
  });
  assert.ok(result.data.tracks.some((track) => track.contentId === 'A01'));
});

test('迁移、Repository所有权和幂等确认', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../../migrations/200_module2.sql', import.meta.url), 'utf8'));
  const repo = new PlanningRepository(db);
  const plan = composeRulePlan({ userId: 'u1', ageMode: 'adult', intent: sentence('不要人声。'), candidates, now: '2026-09-28T00:00:00.000Z' });
  repo.save(plan); assert.equal(repo.get(plan.planId, 'u1').planId, plan.planId);
  assert.throws(() => repo.get(plan.planId, 'u2'), /不能读取/);
  const first = repo.confirm(plan.planId, 'u1', '2026-09-28T00:01:00.000Z');
  const second = repo.confirm(plan.planId, 'u1', '2026-09-28T00:02:00.000Z');
  assert.equal(first.confirmedAt, second.confirmedAt); assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  const started = repo.markStarted(plan.planId, 'session-1', '2026-09-28T00:03:00.000Z');
  assert.equal(started.status, 'started');
  assert.throws(() => repo.markStarted(plan.planId, 'session-2', '2026-09-28T00:04:00.000Z'), /其他睡眠会话/);
  assert.equal(repo.markCompleted(plan.planId, 'session-1', '2026-09-28T00:05:00.000Z').status, 'completed');
  db.close();
});

test('故事和呼吸配置写入各自表，删除用户时级联清理', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../../migrations/200_module2.sql', import.meta.url), 'utf8'));
  const repo = new PlanningRepository(db);
  const storyPlan = composeRulePlan({ userId: 'u-story', ageMode: 'adult', intent: sentence('心情不好，想有人陪一会儿。'), candidates });
  const breathPlan = composeRulePlan({ userId: 'u-breath', ageMode: 'adult', intent: sentence('明天考试，只剩十五分钟。'), candidates });
  repo.save(storyPlan); repo.save(breathPlan);
  assert.equal(Number((db.prepare('SELECT count(*) AS count FROM story_config').get() as { count: number }).count), 1);
  assert.equal(Number((db.prepare('SELECT count(*) AS count FROM breath_config').get() as { count: number }).count), 1);
  repo.eraseUserData('u-story'); repo.eraseUserData('u-breath');
  for (const table of ['sleep_plan', 'sleep_plan_track', 'story_config', 'breath_config']) {
    assert.equal(Number((db.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count), 0);
  }
  db.close();
});

test('HTTP四接口、所有权和freeText不落库', async () => {
  const database = new DatabaseSync(':memory:');
  const { app } = createApp({ database });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}/api/v1`;
  const headers = { 'Content-Type': 'application/json', 'X-Mianyu-User-Id': 'http-user', 'X-Mianyu-Age-Mode': 'adult' };
  try {
    const compose = await fetch(`${base}/plans/compose`, { method: 'POST', headers, body: JSON.stringify({
      inputMode: 'sentence', mood: 'calm', voicePreference: 'either', avoidTags: [], durationSec: 1800,
      selectedContentIds: [], freeText: '心情不好，想有人陪一会儿，听三十分钟。',
    }) });
    assert.equal(compose.status, 201);
    const created = await compose.json() as { data: { planId: string; durationSec: number } };
    assert.equal(created.data.durationSec, 1800);
    const get = await fetch(`${base}/plans/${created.data.planId}`, { headers }); assert.equal(get.status, 200);
    const forbidden = await fetch(`${base}/plans/${created.data.planId}`, { headers: { ...headers, 'X-Mianyu-User-Id': 'other-user' } }); assert.equal(forbidden.status, 403);
    const confirm = await fetch(`${base}/plans/${created.data.planId}/confirm`, { method: 'POST', headers }); assert.equal(confirm.status, 200);
    const retry = await fetch(`${base}/plans/${created.data.planId}/confirm`, { method: 'POST', headers }); assert.equal(retry.status, 200);
    const regenerationHeaders = { ...headers, 'Idempotency-Key': 'regen-http-1' };
    const regenerated = await fetch(`${base}/plans/${created.data.planId}/regenerate`, { method: 'POST', headers: regenerationHeaders }); assert.equal(regenerated.status, 201);
    const next = await regenerated.json() as { data: { planId: string } }; assert.notEqual(next.data.planId, created.data.planId);
    const regeneratedRetry = await fetch(`${base}/plans/${created.data.planId}/regenerate`, { method: 'POST', headers: regenerationHeaders });
    const retryPlan = await regeneratedRetry.json() as { data: { planId: string } }; assert.equal(retryPlan.data.planId, next.data.planId);
    const databaseText = JSON.stringify(database.prepare('SELECT * FROM sleep_plan').all());
    assert.equal(databaseText.includes('心情不好'), false);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); database.close(); }
});

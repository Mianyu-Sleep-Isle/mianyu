const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..', '..');
require(join(root, 'frontend-api', 'core.js'));
require(join(root, 'frontend-api', 'mock-adapters.js'));
require(join(root, 'frontend-api', 'http-adapters.js'));
const api = globalThis.MianyuApi;

test('五模块 Mock 与 HTTP Adapter 暴露相同方法', () => {
  const pairs = [
    [new api.mocks.ContentMockAdapter(), new api.http.ContentHttpAdapter({ request() {} }), ['list', 'resolvePlayable', 'setFavorite']],
    [new api.mocks.PlanningMockAdapter(), new api.http.PlanningHttpAdapter({ request() {} }), ['compose', 'current', 'regenerate', 'confirm']],
    [new api.mocks.SceneMockAdapter(), new api.http.SceneHttpAdapter({ request() {} }), ['current', 'saveDraft', 'handoff', 'copy']],
    [new api.mocks.SessionMockAdapter(), new api.http.SessionHttpAdapter({ request() {} }), ['start', 'pause', 'resume', 'appendEvent', 'stop', 'history']],
    [new api.mocks.GrowthMockAdapter(), new api.http.GrowthHttpAdapter({ request() {} }), ['pendingFeedback', 'submitFeedback', 'preferences', 'points', 'archive']],
    [new api.mocks.CommonMockAdapter(), new api.http.CommonHttpAdapter({ request() {} }), ['currentUser', 'updateUser', 'verifyPin', 'eraseAll']]
  ];
  for (const [mock, http, methods] of pairs) for (const method of methods) {
    assert.equal(typeof mock[method], 'function', `Mock missing ${method}`);
    assert.equal(typeof http[method], 'function', `HTTP missing ${method}`);
  }
});

test('公共枚举只使用冻结值', async () => {
  const plan = await new api.mocks.PlanningMockAdapter().compose({ voice_preference: 'unspecified', available_minutes: 30, forbidden_tags: [] });
  assert.equal(plan.source, 'rule');
  assert.equal(plan.status, 'draft');
  const preference = await new api.mocks.GrowthMockAdapter().preferences();
  assert.equal(preference.voice_preference, 'unspecified');
  assert.notEqual(preference.voice_preference, 'either');
});

test('OpenAPI 覆盖全部 HTTP Client 路径', () => {
  const openapi = readFileSync(join(root, 'contracts', 'openapi.yaml'), 'utf8');
  for (const path of ['/content:', '/plans:', '/scenes/current:', '/scenes/{sceneId}/handoff:', '/scenes/{sceneId}/copy:', '/sessions:', '/sessions/{sessionId}/start:', '/sessions/{sessionId}/stop:', '/sessions/history:', '/feedback/pending:', '/feedback:', '/preferences:', '/points:', '/archive:', '/users/anonymous:', '/users/me:', '/users/me/data:', '/auth/pin/verify:']) assert.ok(openapi.includes(path), `Missing ${path}`);
  assert.ok(openapi.includes('url: http://127.0.0.1:8787/api/v1'), 'API base URL must match frontend default');
});

test('会话 HTTP Adapter 先准备会话，再确认音频开始', async () => {
  const calls = [];
  const client = { async request(path, options) { calls.push([options && options.method || 'GET', path]); return path === '/sessions' ? { id: 'session-1', status: 'preparing' } : { id: 'session-1', status: 'running' }; } };
  const adapter = new api.http.SessionHttpAdapter(client);
  const session = await adapter.start({ plan_id: 'plan-1', scene_id: 'scene-1' });
  assert.equal(session.status, 'running');
  await adapter.pause();
  assert.deepEqual(calls, [['POST', '/sessions'], ['POST', '/sessions/session-1/start'], ['POST', '/sessions/session-1/pause']]);
});

test('页面只通过 Port 执行业务接口', () => {
  const page = readFileSync(join(root, 'app_pages.js'), 'utf8');
  const preview = readFileSync(join(root, 'system_preview.html'), 'utf8');
  for (const call of ['ports.catalog.list', 'ports.planComposer.compose', 'ports.feedback.submit', 'ports.preferences.current', 'ports.points.entries', 'ports.archive.query']) assert.ok(page.includes(call), `Missing ${call}`);
  for (const call of ['MianyuPorts.sceneQuery.saveDraft', 'MianyuPorts.sleepSession.start', 'MianyuPorts.sleepSession.pause', 'MianyuPorts.sleepSession.stop']) assert.ok(preview.includes(call), `Missing ${call}`);
});

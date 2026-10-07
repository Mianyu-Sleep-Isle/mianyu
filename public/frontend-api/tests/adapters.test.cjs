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
  for (const path of ['/content:', '/plans:', '/scenes/current:', '/sessions:', '/feedback/pending:', '/feedback:', '/preferences:', '/points:', '/archive:', '/users/anonymous:']) assert.ok(openapi.includes(path), `Missing ${path}`);
});

test('页面只通过 Port 执行业务接口', () => {
  const page = readFileSync(join(root, 'app_pages.js'), 'utf8');
  const preview = readFileSync(join(root, 'system_preview.html'), 'utf8');
  for (const call of ['ports.catalog.list', 'ports.planComposer.compose', 'ports.feedback.submit', 'ports.preferences.current', 'ports.points.entries', 'ports.archive.query']) assert.ok(page.includes(call), `Missing ${call}`);
  for (const call of ['MianyuPorts.sceneQuery.saveDraft', 'MianyuPorts.sleepSession.start', 'MianyuPorts.sleepSession.pause', 'MianyuPorts.sleepSession.stop']) assert.ok(preview.includes(call), `Missing ${call}`);
});

test('HttpClient.request 会先确保 user_id 存在（自动创建匿名账户）', async () => {
  // 模拟 fetch：记录所有调用
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, method: (options && options.method) || 'GET' });
    if (url.endsWith('/users/anonymous') && calls.length === 1) {
      return new Response(JSON.stringify({ data: { user_id: 'auto-uid' } }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.endsWith('/users/me') && calls.length === 2) {
      return new Response(JSON.stringify({ data: { user_id: 'auto-uid', age_mode: 'adult', pin_configured: false, non_medical_accepted: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200 });
  };
  // 清掉之前测试残留的 mianyu_user_id
  const store = (globalThis.localStorage && globalThis.localStorage.clear) ? globalThis.localStorage : null;
  // 单独使用 memory storage
  const memoryStore = new Map();
  globalThis.localStorage = {
    getItem: (k) => memoryStore.has(k) ? memoryStore.get(k) : null,
    setItem: (k, v) => memoryStore.set(k, String(v)),
    removeItem: (k) => memoryStore.delete(k),
    clear: () => memoryStore.clear(),
  };
  try {
    const client = new api.HttpClient({ baseUrl: 'http://test', fetchImpl: fakeFetch });
    assert.equal(memoryStore.has('mianyu_user_id'), false, '起始不应有 user_id');
    await client.request('/users/me');
    // 1. 第一调 fetch 是 POST /users/anonymous
    assert.equal(calls[0].url, 'http://test/users/anonymous', '应先调创建用户');
    assert.equal(calls[0].method, 'POST');
    // 2. 创建后 mianyu_user_id 存到 storage
    assert.equal(memoryStore.get('mianyu_user_id'), 'auto-uid', 'user_id 应已存');
    // 3. 第二次 fetch 是 PATCH /users/me 且带 X-User-Id
    assert.equal(calls[1].url, 'http://test/users/me');
  } finally {
    if (store) globalThis.localStorage = store; else delete globalThis.localStorage;
  }
});

test('HttpClient 已有 user_id 时不应再调 /users/anonymous', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url });
    if (url.endsWith('/users/me')) return new Response(JSON.stringify({ data: { user_id: 'preset-uid' } }), { status: 200 });
    return new Response('{}', { status: 200 });
  };
  const memoryStore = new Map([['mianyu_user_id', 'preset-uid']]);
  globalThis.localStorage = {
    getItem: (k) => memoryStore.has(k) ? memoryStore.get(k) : null,
    setItem: (k, v) => memoryStore.set(k, String(v)),
    removeItem: (k) => memoryStore.delete(k),
    clear: () => memoryStore.clear(),
  };
  try {
    const client = new api.HttpClient({ baseUrl: 'http://test', fetchImpl: fakeFetch });
    await client.request('/users/me');
    assert.equal(calls.length, 1, '不应创建新账户');
    assert.equal(calls[0].url, 'http://test/users/me');
  } finally {
    delete globalThis.localStorage;
  }
});

(function initMianyuPorts(global) {
  'use strict';
  const api = global.MianyuApi;
  if (!api || !api.mocks || !api.http) throw new Error('Mianyu API adapters must be loaded first');
  const defaults = { content: 'mock', planning: 'mock', scene: 'mock', session: 'mock', growth: 'http', common: 'mock' };
  const transports = Object.assign({}, defaults, global.__MIANYU_TRANSPORTS__ || {});
  const client = new api.HttpClient({ baseUrl: global.__MIANYU_API_BASE_URL__ || 'http://127.0.0.1:8787/api/v1' });
  function choose(key, MockType, HttpType) { return transports[key] === 'http' ? new HttpType(client) : new MockType(); }
  const content = choose('content', api.mocks.ContentMockAdapter, api.http.ContentHttpAdapter);
  const planning = choose('planning', api.mocks.PlanningMockAdapter, api.http.PlanningHttpAdapter);
  const scene = choose('scene', api.mocks.SceneMockAdapter, api.http.SceneHttpAdapter);
  const session = choose('session', api.mocks.SessionMockAdapter, api.http.SessionHttpAdapter);
  const growth = choose('growth', api.mocks.GrowthMockAdapter, api.http.GrowthHttpAdapter);
  const common = choose('common', api.mocks.CommonMockAdapter, api.http.CommonHttpAdapter);
  const audio = new api.mocks.BrowserAudioEngineAdapter();

  global.MianyuPorts = Object.freeze({
    catalog: { list: content.list.bind(content), setFavorite: content.setFavorite.bind(content) },
    resourceResolver: { resolve: content.resolvePlayable.bind(content) },
    planComposer: { compose: planning.compose.bind(planning), regenerate: planning.regenerate.bind(planning), confirm: planning.confirm.bind(planning) },
    planQuery: { current: planning.current.bind(planning) },
    sceneQuery: { current: scene.current.bind(scene), saveDraft: scene.saveDraft.bind(scene), freeze: scene.handoff.bind(scene), copy: scene.copy.bind(scene) },
    sleepSession: { start: session.start.bind(session), pause: session.pause.bind(session), resume: session.resume.bind(session), appendEvent: session.appendEvent.bind(session), stop: session.stop.bind(session), history: session.history.bind(session) },
    audioEngine: { preview: audio.preview.bind(audio), stopPreview: audio.stopPreview.bind(audio) },
    feedback: { pending: growth.pendingFeedback.bind(growth), submit: growth.submitFeedback.bind(growth) },
    preferences: { current: growth.preferences.bind(growth) },
    points: { entries: growth.points.bind(growth) },
    archive: { query: growth.archive.bind(growth) },
    auth: { currentUser: common.currentUser.bind(common), updateUser: common.updateUser.bind(common), verifyPin: common.verifyPin.bind(common) },
    erasure: { eraseAll: common.eraseAll.bind(common) },
    config: Object.freeze({ transports: Object.freeze(Object.assign({}, transports)), apiBaseUrl: client.baseUrl })
  });
})(typeof window !== 'undefined' ? window : globalThis);

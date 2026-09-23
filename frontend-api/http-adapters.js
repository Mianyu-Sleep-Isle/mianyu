(function initMianyuHttpAdapters(global) {
  'use strict';
  const api = global.MianyuApi;
  if (!api) throw new Error('frontend-api/core.js must be loaded first');

  class ContentHttpAdapter {
    constructor(client) { this.client = client; }
    list(category, ageMode) { return this.client.request('/content?category=' + encodeURIComponent(category) + '&age_mode=' + encodeURIComponent(ageMode)); }
    resolvePlayable(assetId) { return this.client.request('/content/' + encodeURIComponent(assetId) + '/playable'); }
    setFavorite(assetId, favorite) { return this.client.request('/content/' + encodeURIComponent(assetId) + '/favorite', { method: 'PUT', body: { favorite: Boolean(favorite) }, idempotencyKey: api.utils.uuid() }); }
  }

  class PlanningHttpAdapter {
    constructor(client) { this.client = client; }
    compose(intent) { return this.client.request('/plans', { method: 'POST', body: intent, idempotencyKey: api.utils.uuid() }); }
    current() { return this.client.request('/plans/current'); }
    regenerate(intent) { return this.client.request('/plans/regenerate', { method: 'POST', body: intent, idempotencyKey: api.utils.uuid() }); }
    confirm(planId) { return this.client.request('/plans/' + encodeURIComponent(planId) + '/confirm', { method: 'POST', idempotencyKey: api.utils.uuid() }); }
  }

  class SceneHttpAdapter {
    constructor(client) { this.client = client; }
    current() { return this.client.request('/scenes/current'); }
    saveDraft(scene) { return this.client.request('/scenes/current', { method: 'PUT', body: scene, idempotencyKey: api.utils.uuid() }); }
    handoff(scene) { return this.client.request('/scenes/' + encodeURIComponent(scene.id) + '/handoff', { method: 'POST', body: scene, idempotencyKey: api.utils.uuid() }); }
    copy(sceneId) { return this.client.request('/scenes/' + encodeURIComponent(sceneId) + '/copy', { method: 'POST', idempotencyKey: api.utils.uuid() }); }
  }

  class SessionHttpAdapter {
    constructor(client) { this.client = client; this.currentSessionId = null; }
    async start(input) { const value = await this.client.request('/sessions', { method: 'POST', body: input, idempotencyKey: api.utils.uuid() }); this.currentSessionId = value.id; return value; }
    pause() { return this._command('pause'); }
    resume() { return this._command('resume'); }
    appendEvent(type, payload) { return this.client.request('/sessions/' + encodeURIComponent(this.currentSessionId) + '/events', { method: 'POST', body: { type: type, payload: payload || {} }, idempotencyKey: api.utils.uuid() }); }
    stop() { return this._command('stop'); }
    history() { return this.client.request('/sessions/history'); }
    _command(command) { if (!this.currentSessionId) throw new api.MianyuApiError(api.ErrorCodes.VALIDATION, '当前没有活动会话'); return this.client.request('/sessions/' + encodeURIComponent(this.currentSessionId) + '/' + command, { method: 'POST', idempotencyKey: api.utils.uuid() }); }
  }

  class GrowthHttpAdapter {
    constructor(client) { this.client = client; this.ready = null; this.userId = null; }
    async ensureUser() {
      const store = api.utils.storage();
      this.userId = this.userId || store.getItem('mianyu_growth_user_id');
      if (this.userId) return this.userId;
      if (!this.ready) this.ready = this.client.request('/users/anonymous', { method: 'POST', body: { age_mode: store.getItem('mianyu_age_mode') || 'adult' }, headers: { 'X-User-Id': '' }, idempotencyKey: api.utils.uuid() }).then((user) => { store.setItem('mianyu_growth_user_id', user.user_id); this.userId = user.user_id; return user.user_id; });
      return this.ready;
    }
    async request(path, options) { const userId = await this.ensureUser(); const config = Object.assign({}, options || {}, { headers: Object.assign({}, options && options.headers || {}, { 'X-User-Id': userId }) }); return this.client.request(path, config); }
    pendingFeedback() { return this.request('/feedback/pending'); }
    submitFeedback(input) { return this.request('/feedback', { method: 'POST', body: input, idempotencyKey: input.idempotency_key || api.utils.uuid() }); }
    preferences() { return this.request('/preferences'); }
    points() { return this.request('/points'); }
    archive(period) { return this.request('/archive?period=' + encodeURIComponent(period || '7d')); }
  }

  class CommonHttpAdapter {
    constructor(client) { this.client = client; }
    currentUser() { return this.client.request('/users/me'); }
    updateUser(input) { return this.client.request('/users/me', { method: 'PATCH', body: input, idempotencyKey: api.utils.uuid() }); }
    verifyPin(pin) { return this.client.request('/auth/pin/verify', { method: 'POST', body: { pin: pin } }); }
    eraseAll() { return this.client.request('/users/me/data', { method: 'DELETE', idempotencyKey: api.utils.uuid() }); }
  }

  api.http = { ContentHttpAdapter, PlanningHttpAdapter, SceneHttpAdapter, SessionHttpAdapter, GrowthHttpAdapter, CommonHttpAdapter };
})(typeof window !== 'undefined' ? window : globalThis);

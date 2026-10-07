(function initMianyuMocks(global) {
  'use strict';
  const api = global.MianyuApi;
  if (!api) throw new Error('frontend-api/core.js must be loaded first');
  const clone = api.utils.clone;
  const uuid = api.utils.uuid;
  const storage = api.utils.storage;

  const content = {
    '声音': [
      { id: 'A03', name: '壁炉', meta: '室内 · 温暖火声', category: '声音', art: 'fireplace', action: '试听', age_mode: 'adult', asset_path: 'assets/images/sounds/fireplace.png', enabled: true },
      { id: 'A01', name: '小雨', meta: '户外 · 轻柔雨声', category: '声音', art: 'rain', action: '试听', age_mode: 'adult', asset_path: 'assets/images/sounds/rain_light.png', enabled: true },
      { id: 'A09', name: '夜晚森林', meta: '户外 · 林间夜声', category: '声音', art: 'forest', action: '试听', age_mode: 'adult', asset_path: 'assets/images/sounds/forest_night.png', enabled: true },
      { id: 'A12', name: '远雷', meta: '户外 · 低沉远雷', category: '声音', art: 'thunder', action: '试听', age_mode: 'adult', asset_path: 'assets/images/sounds/thunder.png', enabled: true },
      { id: 'A04', name: '翻书声', meta: '室内 · 轻缓翻页', category: '声音', art: 'bookturn', action: '试听', age_mode: 'adult', asset_path: 'assets/images/sounds/page_turn.png', enabled: true },
      { id: 'A10', name: '轻键盘', meta: '室内 · 低声敲击', category: '声音', art: 'keyboard', action: '试听', age_mode: 'adult', asset_path: 'assets/images/sounds/keyboard.png', enabled: true },
      { id: 'A11', name: '被子摩擦', meta: '室内 · 柔软织物声', category: '声音', art: 'blanket', action: '试听', age_mode: 'adult', asset_path: 'assets/images/sounds/blanket.png', enabled: true },
      { id: 'A07', name: '室内底噪', meta: '室内 · 稳定环境声', category: '声音', art: 'roomtone', action: '试听', age_mode: 'adult', asset_path: 'assets/images/sounds/room_tone.png', enabled: true }
    ],
    '故事': [
      { id: 'ST01', name: '窗边听雨', meta: '成人故事 · 4 分钟', category: '故事', art: 'story-rain-window', image: 'assets/images/content/adult_rain_window.png', action: '详情', detail: true, age_mode: 'adult', enabled: true },
      { id: 'ST02', name: '静室入夜', meta: '成人故事 · 9 分钟', category: '故事', art: 'story-quiet-room', image: 'assets/images/content/adult_quiet_room.png', action: '详情', detail: true, age_mode: 'adult', enabled: true },
      { id: 'ST03', name: '暖茶时光', meta: '成人故事 · 4 分钟', category: '故事', art: 'story-warm-tea', image: 'assets/images/content/adult_warm_tea.png', action: '详情', detail: true, age_mode: 'adult', enabled: true },
      { id: 'ST04', name: '星星和小毯子', meta: '儿童故事 · 5 分钟', category: '故事', art: 'story-star-blanket', image: 'assets/images/content/child_star_blanket.png', action: '详情', detail: true, age_mode: 'child', enabled: true },
      { id: 'ST05', name: '小小花园的晚安', meta: '儿童故事 · 4 分钟', category: '故事', art: 'story-small-garden', image: 'assets/images/content/child_small_garden.png', action: '详情', detail: true, age_mode: 'child', enabled: true }
    ],
    '呼吸': [{ id: 'BR01', name: '睡前两分钟呼吸', meta: '呼吸训练 · 2 分钟', category: '呼吸', art: 'breath-relax', image: 'assets/images/content/breath_relax.png', action: '详情', detail: true, age_mode: 'child', enabled: true }],
    '预设': [{ id: 'PR01', name: '暖火与细雨', meta: '壁炉 + 小雨 · 可继续修改', category: '预设', art: 'fireplace', action: '查看', age_mode: 'child', enabled: true }, { id: 'PR02', name: '林间留白', meta: '夜晚森林 + 室内底噪', category: '预设', art: 'forest', action: '查看', age_mode: 'child', enabled: true }],
    '收藏': [{ id: 'A01', name: '小雨', meta: '声音 · 已收藏', category: '收藏', art: 'rain', action: '试听', age_mode: 'child', enabled: true }, { id: 'ST06', name: '月光邮局', meta: '模板故事 · 已收藏', category: '收藏', art: 'letter', action: '详情', detail: true, age_mode: 'adult', enabled: true }, { id: 'A03', name: '壁炉', meta: '声音 · 已收藏', category: '收藏', art: 'fireplace', action: '试听', age_mode: 'child', enabled: true }]
  };

  class ContentMockAdapter {
    async list(category, ageMode) { return clone((content[category] || []).filter(function (item) { return ageMode !== 'child' || item.age_mode === 'child'; })); }
    async resolvePlayable(assetId) { const item = Object.values(content).flat().find(function (entry) { return entry.id === assetId; }); return item ? { asset_id: item.id, url: item.asset_path || item.image || '', expires_at: null } : null; }
    async setFavorite(assetId, favorite) { return { asset_id: assetId, favorite: Boolean(favorite) }; }
  }

  let currentPlan = null;
  class PlanningMockAdapter {
    async compose(intent) {
      currentPlan = { id: uuid(), type: intent.voice_preference === 'want' ? 'mix' : 'soundscape', reason: intent.preset_sentence || '保留小雨和室内暖声，并按你的禁忌排除远雷。', source: 'rule', status: 'draft', duration_minutes: intent.available_minutes || 30, fade_out_minutes: 5, tracks: [{ asset_id: 'A01', name: '小雨' }, { asset_id: 'A03', name: '壁炉' }, { asset_id: 'A07', name: '室内底噪' }] };
      return clone(currentPlan);
    }
    async current() { return clone(currentPlan); }
    async regenerate(intent) { return this.compose(intent); }
    async confirm(planId) { if (currentPlan && currentPlan.id === planId) currentPlan.status = 'confirmed'; return clone(currentPlan); }
  }

  let currentScene = { id: 'scene-demo', name: '我的睡前小屋', status: 'draft', version: 1, sources: [] };
  class SceneMockAdapter {
    async current() { return clone(currentScene); }
    async saveDraft(scene) { currentScene = Object.assign({}, clone(scene), { id: scene.id || currentScene.id, status: 'draft', version: (currentScene.version || 0) + 1 }); return clone(currentScene); }
    async handoff(scene) { currentScene = Object.assign({}, clone(scene), { status: 'handed_off' }); return clone(currentScene); }
    async copy(sceneId) { currentScene = Object.assign({}, currentScene, { id: uuid(), name: currentScene.name + ' 副本', status: 'draft', version: 1 }); return clone(currentScene); }
  }

  let currentSession = null;
  class SessionMockAdapter {
    async start(input) { currentSession = { id: uuid(), plan_id: input.plan_id || 'plan-demo', scene_id: input.scene_id || currentScene.id, status: 'running', started_at: new Date().toISOString(), playback_minutes: 0 }; return clone(currentSession); }
    async pause() { if (currentSession) currentSession.status = 'paused'; return clone(currentSession); }
    async resume() { if (currentSession) currentSession.status = 'running'; return clone(currentSession); }
    async appendEvent(type, payload) { return { id: uuid(), session_id: currentSession && currentSession.id, type: type, payload: clone(payload || {}), occurred_at: new Date().toISOString() }; }
    async stop() { if (currentSession) currentSession.status = 'completed'; return clone(currentSession); }
    async history() { return currentSession ? [clone(currentSession)] : []; }
  }

  class BrowserAudioEngineAdapter {
    constructor() { this.previewing = null; }
    async preview(assetId) { this.previewing = assetId; return { asset_id: assetId, playing: true }; }
    async stopPreview() { const assetId = this.previewing; this.previewing = null; return { asset_id: assetId, playing: false }; }
  }

  class GrowthMockAdapter {
    async pendingFeedback() { return { pending: true, session: { id: 'session-demo', ended_at: new Date(Date.now() - 8 * 3600000).toISOString() } }; }
    async submitFeedback(input) { return { feedback: Object.assign({ feedback_id: uuid(), submitted_at: new Date().toISOString() }, clone(input)), points_awarded: 5, balance: 125 }; }
    async preferences() { return { voice_preference: 'unspecified', forbidden_sound_tags: ['thunder'], story_themes: [], breath_templates: [], scenes: [] }; }
    async points() { return { balance: 120, entries: [] }; }
    async archive(period) { return { period: period || '7d', feedback_count: 6, comfort_trend: [], recent_feedback: [] }; }
  }

  class CommonMockAdapter {
    async currentUser() { const id = storage().getItem('mianyu_user_id') || uuid(); storage().setItem('mianyu_user_id', id); return { user_id: id, age_mode: storage().getItem('mianyu_age_mode') || 'adult', pin_configured: storage().getItem('mianyu_pin_configured') === 'true', non_medical_accepted: storage().getItem('mianyu_non_medical_accepted') === 'true' }; }
    async updateUser(input) { Object.keys(input || {}).forEach(function (key) { storage().setItem('mianyu_' + key, input[key]); }); return this.currentUser(); }
    async verifyPin(pin) { return /^\d{4}$/.test(pin); }
    async eraseAll() { storage().clear(); return { erased: true }; }
  }

  api.mocks = { ContentMockAdapter, PlanningMockAdapter, SceneMockAdapter, SessionMockAdapter, BrowserAudioEngineAdapter, GrowthMockAdapter, CommonMockAdapter };
})(typeof window !== 'undefined' ? window : globalThis);

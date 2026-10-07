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
    constructor() {
      this.activeAudio = null;
      this.tracks = new Map();
      this.activeTrackIds = new Set();
      this.fadeTimers = new Map();
      this.defaultVolume = 0.45;
      this.apiBase = (typeof window !== 'undefined' && window.__MIANYU_API_BASE_URL__) || 'http://127.0.0.1:8787';
    }
    toAbsoluteUrl(relativePath) {
      if (!relativePath) return '';
      if (/^https?:\/\//i.test(relativePath)) return relativePath;
      const base = this.apiBase.replace(/\/api\/v1\/?$/, '');
      return base + '/' + relativePath.replace(/^\/+/, '');
    }
    async resolve(assetId) {
      const req = await fetch(this.apiBase + '/content/' + encodeURIComponent(assetId) + '/playable', {
        headers: { 'X-Age-Mode': (typeof window !== 'undefined' && window.__MIANYU_AGE_MODE__) || 'adult', 'X-User-Id': (typeof window !== 'undefined' && window.__MIANYU_USER_ID__) || 'browser-preview' }
      });
      if (!req.ok) throw new Error('资源 ' + assetId + ' 不可播放 (HTTP ' + req.status + ')');
      const json = await req.json();
      const data = json.data || {};
      return Object.assign({}, data, {
        url: this.toAbsoluteUrl(data.url),
        image: this.toAbsoluteUrl(data.image)
      });
    }
    async preview(assetId, options) {
      const info = await this.resolve(assetId);
      if (!info || !info.url) throw new Error('资源 ' + assetId + ' 没有可播放链接');
      this.stopPreview();
      const audio = new Audio();
      audio.src = info.url;
      audio.loop = info.loop !== false;
      audio.preload = 'auto';
      audio.volume = (options && options.volume) || this.defaultVolume;
      // 用 5 秒兜底，不再无限等 canplay
      await new Promise((resolve, reject) => {
        const ok = () => { cleanup(); resolve(); };
        const err = () => { cleanup(); reject(new Error('音频加载失败: ' + info.url)); };
        const timer = setTimeout(() => { cleanup(); reject(new Error('音频加载超时: ' + info.url)); }, 5000);
        function cleanup() {
          audio.removeEventListener('canplay', ok);
          audio.removeEventListener('error', err);
          clearTimeout(timer);
        }
        audio.addEventListener('canplay', ok, { once: true });
        audio.addEventListener('error', err, { once: true });
      });
      await audio.play();
      this.activeAudio = audio;
      this.activeTrackIds.add(assetId);
      this.tracks.set(assetId, { audio, info });
      return { asset_id: assetId, url: info.url, playing: true };
    }
    async playOne(assetId, options) {
      // 单轨独立启动：不打断其他 track。用于"拖到场景即响"场景。
      // 如果已经有一个该 assetId 在跑，就只调音量。
      const info = await this.resolve(assetId);
      if (!info || !info.url) {
        return { asset_id: assetId, playing: false, reason: 'no-url' };
      }
      const existing = this.tracks.get(assetId);
      if (existing && existing.audio && !existing.audio.paused) {
        const v = (options && Number.isFinite(options.volume)) ? options.volume : existing.audio.volume;
        existing.audio.volume = Math.min(1, Math.max(0, v));
        return { asset_id: assetId, playing: true, reused: true };
      }
      // 否则清掉旧的（如果有的话 paused 的）再起新的
      if (existing) {
        try { existing.audio.pause(); } catch (_) {}
        this.tracks.delete(assetId);
        this.activeTrackIds.delete(assetId);
      }
      const audio = new Audio();
      audio.src = info.url;
      audio.loop = info.loop !== false;  // playable 接口告诉我们要不要 loop；缺省 loop
      audio.preload = 'auto';
      audio.volume = Math.min(1, Math.max(0, (options && options.volume) || this.defaultVolume));
      const ready = new Promise((resolve) => {
        const ok = () => { cleanup(); resolve('ok'); };
        const err = () => { cleanup(); resolve('error'); };
        const timer = setTimeout(() => { cleanup(); resolve('timeout'); }, 5000);
        function cleanup() {
          audio.removeEventListener('canplay', ok);
          audio.removeEventListener('error', err);
          clearTimeout(timer);
        }
        audio.addEventListener('canplay', ok, { once: true });
        audio.addEventListener('error', err, { once: true });
      });
      const loadResult = await ready;
      if (loadResult !== 'ok') {
        return { asset_id: assetId, playing: false, reason: loadResult };
      }
      // 记录待播放队列：autoplay 可能拒，但我们先把 audio 放进去等用户首次交互再尝试
      const entry = { audio, info, pending: true };
      this.tracks.set(assetId, entry);
      this.activeTrackIds.add(assetId);
      audio.play().then(() => {
        entry.pending = false;
        entry.autoplayBlocked = false;
      }).catch(() => {
        entry.pending = true;
        entry.autoplayBlocked = true;
      });
      return {
        asset_id: assetId,
        url: info.url,
        playing: true,           // 乐观：已加进 tracks，UI 上视为在播
        loop: audio.loop,
        duration_sec: info.duration_sec ?? null,
        autoplayBlocked: entry.autoplayBlocked === true
      };
    }
    // 用户首次交互后唤醒所有待播放音频
    async unlockPending() {
      const promises = [];
      for (const [id, entry] of this.tracks.entries()) {
        if (!entry.pending) continue;
        promises.push(
          entry.audio.play().then(() => {
            entry.pending = false; entry.autoplayBlocked = false;
            return true;
          }).catch(() => false)
        );
      }
      const settled = await Promise.all(promises);
      const unlocked = settled.filter(Boolean).length;
      const failed = settled.length - unlocked;
      return { unlocked, failed, total: this.tracks.size };
    }
    async stopOne(assetId) {
      const entry = this.tracks.get(assetId);
      if (!entry) return { asset_id: assetId, playing: false };
      try { entry.audio.pause(); } catch (_) {}
      try { entry.audio.currentTime = 0; } catch (_) {}
      this.tracks.delete(assetId);
      this.activeTrackIds.delete(assetId);
      return { asset_id: assetId, stopped: true };
    }
    // 保留指定 id 集合，停掉其他所有 track。
    // 用于：切换空间/保存/进入睡眠模式时只让当前想要的声音继续响。
    async retain(keepIds) {
      const keepSet = new Set(keepIds || []);
      const stopped = [];
      for (const [id, entry] of Array.from(this.tracks.entries())) {
        if (keepSet.has(id)) continue;
        try { entry.audio.pause(); } catch (_) {}
        try { entry.audio.currentTime = 0; } catch (_) {}
        this.tracks.delete(id);
        this.activeTrackIds.delete(id);
        stopped.push(id);
      }
      if (this.tracks.size === 0) this.activeAudio = null;
      return { kept: Array.from(keepSet), stopped };
    }
    async startScene(tracks) {
      this.stopPreview();
      const started = [];
      const blocked = [];
      for (const t of tracks) {
        const info = await this.resolve(t.assetId);
        if (!info || !info.url) {
          blocked.push({ assetId: t.assetId, reason: 'no-url' });
          continue;
        }
        const audio = new Audio();
        audio.src = info.url;
        audio.loop = true;
        audio.preload = 'auto';
        audio.volume = t.volume || 0.45;
        // 不再 await oncanplay — 浏览器会自动加载，强行等会卡死
        // 用 5 秒兜底：如果加载超时，把 reason 记下来而不是静默吞掉
        const ready = new Promise((resolve) => {
          const ok = () => { cleanup(); resolve('ok'); };
          const err = () => { cleanup(); resolve('error'); };
          const timer = setTimeout(() => { cleanup(); resolve('timeout'); }, 5000);
          function cleanup() {
            audio.removeEventListener('canplay', ok);
            audio.removeEventListener('error', err);
            clearTimeout(timer);
          }
          audio.addEventListener('canplay', ok, { once: true });
          audio.addEventListener('error', err, { once: true });
        });
        const loadResult = await ready;
        if (loadResult === 'error' || loadResult === 'timeout') {
          blocked.push({ assetId: t.assetId, reason: loadResult });
          continue;
        }
        // play() 的 autoplay 拒绝要真正告诉前端，不能吞
        let playError = null;
        audio.play().catch((e) => { playError = e; });
        this.tracks.set(t.assetId, { audio, info });
        this.activeTrackIds.add(t.assetId);
        started.push({
          assetId: t.assetId,
          url: info.url,
          playError: playError ? playError.name || 'play-rejected' : null
        });
      }
      return { playing: true, tracks: started, blocked };
    }
    async setVolume(assetId, volume) {
      const entry = this.tracks.get(assetId);
      if (!entry) return { asset_id: assetId, playing: false };
      entry.audio.volume = Math.min(1, Math.max(0, volume));
      return { asset_id: assetId, playing: !entry.audio.paused, volume: entry.audio.volume };
    }
    async fadeOut(assetId, durationMs) {
      const entry = this.tracks.get(assetId);
      if (!entry) return { asset_id: assetId, playing: false };
      const duration = durationMs || 5000;
      const startVolume = entry.audio.volume;
      const steps = 30;
      const stepMs = duration / steps;
      const stepVolume = startVolume / steps;
      return new Promise((resolve) => {
        let i = 0;
        const timer = setInterval(() => {
          i++;
          entry.audio.volume = Math.max(0, startVolume - stepVolume * i);
          if (i >= steps) {
            clearInterval(timer);
            entry.audio.pause();
            this.tracks.delete(assetId);
            this.activeTrackIds.delete(assetId);
            if (this.tracks.size === 0) this.activeAudio = null;
            resolve({ asset_id: assetId, faded: true });
          }
        }, stepMs);
      });
    }
    async stopPreview() {
      const ids = Array.from(this.activeTrackIds);
      for (const id of ids) {
        const entry = this.tracks.get(id);
        if (entry) {
          try { entry.audio.pause(); } catch (_) {}
          this.tracks.delete(id);
        }
      }
      this.activeTrackIds.clear();
      this.activeAudio = null;
      return { playing: false, stopped: ids };
    }
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

  // Local-only auth: stores accounts and tokens in localStorage. The
  // `mianyu_auth_accounts` list is a lightweight mock that mirrors the
  // server's expected payload shape, so transitioning to http transport
  // requires no UI changes.
  class AuthMockAdapter {
    async register(input) {
      const accounts = JSON.parse(storage().getItem('mianyu_auth_accounts') || '[]');
      const exists = accounts.find((a) => (input.username && a.username === input.username) || (input.phone && a.phone === input.phone));
      if (exists) throw new api.MianyuApiError(api.ErrorCodes.CONFLICT, '该账号已注册');
      const account = { account_id: uuid(), username: input.username || null, phone: input.phone || null, user_id: uuid(), age_mode: input.age_mode || 'adult', pin_configured: false };
      accounts.push(account);
      storage().setItem('mianyu_auth_accounts', JSON.stringify(accounts));
      const token = uuid().replace(/-/g, '');
      storage().setItem('mianyu_auth_token', token);
      storage().setItem('mianyu_auth_account_id', account.account_id);
      storage().setItem('mianyu_user_id', account.user_id);
      return Object.assign({}, account, { token, expires_at: new Date(Date.now() + 30 * 86400000).toISOString() });
    }
    async login(input) {
      const accounts = JSON.parse(storage().getItem('mianyu_auth_accounts') || '[]');
      const account = accounts.find((a) => (input.username && a.username === input.username) || (input.phone && a.phone === input.phone));
      if (!account) throw new api.MianyuApiError(api.ErrorCodes.UNAUTHORIZED, '账号不存在');
      const token = uuid().replace(/-/g, '');
      storage().setItem('mianyu_auth_token', token);
      storage().setItem('mianyu_auth_account_id', account.account_id);
      storage().setItem('mianyu_user_id', account.user_id);
      return Object.assign({}, account, { token, expires_at: new Date(Date.now() + 30 * 86400000).toISOString() });
    }
    async me() {
      const accountId = storage().getItem('mianyu_auth_account_id');
      const accounts = JSON.parse(storage().getItem('mianyu_auth_accounts') || '[]');
      const account = accounts.find((a) => a.account_id === accountId);
      if (!account) throw new api.MianyuApiError(api.ErrorCodes.UNAUTHORIZED, '未登录');
      return account;
    }
    async logout() {
      storage().removeItem('mianyu_auth_token');
      storage().removeItem('mianyu_auth_account_id');
      return { ok: true };
    }
  }

  api.mocks = { ContentMockAdapter, PlanningMockAdapter, SceneMockAdapter, SessionMockAdapter, BrowserAudioEngineAdapter, GrowthMockAdapter, CommonMockAdapter, AuthMockAdapter };
})(typeof window !== 'undefined' ? window : globalThis);

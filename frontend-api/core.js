(function initMianyuCore(global) {
  'use strict';

  const root = global.MianyuApi = global.MianyuApi || {};

  class MianyuApiError extends Error {
    constructor(code, message, options) {
      super(message);
      this.name = 'MianyuApiError';
      this.code = code || 'UNKNOWN';
      this.status = options && options.status || 0;
      this.details = options && options.details;
      this.cause = options && options.cause;
    }
  }

  const ErrorCodes = Object.freeze({
    NETWORK: 'NETWORK_ERROR',
    TIMEOUT: 'REQUEST_TIMEOUT',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    VALIDATION: 'VALIDATION_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    INTERNAL: 'INTERNAL_ERROR'
  });

  function uuid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (token) {
      const value = Math.random() * 16 | 0;
      return (token === 'x' ? value : value & 3 | 8).toString(16);
    });
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function ensure(condition, code, message, details) {
    if (!condition) throw new MianyuApiError(code || ErrorCodes.VALIDATION, message, { details: details });
  }

  function createMemoryStorage() {
    const values = new Map();
    return {
      getItem: function (key) { return values.has(key) ? values.get(key) : null; },
      setItem: function (key, value) { values.set(key, String(value)); },
      removeItem: function (key) { values.delete(key); },
      clear: function () { values.clear(); }
    };
  }

  const fallbackStorage = createMemoryStorage();
  function storage() {
    try { return global.localStorage || fallbackStorage; } catch (_) { return fallbackStorage; }
  }

  class HttpClient {
    constructor(options) {
      const config = options || {};
      this.baseUrl = String(config.baseUrl || 'http://127.0.0.1:8787/api/v1').replace(/\/$/, '');
      this.timeoutMs = Number(config.timeoutMs || 6000);
      this.fetchImpl = config.fetchImpl || global.fetch && global.fetch.bind(global);
      this.userIdProvider = config.userIdProvider || function () { return storage().getItem('mianyu_user_id'); };
    }

    async request(path, options) {
      if (!this.fetchImpl) throw new MianyuApiError(ErrorCodes.NETWORK, '当前环境不支持网络请求');
      const config = options || {};
      const controller = new AbortController();
      const timer = setTimeout(function () { controller.abort(); }, config.timeoutMs || this.timeoutMs);
      const headers = { Accept: 'application/json' };
      const userId = this.userIdProvider();
      if (userId) headers['X-User-Id'] = userId;
      Object.assign(headers, config.headers || {});
      if (config.idempotencyKey) headers['Idempotency-Key'] = config.idempotencyKey;
      if (config.body != null) headers['Content-Type'] = 'application/json';
      try {
        const response = await this.fetchImpl(this.baseUrl + path, {
          method: config.method || 'GET',
          headers: headers,
          body: config.body == null ? undefined : JSON.stringify(config.body),
          signal: controller.signal
        });
        const text = await response.text();
        let payload = null;
        if (text) {
          try { payload = JSON.parse(text); }
          catch (cause) { throw new MianyuApiError(ErrorCodes.INVALID_RESPONSE, '服务端返回了无法解析的数据', { status: response.status, cause: cause }); }
        }
        if (!response.ok) {
          const remote = payload && payload.error || {};
          const code = remote.code || (response.status === 404 ? ErrorCodes.NOT_FOUND : response.status === 409 ? ErrorCodes.CONFLICT : response.status === 401 ? ErrorCodes.UNAUTHORIZED : ErrorCodes.INTERNAL);
          throw new MianyuApiError(code, remote.message || '请求失败', { status: response.status, details: remote.details });
        }
        return payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
      } catch (error) {
        if (error instanceof MianyuApiError) throw error;
        if (error && error.name === 'AbortError') throw new MianyuApiError(ErrorCodes.TIMEOUT, '请求超时，请稍后重试', { cause: error });
        throw new MianyuApiError(ErrorCodes.NETWORK, '无法连接眠屿服务', { cause: error });
      } finally {
        clearTimeout(timer);
      }
    }
  }

  root.MianyuApiError = MianyuApiError;
  root.ErrorCodes = ErrorCodes;
  root.HttpClient = HttpClient;
  root.utils = { uuid: uuid, clone: clone, ensure: ensure, storage: storage };
})(typeof window !== 'undefined' ? window : globalThis);

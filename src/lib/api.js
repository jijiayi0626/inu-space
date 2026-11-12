const BASE = '/api';
const DEFAULT_TTL = 30_000;

const cache = new Map();
const inflight = new Map();

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function readError(payload, status) {
  const error = payload?.error;
  if (error?.message) return error;
  if (status === 401) return { code: 'UNAUTHORIZED', message: '登录状态已失效，请重新登录' };
  return { code: 'REQUEST_FAILED', message: '服务暂时不可用，请稍后重试' };
}

async function rawRequest(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', '无法连接服务，请检查网络后重试');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') {
      window.dispatchEvent(new CustomEvent('inu:unauthorized'));
    }
    const error = readError(payload, response.status);
    throw new ApiError(response.status, error.code, error.message);
  }

  return payload;
}

export function clearApiCache() {
  cache.clear();
  inflight.clear();
}

export const api = {
  get(path, { ttl = DEFAULT_TTL, force = false } = {}) {
    const key = `GET ${path}`;

    if (!force && ttl > 0) {
      const hit = cache.get(key);
      if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.data);
    }

    if (!force && inflight.has(key)) return inflight.get(key);

    const promise = rawRequest(path)
      .then((data) => {
        if (ttl > 0) cache.set(key, { data, expiresAt: Date.now() + ttl });
        return data;
      })
      .finally(() => inflight.delete(key));

    inflight.set(key, promise);
    return promise;
  },

  async post(path, body) {
    const data = await rawRequest(path, { method: 'POST', body });
    clearApiCache();
    return data;
  },

  async patch(path, body) {
    const data = await rawRequest(path, { method: 'PATCH', body });
    clearApiCache();
    return data;
  },

  async del(path) {
    const data = await rawRequest(path, { method: 'DELETE' });
    clearApiCache();
    return data;
  },
};

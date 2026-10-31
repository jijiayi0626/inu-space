import { reactive } from 'vue';
import { api, clearApiCache } from './api';

export const session = reactive({
  user: null,
  ready: false,
  pending: null,
});

export function setUser(user) {
  session.user = user;
  session.ready = true;
  session.pending = null;
}

export function clearSession() {
  session.user = null;
  session.ready = true;
  session.pending = null;
  clearApiCache();
}

export async function ensureSession({ force = false } = {}) {
  if (session.ready && !force) return Boolean(session.user);
  if (session.pending) return session.pending;

  session.pending = (async () => {
    try {
      const data = await api.get('/me', { ttl: 0, force: true });
      session.user = data.user;
      return true;
    } catch (error) {
      if (error.status === 401) {
        session.user = null;
        return false;
      }
      throw error;
    } finally {
      session.ready = true;
      session.pending = null;
    }
  })();

  return session.pending;
}

export async function login(email, password) {
  const data = await api.post('/auth/login', { email, password });
  setUser(data.user);
  return data.user;
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } finally {
    clearSession();
  }
}

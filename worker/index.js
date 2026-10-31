// INU 星际通行证 · Cloudflare Workers API
// Hono + D1 + Static Assets。所有页面数据通过单个聚合接口返回，
// 配合前端 30 秒缓存，显著减少 Function 调用次数。

import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import {
  TIERS,
  TIER_MAP,
  BENEFITS,
  PRODUCTS,
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNELS,
  SUPPLY_TIPS,
  SECURITY_ADVICE,
} from './data.js';

const app = new Hono();

const SESSION_COOKIE = 'inu_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// 兼顾 Workers 免费版 10ms CPU 限制；生产环境建议升级 Paid 后提高至 120k+。
const PBKDF2_ITERATIONS = 12000;
const encoder = new TextEncoder();

/* ------------------------------------------------------------------ */
/* 基础工具                                                             */
/* ------------------------------------------------------------------ */

const bytesToHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

const hexToBytes = (hex) => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

const bytesToBase64Url = (bytes) => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const nowIso = () => new Date().toISOString();

const safeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function pbkdf2Hex(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = bytesToHex(salt);
  const hash = await pbkdf2Hex(password, saltHex, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${hash}`;
}

async function verifyPassword(stored, password) {
  try {
    const [scheme, iterations, salt, expected] = String(stored).split('$');
    if (scheme !== 'pbkdf2' || !salt || !expected) return false;
    const actual = await pbkdf2Hex(password, salt, Number(iterations) || PBKDF2_ITERATIONS);
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}

function jsonError(c, status, code, message) {
  return c.json({ error: { code, message } }, status, { 'Cache-Control': 'no-store' });
}

function ok(c, data) {
  return c.json(data, 200, { 'Cache-Control': 'private, no-store' });
}

async function readJson(c) {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

function daysSince(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function dateLabel() {
  const shanghai = new Date(Date.now() + 8 * 3600 * 1000);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${shanghai.getUTCFullYear()} 年 ${shanghai.getUTCMonth() + 1} 月 ${shanghai.getUTCDate()} 日 · ${weekdays[shanghai.getUTCDay()]}`;
}

function monthStartIso() {
  const shanghai = new Date(Date.now() + 8 * 3600 * 1000);
  const year = shanghai.getUTCFullYear();
  const month = String(shanghai.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01T00:00:00`;
}

function clientIp(c) {
  return (
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}

function clientLocation(c) {
  const cf = c.req.raw.cf;
  if (cf?.city && cf?.country) return `${cf.city} · ${cf.country}`;
  return '上海 · 中国';
}

function detectDevice(c) {
  const ua = c.req.header('User-Agent') || '';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android 终端';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'MacBook Pro';
  if (/Windows/i.test(ua)) return 'Windows 终端';
  return '星际终端';
}

function tierOf(userRow) {
  return TIER_MAP[userRow.member_tier] || TIERS[0];
}

function serializeUser(row) {
  const tier = tierOf(row);
  return {
    id: row.id,
    email: row.email,
    name: row.display_name,
    inuId: row.inu_id,
    orbit: row.orbit_code,
    region: row.region,
    bio: row.bio,
    avatarText: row.avatar_text,
    level: row.level,
    tier: tier.key,
    tierLabel: tier.label,
    tierEn: tier.en,
    particles: row.particles,
    starEnergyCents: row.star_energy_cents,
    miles: row.miles,
    verified: Boolean(row.verified),
    phone: row.phone || '',
    twoFa: Boolean(row.two_fa),
    guards: {
      geo: Boolean(row.guard_geo),
      device: Boolean(row.guard_device),
      sensitive: Boolean(row.guard_sensitive),
    },
    passwordChangedAt: row.password_changed_at,
    createdAt: row.created_at,
    lastLogin: {
      at: row.last_login_at,
      device: row.last_login_device,
      location: row.last_login_location,
      ip: row.last_login_ip,
    },
  };
}

function serializeDevice(row) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    os: row.os,
    ip: row.ip,
    location: row.location,
    method: row.method,
    lastActiveAt: row.last_active_at,
    trusted: Boolean(row.trusted),
    current: Boolean(row.is_current),
    stale: daysSince(row.last_active_at) > 30,
  };
}

async function addSecurityLog(db, userId, event, detail, tone = 'green', icon = 'i-check') {
  await db
    .prepare(
      'INSERT INTO security_logs (user_id, event, detail, tone, icon, occurred_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(userId, event, detail, tone, icon, nowIso())
    .run();
}

async function addActivity(db, userId, title, detail, tone = 'blue', icon = 'i-spark') {
  await db
    .prepare(
      'INSERT INTO activities (user_id, title, detail, tone, icon, occurred_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(userId, title, detail, tone, icon, nowIso())
    .run();
}

/* ------------------------------------------------------------------ */
/* 第三方登录                                                           */
/* ------------------------------------------------------------------ */

const OAUTH_COOKIE = 'inu_oauth';
const OAUTH_TTL_MS = 10 * 60 * 1000;

const OAUTH_PROVIDERS = {
  github: {
    id: 'github',
    label: 'GitHub',
    backup: false,
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
  },
  google: {
    id: 'google',
    label: 'Google',
    backup: true,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
  },
};

const isHttps = (c) => new URL(c.req.url).protocol === 'https:';

function randomBase64Url(size = 32) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(size)));
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function safeRedirect(value, origin) {
  try {
    const url = new URL(String(value || '/'), origin);
    if (url.origin !== origin) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

function oauthConfig(c, id) {
  const provider = OAUTH_PROVIDERS[id];
  if (!provider) return null;
  const clientId = c.env[provider.clientIdEnv];
  const clientSecret = c.env[provider.clientSecretEnv];
  return { provider, clientId, clientSecret, enabled: Boolean(clientId && clientSecret) };
}

function readOAuthCookie(c) {
  const raw = getCookie(c, OAUTH_COOKIE);
  if (!raw) return null;
  try {
    const pad = raw.length % 4 ? '='.repeat(4 - (raw.length % 4)) : '';
    const binary = atob(raw.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object') return null;
    return {
      s: String(data.s || ''),
      p: String(data.p || ''),
      r: String(data.r || '/'),
      v: String(data.v || ''),
    };
  } catch {
    return null;
  }
}

function oauthErrorRedirect(c, code, providerId) {
  const url = new URL('/login', new URL(c.req.url).origin);
  url.searchParams.set('oauth_error', code);
  if (providerId) url.searchParams.set('provider', providerId);
  c.header('Cache-Control', 'no-store');
  return c.redirect(url.toString(), 302);
}

async function exchangeOAuthCode(cfg, code, redirectUri, verifier) {
  const body = new URLSearchParams();
  body.set('client_id', cfg.clientId);
  body.set('client_secret', cfg.clientSecret);
  body.set('code', code);
  body.set('redirect_uri', redirectUri);
  if (cfg.provider.id === 'google') body.set('grant_type', 'authorization_code');
  if (verifier) body.set('code_verifier', verifier);

  const res = await fetch(cfg.provider.tokenUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'inu-space-pass',
    },
    body,
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error || !data?.access_token) throw new Error('oauth_token');
  return data.access_token;
}

async function fetchOAuthJson(url, accessToken) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'User-Agent': 'inu-space-pass',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`oauth_profile_${res.status}`);
  return res.json();
}

async function fetchOAuthIdentity(provider, accessToken) {
  if (provider.id === 'github') {
    const profile = await fetchOAuthJson('https://api.github.com/user', accessToken);
    const emails = await fetchOAuthJson('https://api.github.com/user/emails', accessToken);
    const list = Array.isArray(emails) ? emails : [];
    const verified = list.find((item) => item.primary && item.verified) || list.find((item) => item.verified);
    if (!profile?.id || !verified?.email) throw new Error('oauth_email');
    return {
      subject: String(profile.id),
      email: String(verified.email).trim().toLowerCase(),
      name: profile.name || profile.login || verified.email.split('@')[0],
    };
  }

  const profile = await fetchOAuthJson('https://openidconnect.googleapis.com/v1/userinfo', accessToken);
  const emailVerified = profile?.email_verified === true || profile?.email_verified === 'true';
  if (!profile?.sub || !profile?.email || !emailVerified) throw new Error('oauth_email');
  return {
    subject: String(profile.sub),
    email: String(profile.email).trim().toLowerCase(),
    name: profile.name || String(profile.email).split('@')[0],
  };
}

function cleanDisplayName(value, fallback) {
  const raw = String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  const name = Array.from(raw).slice(0, 24).join('');
  return name || Array.from(String(fallback || '星际旅者')).slice(0, 24).join('');
}

function avatarTextOf(name) {
  return Array.from(name)[0] || '星';
}

function randomDigits(size) {
  return [...crypto.getRandomValues(new Uint8Array(size))].map((byte) => byte % 10).join('');
}

async function uniqueInuId(db) {
  for (let i = 0; i < 6; i += 1) {
    const inuId = `INU·${randomDigits(5)}·${randomDigits(4)}`;
    const exists = await db.prepare('SELECT 1 AS hit FROM users WHERE inu_id = ?').bind(inuId).first();
    if (!exists) return { inuId, orbit: inuId.replace(/·/g, '-') };
  }
  const fallback = `INU·${String(Date.now()).slice(-5)}·${randomDigits(4)}`;
  return { inuId: fallback, orbit: fallback.replace(/·/g, '-') };
}

async function findOrCreateOAuthUser(c, provider, identity) {
  const db = c.env.DB;
  const linked = await db
    .prepare('SELECT * FROM oauth_accounts WHERE provider = ? AND subject = ?')
    .bind(provider.id, identity.subject)
    .first();

  if (linked) {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(linked.user_id).first();
    if (!user) throw new Error('oauth_user_missing');
    await db
      .prepare('UPDATE oauth_accounts SET email = ?, last_login_at = ? WHERE id = ?')
      .bind(identity.email, nowIso(), linked.id)
      .run();
    return { user, created: false };
  }

  let user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(identity.email).first();
  let created = false;

  if (!user) {
    const name = cleanDisplayName(identity.name, identity.email.split('@')[0]);
    const { inuId, orbit } = await uniqueInuId(db);
    try {
      const inserted = await db
        .prepare(
          `INSERT INTO users (
             email, password_hash, display_name, inu_id, orbit_code, region, bio, avatar_text,
             level, member_tier, particles, star_energy_cents, miles, verified, phone,
             two_fa, guard_geo, guard_device, guard_sensitive
           ) VALUES (?, ?, ?, ?, ?, '', '', ?, 1, 'stardust', 0, 0, 0, 0, NULL, 0, 1, 1, 0)`,
        )
        .bind(identity.email, `oauth$${randomBase64Url(24)}`, name, inuId, orbit, avatarTextOf(name))
        .run();
      user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(inserted.meta?.last_row_id).first();
      created = true;
    } catch (error) {
      user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(identity.email).first();
      if (!user) throw error;
    }
  }

  try {
    await db
      .prepare(
        'INSERT INTO oauth_accounts (user_id, provider, subject, email, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(user.id, provider.id, identity.subject, identity.email, nowIso(), nowIso())
      .run();
  } catch (error) {
    const exists = await db
      .prepare('SELECT 1 AS hit FROM oauth_accounts WHERE provider = ? AND subject = ?')
      .bind(provider.id, identity.subject)
      .first();
    if (!exists) throw error;
  }

  if (created) {
    try {
      await addActivity(db, user.id, '加入 INU 星际网络', `通过 ${provider.label} 创建通行证`, 'blue', 'i-spark');
    } catch {
      /* 活动记录失败不影响登录 */
    }
  }

  return { user, created };
}

async function createSessionForUser(c, user, event = '登录成功') {
  const db = c.env.DB;
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(nowIso()).run();

  const token = randomBase64Url(32);
  const tokenHash = await sha256Hex(token);
  const loginAt = nowIso();
  const ip = clientIp(c);
  const location = clientLocation(c);
  const device = detectDevice(c);

  await db
    .prepare(
      `INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ip, location, user_agent, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    )
    .bind(
      tokenHash,
      user.id,
      loginAt,
      new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      ip,
      location,
      c.req.header('User-Agent') || '',
    )
    .run();

  await db
    .prepare(
      'UPDATE users SET last_login_at = ?, last_login_ip = ?, last_login_device = ?, last_login_location = ? WHERE id = ?',
    )
    .bind(loginAt, ip, device, location, user.id)
    .run();

  await addSecurityLog(db, user.id, event, `${device} · ${location}`, 'green', 'i-check');

  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: isHttps(c),
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });

  return {
    ...user,
    last_login_at: loginAt,
    last_login_ip: ip,
    last_login_device: device,
    last_login_location: location,
  };
}

/* ------------------------------------------------------------------ */
/* 会话                                                                 */
/* ------------------------------------------------------------------ */

async function requireSession(c, next) {
  const path = c.req.path;
  if (
    path === '/api/auth/login' ||
    path === '/api/auth/providers' ||
    path === '/api/health' ||
    path.startsWith('/api/auth/oauth/')
  ) {
    return next();
  }

  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return jsonError(c, 401, 'UNAUTHORIZED', '登录状态已失效，请重新进入星际通行证');

  const tokenHash = await sha256Hex(token);
  const user = await c.env.DB.prepare(
    `SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(tokenHash, nowIso())
    .first();

  if (!user) {
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return jsonError(c, 401, 'UNAUTHORIZED', '登录状态已失效，请重新进入星际通行证');
  }

  c.set('userRow', user);
  c.set('tokenHash', tokenHash);
  return next();
}

app.use('/api/*', requireSession);

app.use('/api/*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-Frame-Options', 'DENY');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
});

/* ------------------------------------------------------------------ */
/* 认证                                                                 */
/* ------------------------------------------------------------------ */

app.get('/api/health', (c) =>
  c.json({ ok: true, service: 'inu-space-pass', now: nowIso() }, 200, { 'Cache-Control': 'no-store' }),
);

app.post('/api/auth/login', async (c) => {
  const db = c.env.DB;
  const body = await readJson(c);
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');

  if (!email || !password) {
    return jsonError(c, 400, 'INVALID_INPUT', '请输入邮箱与密码');
  }

  const now = Date.now();
  const guard = await db.prepare('SELECT * FROM login_guards WHERE email = ?').bind(email).first();
  if (guard?.locked_until && new Date(guard.locked_until).getTime() > now) {
    const minutes = Math.ceil((new Date(guard.locked_until).getTime() - now) / 60000);
    return jsonError(c, 429, 'TOO_MANY_ATTEMPTS', `尝试次数过多，请在 ${minutes} 分钟后重试`);
  }

  const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  const valid = user ? await verifyPassword(user.password_hash, password) : false;

  if (!valid) {
    const failures = (guard?.failures || 0) + 1;
    const lockedUntil = failures >= 5 ? new Date(now + 15 * 60 * 1000).toISOString() : null;
    await db
      .prepare(
        `INSERT INTO login_guards (email, failures, first_failure_at, locked_until)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           failures = excluded.failures,
           first_failure_at = COALESCE(login_guards.first_failure_at, excluded.first_failure_at),
           locked_until = excluded.locked_until`,
      )
      .bind(email, failures, guard?.first_failure_at || nowIso(), lockedUntil)
      .run();
    return jsonError(c, 401, 'INVALID_CREDENTIALS', '邮箱或密码不正确，请检查后重试');
  }

  await db.prepare('DELETE FROM login_guards WHERE email = ?').bind(email).run();
  const sessionUser = await createSessionForUser(c, user);
  return ok(c, { user: serializeUser(sessionUser) });
});

app.get('/api/auth/providers', (c) => {
  const providers = Object.values(OAUTH_PROVIDERS).map((provider) => ({
    id: provider.id,
    label: provider.label,
    backup: Boolean(provider.backup),
    enabled: oauthConfig(c, provider.id).enabled,
  }));
  return ok(c, { providers });
});

app.get('/api/auth/oauth/:provider/start', async (c) => {
  const id = c.req.param('provider');
  const cfg = oauthConfig(c, id);
  if (!cfg) return jsonError(c, 404, 'UNKNOWN_PROVIDER', '未知的第三方登录方式');
  if (!cfg.enabled) return jsonError(c, 503, 'OAUTH_NOT_CONFIGURED', '该第三方登录尚未配置');

  const origin = new URL(c.req.url).origin;
  const redirect = safeRedirect(c.req.query('redirect'), origin);
  const state = randomBase64Url(32);
  const verifier = id === 'google' ? randomBase64Url(32) : '';
  const payload = bytesToBase64Url(
    encoder.encode(JSON.stringify({ s: state, p: id, r: redirect, v: verifier })),
  );

  setCookie(c, OAUTH_COOKIE, payload, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: isHttps(c),
    path: '/api/auth/oauth',
    maxAge: OAUTH_TTL_MS / 1000,
  });

  const callbackUrl = `${origin}/api/auth/oauth/${id}/callback`;
  const url = new URL(cfg.provider.authorizeUrl);
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', cfg.provider.scope);
  url.searchParams.set('state', state);
  if (id === 'github') {
    url.searchParams.set('allow_signup', 'true');
  } else {
    url.searchParams.set('access_type', 'online');
    url.searchParams.set('prompt', 'select_account');
    url.searchParams.set('code_challenge', await sha256Base64Url(verifier));
    url.searchParams.set('code_challenge_method', 'S256');
  }

  c.header('Cache-Control', 'no-store');
  return c.redirect(url.toString(), 302);
});

app.get('/api/auth/oauth/:provider/callback', async (c) => {
  const id = c.req.param('provider');
  const cfg = oauthConfig(c, id);
  if (!cfg || !cfg.enabled) return oauthErrorRedirect(c, 'provider_unavailable', id);

  const origin = new URL(c.req.url).origin;
  const stored = readOAuthCookie(c);
  deleteCookie(c, OAUTH_COOKIE, { path: '/api/auth/oauth' });

  const providerError = c.req.query('error');
  if (providerError) {
    return oauthErrorRedirect(c, providerError === 'access_denied' ? 'cancelled' : 'provider_error', id);
  }

  const state = c.req.query('state') || '';
  const code = c.req.query('code') || '';
  if (!stored || stored.p !== id || !state || !stored.s || !safeEqual(stored.s, state)) {
    return oauthErrorRedirect(c, 'state', id);
  }
  if (!code) return oauthErrorRedirect(c, 'code', id);

  const redirect = safeRedirect(stored.r, origin);
  try {
    const callbackUrl = `${origin}/api/auth/oauth/${id}/callback`;
    const accessToken = await exchangeOAuthCode(cfg, code, callbackUrl, stored.v);
    const identity = await fetchOAuthIdentity(cfg.provider, accessToken);
    const { user } = await findOrCreateOAuthUser(c, cfg.provider, identity);
    await createSessionForUser(c, user, '第三方登录成功');
    c.header('Cache-Control', 'no-store');
    return c.redirect(`${origin}${redirect}`, 302);
  } catch (error) {
    console.error('oauth callback failed', id, error?.message || error);
    return oauthErrorRedirect(c, error?.message === 'oauth_email' ? 'email' : 'failed', id);
  }
});

app.post('/api/auth/logout', async (c) => {
  const tokenHash = c.get('tokenHash');
  await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return ok(c, { ok: true });
});

app.get('/api/me', (c) => {
  const user = c.get('userRow');
  return ok(c, { user: serializeUser(user), dateLabel: dateLabel() });
});

/* ------------------------------------------------------------------ */
/* 总览                                                                 */
/* ------------------------------------------------------------------ */

app.get('/api/overview', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');

  const [deviceCount, agreements, activities] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS count FROM devices WHERE user_id = ?').bind(user.id).first(),
    db
      .prepare(
        `SELECT COUNT(*) AS total,
          SUM(CASE WHEN status = 'signed' THEN 1 ELSE 0 END) AS signed
         FROM agreements WHERE user_id = ?`,
      )
      .bind(user.id)
      .first(),
    db
      .prepare('SELECT * FROM activities WHERE user_id = ? ORDER BY occurred_at DESC LIMIT 4')
      .bind(user.id)
      .all(),
  ]);

  return ok(c, {
    user: serializeUser(user),
    dateLabel: dateLabel(),
    wallet: { balanceCents: user.star_energy_cents, cardLast4: '0721' },
    counts: {
      devices: deviceCount?.count || 0,
      agreementsSigned: agreements?.signed || 0,
      agreementsTotal: agreements?.total || 0,
    },
    activities: activities.results.map((row) => ({
      id: row.id,
      title: row.title,
      detail: row.detail,
      tone: row.tone,
      icon: row.icon,
      occurredAt: row.occurred_at,
    })),
  });
});

/* ------------------------------------------------------------------ */
/* 个人资料                                                             */
/* ------------------------------------------------------------------ */

app.get('/api/profile', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');

  const [devices, agreements] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS count FROM devices WHERE user_id = ?').bind(user.id).first(),
    db
      .prepare(
        `SELECT COUNT(*) AS total,
          SUM(CASE WHEN status = 'signed' THEN 1 ELSE 0 END) AS signed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
         FROM agreements WHERE user_id = ?`,
      )
      .bind(user.id)
      .first(),
  ]);

  return ok(c, {
    user: serializeUser(user),
    joinedDays: daysSince(user.created_at),
    counts: {
      devices: devices?.count || 0,
      agreementsSigned: agreements?.signed || 0,
      agreementsTotal: agreements?.total || 0,
      agreementsPending: agreements?.pending || 0,
    },
    memberSince: user.created_at,
  });
});

app.patch('/api/profile', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const bio = String(body.bio || '').trim();

  const nameLength = [...name].length;
  if (nameLength < 2 || nameLength > 16) {
    return jsonError(c, 400, 'INVALID_NAME', '昵称需为 2–16 个字符');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError(c, 400, 'INVALID_EMAIL', '请输入有效的邮箱地址');
  }
  if ([...bio].length > 60) {
    return jsonError(c, 400, 'INVALID_BIO', '星际签名最多 60 个字符');
  }

  const conflict = await db
    .prepare('SELECT id FROM users WHERE email = ? AND id <> ?')
    .bind(email, user.id)
    .first();
  if (conflict) return jsonError(c, 409, 'EMAIL_TAKEN', '该邮箱已被其他星际档案使用');

  await db
    .prepare('UPDATE users SET display_name = ?, email = ?, bio = ? WHERE id = ?')
    .bind(name, email, bio, user.id)
    .run();

  const updated = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  return ok(c, { user: serializeUser(updated) });
});

app.post('/api/profile/verify', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  if (user.verified) {
    return ok(c, { user: serializeUser(user), message: '星际公民身份已认证' });
  }

  await db.prepare('UPDATE users SET verified = 1 WHERE id = ?').bind(user.id).run();
  await addSecurityLog(db, user.id, '星际公民认证完成', '身份核验通过 · 权限已解锁', 'green', 'i-idcard');
  await addActivity(db, user.id, '完成星际公民认证', '补给站下单与星能提现已解锁', 'purple', 'i-idcard');

  const updated = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  return ok(c, { user: serializeUser(updated) });
});

/* ------------------------------------------------------------------ */
/* 账户安全                                                             */
/* ------------------------------------------------------------------ */

app.get('/api/security', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const logs = await db
    .prepare('SELECT * FROM security_logs WHERE user_id = ? ORDER BY occurred_at DESC LIMIT 4')
    .bind(user.id)
    .all();

  const score = 82 + (user.two_fa ? 8 : 0) + (user.phone ? 6 : 0);

  return ok(c, {
    user: serializeUser(user),
    score,
    scoreLabel: score >= 90 ? '防护严密' : '仍有提升空间',
    percentile: '高于 78% 星际公民',
    items: [
      { label: '密码强度', value: '中等' },
      { label: '两步验证', value: user.two_fa ? '已开启' : '未开启' },
      { label: '绑定手机', value: user.phone ? '已绑定' : '未绑定' },
    ],
    credentials: {
      email: user.email,
      emailVerified: true,
      phone: user.phone || '',
      passwordAgeDays: daysSince(user.password_changed_at),
    },
    guards: {
      geo: Boolean(user.guard_geo),
      device: Boolean(user.guard_device),
      sensitive: Boolean(user.guard_sensitive),
    },
    logs: logs.results.map((row) => ({
      id: row.id,
      event: row.event,
      detail: row.detail,
      tone: row.tone,
      icon: row.icon,
      occurredAt: row.occurred_at,
    })),
    advice: SECURITY_ADVICE,
  });
});

app.post('/api/security/2fa', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const body = await readJson(c);
  const enabled = Boolean(body?.enabled);

  await db.prepare('UPDATE users SET two_fa = ? WHERE id = ?').bind(enabled ? 1 : 0, user.id).run();
  await addSecurityLog(
    db,
    user.id,
    enabled ? '两步验证已开启' : '两步验证已关闭',
    enabled ? '动态验证码已加入登录流程' : '账户防护等级有所降低',
    enabled ? 'green' : 'orange',
    'i-shield',
  );

  return ok(c, { twoFa: enabled, score: 82 + (enabled ? 8 : 0) + (user.phone ? 6 : 0) });
});

app.patch('/api/security/guards', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const body = await readJson(c);
  const key = String(body?.key || '');
  const enabled = Boolean(body?.enabled);
  const columns = { geo: 'guard_geo', device: 'guard_device', sensitive: 'guard_sensitive' };
  const column = columns[key];
  if (!column) return jsonError(c, 400, 'INVALID_INPUT', '未知的登录保护项');

  await db.prepare(`UPDATE users SET ${column} = ? WHERE id = ?`).bind(enabled ? 1 : 0, user.id).run();
  const labels = {
    geo: '异地登录验证',
    device: '新终端验证',
    sensitive: '敏感操作二次确认',
  };
  await addSecurityLog(
    db,
    user.id,
    `${labels[key]}已${enabled ? '开启' : '关闭'}`,
    '登录保护策略已更新',
    enabled ? 'green' : 'orange',
    'i-shield',
  );

  return ok(c, { key, enabled });
});

app.post('/api/security/password', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const body = await readJson(c);
  const current = String(body?.current || '');
  const next = String(body?.next || '');

  if (!current || !next) return jsonError(c, 400, 'INVALID_INPUT', '请填写当前密码与新密码');
  if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
    return jsonError(c, 400, 'WEAK_PASSWORD', '新密码至少 8 位，且需同时包含字母与数字');
  }
  if (current === next) return jsonError(c, 400, 'SAME_PASSWORD', '新密码不能与当前密码相同');

  const valid = await verifyPassword(user.password_hash, current);
  if (!valid) return jsonError(c, 400, 'INVALID_PASSWORD', '当前密码不正确');

  const hash = await hashPassword(next);
  await db
    .prepare('UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?')
    .bind(hash, nowIso(), user.id)
    .run();
  await db
    .prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?')
    .bind(user.id, c.get('tokenHash'))
    .run();

  await addSecurityLog(db, user.id, '登录密码已更新', '其余终端已退出登录', 'green', 'i-lock');
  return ok(c, { ok: true, message: '登录密码已更新，星际密钥已同步' });
});

/* ------------------------------------------------------------------ */
/* 星际终端                                                             */
/* ------------------------------------------------------------------ */

app.get('/api/devices', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const [devices, logs] = await Promise.all([
    db.prepare('SELECT * FROM devices WHERE user_id = ? ORDER BY is_current DESC, last_active_at DESC').bind(user.id).all(),
    db
      .prepare('SELECT * FROM security_logs WHERE user_id = ? ORDER BY occurred_at DESC LIMIT 4')
      .bind(user.id)
      .all(),
  ]);

  return ok(c, {
    devices: devices.results.map(serializeDevice),
    current: devices.results.filter((row) => row.is_current).map(serializeDevice)[0] || null,
    logs: logs.results.map((row) => ({
      id: row.id,
      event: row.event,
      detail: row.detail,
      tone: row.tone,
      icon: row.icon,
      occurredAt: row.occurred_at,
    })),
  });
});

app.post('/api/devices/:id/unbind', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const id = Number(c.req.param('id'));
  const device = await db
    .prepare('SELECT * FROM devices WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first();

  if (!device) return jsonError(c, 404, 'NOT_FOUND', '未找到该星际终端');
  if (device.is_current) return jsonError(c, 400, 'CURRENT_DEVICE', '当前设备无法直接解绑');

  await db.prepare('DELETE FROM devices WHERE id = ?').bind(id).run();
  await addSecurityLog(db, user.id, '终端已解绑', `${device.name} · ${device.location}`, 'orange', 'i-device');
  await addActivity(db, user.id, '解绑星际终端', `${device.name} 已退出星际网络`, 'orange', 'i-device');

  return ok(c, { ok: true });
});

app.post('/api/devices/logout-others', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const tokenHash = c.get('tokenHash');
  const result = await db
    .prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?')
    .bind(user.id, tokenHash)
    .run();

  await addSecurityLog(db, user.id, '其余终端已退出', '仅保留当前会话', 'blue', 'i-shield');
  return ok(c, { ok: true, removed: result.meta?.changes || 0 });
});

/* ------------------------------------------------------------------ */
/* 通知偏好                                                             */
/* ------------------------------------------------------------------ */

const PREF_KEYS = new Set([
  ...NOTIFICATION_TYPES.map((t) => t.key),
  ...NOTIFICATION_CHANNELS.map((ch) => ch.key),
]);

app.get('/api/notifications', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const [prefs, settings, deviceCount] = await Promise.all([
    db.prepare('SELECT key, enabled FROM notification_prefs WHERE user_id = ?').bind(user.id).all(),
    db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').bind(user.id).first(),
    db.prepare('SELECT COUNT(*) AS count FROM devices WHERE user_id = ?').bind(user.id).first(),
  ]);

  const prefMap = Object.fromEntries(prefs.results.map((row) => [row.key, Boolean(row.enabled)]));
  const deviceTotal = deviceCount?.count || 0;

  return ok(c, {
    categories: NOTIFICATION_TYPES.map((item) => ({
      ...item,
      enabled: prefMap[item.key] ?? true,
    })),
    channels: NOTIFICATION_CHANNELS.map((item) => {
      if (item.key === 'channel_sms') {
        return {
          ...item,
          enabled: false,
          available: false,
          status: user.phone ? { label: '已验证', tone: 'green' } : { label: '未绑定', tone: 'red' },
        };
      }
      if (item.key === 'channel_email') {
        return {
          ...item,
          sub: user.email,
          enabled: prefMap[item.key] ?? true,
          available: true,
          status: { label: '已验证', tone: 'green' },
        };
      }
      if (item.key === 'channel_push') {
        return {
          ...item,
          sub: `${deviceTotal} 台可信终端 · 实时推送`,
          enabled: prefMap[item.key] ?? true,
          available: true,
          status: { label: prefMap[item.key] ? '已开启' : '已关闭', tone: prefMap[item.key] ? 'green' : 'gray' },
        };
      }
      return {
        ...item,
        enabled: prefMap[item.key] ?? true,
        available: true,
        status: { label: prefMap[item.key] ? '已开启' : '已关闭', tone: prefMap[item.key] ? 'green' : 'gray' },
      };
    }),
    settings: {
      dndEnabled: Boolean(settings?.dnd_enabled),
      dndStart: settings?.dnd_start || '22:00',
      dndEnd: settings?.dnd_end || '08:00',
      digestEnabled: settings ? Boolean(settings.digest_enabled) : true,
    },
  });
});

app.patch('/api/notifications/prefs', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const body = await readJson(c);
  const prefs = body?.prefs;
  if (!prefs || typeof prefs !== 'object') {
    return jsonError(c, 400, 'INVALID_INPUT', '缺少通知偏好内容');
  }

  const entries = Object.entries(prefs).filter(([key]) => PREF_KEYS.has(key));
  if (!entries.length) return jsonError(c, 400, 'INVALID_INPUT', '没有可更新的通知项');
  if (entries.some(([key]) => key === 'channel_sms') && !user.phone) {
    return jsonError(c, 400, 'PHONE_REQUIRED', '请先绑定手机号后再开启短信通知');
  }

  for (const [key, value] of entries) {
    await db
      .prepare(
        `INSERT INTO notification_prefs (user_id, key, enabled) VALUES (?, ?, ?)
         ON CONFLICT(user_id, key) DO UPDATE SET enabled = excluded.enabled`,
      )
      .bind(user.id, key, value ? 1 : 0)
      .run();
  }

  return ok(c, { ok: true, updated: entries.length });
});

app.patch('/api/notifications/settings', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const current = await db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').bind(user.id).first();
  const dndEnabled = body.dndEnabled === undefined ? Boolean(current?.dnd_enabled) : Boolean(body.dndEnabled);
  const dndStart = String(body.dndStart ?? current?.dnd_start ?? '22:00');
  const dndEnd = String(body.dndEnd ?? current?.dnd_end ?? '08:00');
  const digestEnabled =
    body.digestEnabled === undefined ? Boolean(current?.digest_enabled ?? 1) : Boolean(body.digestEnabled);

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(dndStart) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(dndEnd)) {
    return jsonError(c, 400, 'INVALID_TIME', '免打扰时间格式不正确');
  }

  await db
    .prepare(
      `INSERT INTO notification_settings (user_id, dnd_enabled, dnd_start, dnd_end, digest_enabled)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         dnd_enabled = excluded.dnd_enabled,
         dnd_start = excluded.dnd_start,
         dnd_end = excluded.dnd_end,
         digest_enabled = excluded.digest_enabled`,
    )
    .bind(user.id, dndEnabled ? 1 : 0, dndStart, dndEnd, digestEnabled ? 1 : 0)
    .run();

  return ok(c, { dndEnabled, dndStart, dndEnd, digestEnabled });
});

/* ------------------------------------------------------------------ */
/* 会员中心                                                             */
/* ------------------------------------------------------------------ */

app.get('/api/member', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const tier = tierOf(user);
  const index = TIERS.findIndex((item) => item.key === tier.key);
  const next = TIERS[index + 1] || null;
  const span = next ? next.min - tier.min : 1;
  const progress = next
    ? Math.max(0, Math.min(99, Math.floor(((user.particles - tier.min) / span) * 100)))
    : 100;
  const remaining = next ? Math.max(0, next.min - user.particles) : 0;
  const logs = await db
    .prepare('SELECT * FROM particle_logs WHERE user_id = ? ORDER BY occurred_at DESC LIMIT 5')
    .bind(user.id)
    .all();

  return ok(c, {
    tier: { ...tier, validUntil: '2027-10-10' },
    next,
    progress,
    remaining,
    estimatedDays: remaining ? Math.ceil(remaining / 113) : 0,
    benefits: BENEFITS.map((item) => ({ ...item, unlocked: user.particles >= item.min })),
    tiers: TIERS.map((item) => ({
      ...item,
      current: item.key === tier.key,
      unlocked: user.particles >= item.min,
    })),
    particleLogs: logs.results.map((row) => ({
      id: row.id,
      label: row.label,
      delta: row.delta,
      balance: row.balance,
      occurredAt: row.occurred_at,
    })),
  });
});

/* ------------------------------------------------------------------ */
/* 协议中心                                                             */
/* ------------------------------------------------------------------ */

app.get('/api/agreements', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const rows = await db
    .prepare('SELECT * FROM agreements WHERE user_id = ? ORDER BY sort ASC')
    .bind(user.id)
    .all();

  const items = rows.results.map((row) => ({
    id: row.id,
    title: row.title,
    version: row.version,
    status: row.status,
    signedAt: row.signed_at,
  }));
  const signed = items.filter((item) => item.status === 'signed');
  const pending = items.filter((item) => item.status === 'pending');

  return ok(c, {
    items,
    stats: {
      signed: signed.length,
      pending: pending.length,
      total: items.length,
      lastSigned: signed[0] || null,
    },
  });
});

app.post('/api/agreements/:id/sign', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const id = Number(c.req.param('id'));
  const agreement = await db
    .prepare('SELECT * FROM agreements WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first();

  if (!agreement) return jsonError(c, 404, 'NOT_FOUND', '未找到该协议');
  if (agreement.status === 'signed') {
    return jsonError(c, 409, 'ALREADY_SIGNED', '该协议已签署，无需重复操作');
  }

  const signedAt = nowIso();
  const particles = user.particles + 50;

  await db
    .prepare("UPDATE agreements SET status = 'signed', signed_at = ? WHERE id = ?")
    .bind(signedAt, id)
    .run();
  await db.prepare('UPDATE users SET particles = ? WHERE id = ?').bind(particles, user.id).run();
  await db
    .prepare(
      'INSERT INTO particle_logs (user_id, label, delta, balance, occurred_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(user.id, `签署《${agreement.title}》`, 50, particles, signedAt)
    .run();
  await addActivity(db, user.id, `签署《${agreement.title}》`, `协议版本 ${agreement.version}`, 'purple', 'i-file');

  return ok(c, {
    item: {
      id: agreement.id,
      title: agreement.title,
      version: agreement.version,
      status: 'signed',
      signedAt,
    },
    particles,
    reward: 50,
  });
});

/* ------------------------------------------------------------------ */
/* 星际补给站                                                           */
/* ------------------------------------------------------------------ */

app.get('/api/supply', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const tier = tierOf(user);
  const [orders, address, transit, monthly] = await Promise.all([
    db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').bind(user.id).all(),
    db.prepare('SELECT * FROM addresses WHERE user_id = ?').bind(user.id).first(),
    db
      .prepare("SELECT COUNT(*) AS count FROM orders WHERE user_id = ? AND status IN ('transit', 'paid')")
      .bind(user.id)
      .first(),
    db
      .prepare(
        'SELECT COUNT(*) AS count, COALESCE(SUM(energy_cents), 0) AS spend FROM orders WHERE user_id = ? AND created_at >= ?',
      )
      .bind(user.id, monthStartIso())
      .first(),
  ]);

  return ok(c, {
    user: serializeUser(user),
    wallet: { balanceCents: user.star_energy_cents, cardLast4: '0721' },
    counts: {
      transit: transit?.count || 0,
      monthOrders: monthly?.count || 0,
      monthSpendCents: monthly?.spend || 0,
    },
    orders: orders.results.map((row) => ({
      id: row.id,
      code: row.code,
      productId: row.product_id,
      item: row.item,
      energyCents: row.energy_cents,
      status: row.status,
      createdAt: row.created_at,
    })),
    address: address
      ? {
          receiver: address.receiver,
          phone: address.phone,
          region: address.region,
          detail: address.detail,
          updatedAt: address.updated_at,
        }
      : null,
    products: PRODUCTS.map((item) => ({
      ...item,
      memberPriceCents: Math.round(item.priceCents * (tier.rate || 0.95)),
    })),
    tips: SUPPLY_TIPS,
    discountLabel: tier.discount,
    verified: Boolean(user.verified),
  });
});

app.post('/api/supply/orders', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const body = await readJson(c);
  const product = PRODUCTS.find((item) => item.id === body?.productId);
  if (!product) return jsonError(c, 404, 'NOT_FOUND', '该补给物资已离开货架');
  if (!user.verified) {
    return jsonError(c, 403, 'VERIFY_REQUIRED', '完成星际公民认证后才可下单');
  }

  const tier = tierOf(user);
  const price = Math.round(product.priceCents * (tier.rate || 0.95));
  if (user.star_energy_cents < price) {
    return jsonError(c, 400, 'INSUFFICIENT_FUNDS', '星能余额不足，请先补充星能');
  }

  const now = new Date(Date.now() + 8 * 3600 * 1000);
  const stamp = `${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  const suffix = String(Math.floor(Math.random() * 9000) + 1000);
  const code = `INU-${stamp}-${suffix}`;
  const createdAt = nowIso();
  const reward = Math.floor((price / 10000) * 5);
  const balance = user.star_energy_cents - price;
  const particles = user.particles + reward;

  const inserted = await db
    .prepare(
      'INSERT INTO orders (user_id, code, product_id, item, energy_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(user.id, code, product.id, `${product.name} ×1`, price, 'transit', createdAt)
    .run();
  await db
    .prepare('UPDATE users SET star_energy_cents = ?, particles = ? WHERE id = ?')
    .bind(balance, particles, user.id)
    .run();
  await db
    .prepare('INSERT INTO particle_logs (user_id, label, delta, balance, occurred_at) VALUES (?, ?, ?, ?, ?)')
    .bind(user.id, `兑换${product.name}`, reward, particles, createdAt)
    .run();
  await addActivity(db, user.id, '兑换星际补给', `${product.name} · 消耗 ${(price / 100).toFixed(2)} 星能`, 'blue', 'i-box');

  return ok(c, {
    order: {
      id: inserted.meta?.last_row_id ?? null,
      code,
      productId: product.id,
      item: `${product.name} ×1`,
      energyCents: price,
      status: 'transit',
      createdAt,
    },
    balanceCents: balance,
    particles,
    reward,
  });
});

app.patch('/api/supply/address', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const receiver = String(body.receiver || '').trim();
  const phone = String(body.phone || '').trim();
  const region = String(body.region || '').trim();
  const detail = String(body.detail || '').trim();

  if ([...receiver].length < 2 || [...receiver].length > 20) {
    return jsonError(c, 400, 'INVALID_RECEIVER', '收货人需为 2–20 个字符');
  }
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return jsonError(c, 400, 'INVALID_PHONE', '请输入有效的 11 位手机号');
  }
  if ([...region].length < 2) return jsonError(c, 400, 'INVALID_REGION', '请填写所在星域');
  if ([...detail].length < 5) return jsonError(c, 400, 'INVALID_DETAIL', '请填写完整的收货坐标');

  const updatedAt = nowIso();
  await db
    .prepare(
      `INSERT INTO addresses (user_id, receiver, phone, region, detail, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         receiver = excluded.receiver,
         phone = excluded.phone,
         region = excluded.region,
         detail = excluded.detail,
         updated_at = excluded.updated_at`,
    )
    .bind(user.id, receiver, phone, region, detail, updatedAt)
    .run();

  return ok(c, { address: { receiver, phone, region, detail, updatedAt } });
});

/* ------------------------------------------------------------------ */
/* 静态资源与错误处理                                                   */
/* ------------------------------------------------------------------ */

app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: { code: 'NOT_FOUND', message: '接口不存在' } }, 404, { 'Cache-Control': 'no-store' });
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((error, c) => {
  console.error('worker error', error);
  if (c.req.path.startsWith('/api/')) {
    return c.json(
      { error: { code: 'INTERNAL', message: '星际网络暂时波动，请稍后重试' } },
      500,
      { 'Cache-Control': 'no-store' },
    );
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;

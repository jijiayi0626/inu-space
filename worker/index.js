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

function parseUserAgent(value) {
  const ua = String(value || '');
  const result = {
    browser: '未知浏览器',
    browserName: '未知浏览器',
    browserVersion: '',
    os: '未知系统',
    osName: '未知系统',
    osVersion: '',
    kind: 'laptop',
    name: '星际终端',
  };
  if (!ua) {
    result.label = result.name;
    return result;
  }

  const versionOf = (pattern) => {
    const match = ua.match(pattern);
    return match?.[1] ? match[1].replace(/_/g, '.') : '';
  };

  // 操作系统与设备类型
  if (/CrOS/i.test(ua)) {
    result.osName = 'ChromeOS';
    result.osVersion = versionOf(/CrOS\s+\S+\s+([\d.]+)/i);
    result.name = 'Chromebook';
    result.kind = 'laptop';
  } else if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua))) {
    result.osName = 'iPadOS';
    result.osVersion = versionOf(/(?:CPU )?OS ([\d_]+)/i);
    result.name = 'iPad';
    result.kind = 'tablet';
  } else if (/iPhone|iPod/i.test(ua)) {
    result.osName = 'iOS';
    result.osVersion = versionOf(/(?:CPU )?OS ([\d_]+)/i);
    result.name = /iPod/i.test(ua) ? 'iPod touch' : 'iPhone';
    result.kind = 'phone';
  } else if (/HarmonyOS/i.test(ua)) {
    result.osName = 'HarmonyOS';
    result.osVersion = versionOf(/HarmonyOS\s*([\d.]+)?/i);
    result.name = 'HarmonyOS 手机';
    result.kind = 'phone';
  } else if (/Android/i.test(ua)) {
    result.osName = 'Android';
    result.osVersion = versionOf(/Android\s+([\d.]+)/i);
    const isTablet = /Tablet|Nexus 7|Nexus 9|SM-T|Lenovo TAB|Pad/i.test(ua);
    const model = ua.match(/Android\s+[\d.]+;\s*([^;)]+?)(?:\s+Build\/|\)|;)/i)?.[1] || '';
    const cleaned = model
      .replace(/\b(?:wv|Mobile|Tablet|Build|K|Linux|U)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    result.name = cleaned && cleaned.length <= 40 ? cleaned : isTablet ? 'Android 平板' : 'Android 手机';
    result.kind = isTablet ? 'tablet' : 'phone';
  } else if (/Windows/i.test(ua)) {
    const nt = versionOf(/Windows NT ([\d.]+)/i);
    const windows = { '10.0': 'Windows 10/11', '6.3': 'Windows 8.1', '6.2': 'Windows 8', '6.1': 'Windows 7' };
    result.osName = windows[nt] || 'Windows';
    result.osVersion = '';
    result.name = 'Windows 电脑';
    result.kind = 'laptop';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    result.osName = 'macOS';
    result.osVersion = '';
    result.name = 'Mac';
    result.kind = 'laptop';
  } else if (/Linux/i.test(ua)) {
    result.osName = 'Linux';
    result.name = 'Linux 电脑';
    result.kind = 'laptop';
  }

  // 浏览器与内置客户端（顺序重要：先匹配更具体的壳）
  const browserRules = [
    { name: '微信', pattern: /MicroMessenger\/([\d.]+)/i },
    { name: '企业微信', pattern: /wxwork\/([\d.]+)/i },
    { name: '钉钉', pattern: /DingTalk\/([\d.]+)/i },
    { name: 'QQ 浏览器', pattern: /(?:MQQBrowser|QQBrowser)\/([\d.]+)/i },
    { name: 'Edge', pattern: /Edg(?:e|A|iOS)?\/([\d.]+)/i },
    { name: 'Opera', pattern: /(?:OPR|Opera)\/([\d.]+)/i },
    { name: 'Firefox', pattern: /(?:Firefox|FxiOS)\/([\d.]+)/i },
    { name: 'Chrome', pattern: /(?:Chrome|CriOS)\/([\d.]+)/i },
    { name: 'Safari', pattern: /Version\/([\d.]+).*Safari/i },
    { name: 'curl', pattern: /curl\/([\d.]+)/i },
    { name: 'Postman', pattern: /PostmanRuntime\/([\d.]+)/i },
    { name: 'Python', pattern: /python-requests\/([\d.]+)/i },
  ];
  const matched = browserRules.find((rule) => rule.pattern.test(ua));
  if (matched) {
    const version = versionOf(matched.pattern);
    result.browserName = matched.name;
    result.browserVersion = version;
    result.browser = version ? `${matched.name} ${version.split('.')[0]}` : matched.name;
  } else if (/Mozilla|AppleWebKit/i.test(ua)) {
    result.browserName = '浏览器';
    result.browser = '浏览器';
  }

  result.os = result.osVersion ? `${result.osName} ${result.osVersion}` : result.osName;
  result.label = [result.name, result.browser, result.os].filter(Boolean).join(' · ');
  return result;
}

function detectClient(c) {
  return parseUserAgent(c.req.header('User-Agent') || '');
}

function detectDevice(c) {
  return detectClient(c).name;
}

function tierOf(userRow) {
  return TIER_MAP[userRow.member_tier] || TIERS[0];
}

function serializeUser(row, options = {}) {
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
    avatarTone: row.avatar_tone || 'blue',
    level: row.level,
    tier: tier.key,
    tierLabel: tier.label,
    tierEn: tier.en,
    particles: row.particles,
    starEnergyCents: row.star_energy_cents,
    miles: row.miles,
    verified: Boolean(row.verified),
    isAdmin: Boolean(row.is_admin),
    isDemo: row.email === DEMO_EMAIL,
    readOnly: Boolean(options.readOnly),
    phone: row.phone || '',
    phoneVerified: Boolean(row.phone_verified),
    emailVerified: row.email_verified === undefined ? true : Boolean(row.email_verified),
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

async function addWalletTransaction(db, userId, { kind, title, detail = '', amountCents, balanceAfter, ref = null, createdAt = nowIso() }) {
  await db
    .prepare(
      `INSERT INTO wallet_transactions (user_id, kind, title, detail, amount_cents, balance_after, ref, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(userId, kind, title, detail, amountCents, balanceAfter, ref, createdAt)
    .run();
}

async function pushNotification(db, userId, category, title, body, link = '') {
  try {
    const pref = await db
      .prepare('SELECT enabled FROM notification_prefs WHERE user_id = ? AND key = ?')
      .bind(userId, category)
      .first();
    if (pref && !pref.enabled) return false;
    await db
      .prepare(
        'INSERT INTO notification_messages (user_id, category, title, body, link, read_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)',
      )
      .bind(userId, category, String(title).slice(0, 80), String(body).slice(0, 500), String(link || '').slice(0, 200), nowIso())
      .run();
    return true;
  } catch {
    return false;
  }
}

async function ensureAgreementsForUser(db, userId) {
  const templates = await db
    .prepare('SELECT * FROM agreement_templates WHERE active = 1 ORDER BY sort ASC, id ASC')
    .all();
  if (!templates.results.length) return;

  const existing = await db.prepare('SELECT * FROM agreements WHERE user_id = ?').bind(userId).all();
  const byTemplate = new Map();
  const byTitle = new Map();
  for (const row of existing.results) {
    if (row.template_id) byTemplate.set(row.template_id, row);
    byTitle.set(row.title, row);
  }

  for (const template of templates.results) {
    const row = byTemplate.get(template.id) || byTitle.get(template.title);
    if (row) {
      if (row.template_id !== template.id) {
        await db
          .prepare('UPDATE agreements SET template_id = ? WHERE id = ?')
          .bind(template.id, row.id)
          .run();
      }
      continue;
    }
    await db
      .prepare(
        `INSERT INTO agreements (user_id, title, version, status, signed_at, sort, content, reward, template_id)
         VALUES (?, ?, ?, 'pending', NULL, ?, ?, ?, ?)`,
      )
      .bind(userId, template.title, template.version, template.sort, template.content, template.reward, template.id)
      .run();
  }
}

async function listProducts(db) {
  try {
    const rows = await db.prepare('SELECT * FROM products ORDER BY sort ASC, updated_at DESC').all();
    if (rows.results.length) {
      return rows.results
        .filter((row) => row.active !== 0)
        .map((row) => ({
          id: row.id,
          name: row.name,
          desc: row.desc,
          priceCents: row.price_cents,
          icon: row.icon,
          tag: row.tag,
          tone: row.tone,
          stock: row.stock,
        }));
    }
  } catch {
    /* 表尚未迁移时回退到内置商品 */
  }
  return PRODUCTS.map((item) => ({ ...item, stock: -1 }));
}

async function issueVerificationCode(c, user, purpose, target) {
  const settings = await siteSettings(c);
  if (settings.verificationMode === 'off') {
    return { error: jsonError(c, 503, 'VERIFICATION_UNAVAILABLE', '验证码通道尚未开启，请联系管理员') };
  }
  const db = c.env.DB;
  const recent = await db
    .prepare(
      'SELECT COUNT(*) AS count FROM verification_codes WHERE user_id = ? AND purpose = ? AND created_at >= ?',
    )
    .bind(user.id, purpose, new Date(Date.now() - 3600000).toISOString())
    .first();
  if ((recent?.count || 0) >= 5) {
    return { error: jsonError(c, 429, 'CODE_RATE_LIMIT', '验证码发送过于频繁，请稍后再试') };
  }

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  const codeHash = await sha256Hex(`${user.id}:${purpose}:${target}:${code}`);
  const now = nowIso();
  await db
    .prepare('UPDATE verification_codes SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL')
    .bind(now, user.id, purpose)
    .run();
  await db
    .prepare(
      `INSERT INTO verification_codes (user_id, purpose, target, code_hash, expires_at, attempts, used_at, created_at)
       VALUES (?, ?, ?, ?, ?, 0, NULL, ?)`,
    )
    .bind(user.id, purpose, target, codeHash, new Date(Date.now() + 10 * 60 * 1000).toISOString(), now)
    .run();

  return {
    delivery: settings.verificationMode,
    devCode: settings.verificationMode === 'console' ? code : null,
    expiresIn: 600,
  };
}

async function consumeVerificationCode(db, user, purpose, target, code) {
  const row = await db
    .prepare(
      `SELECT * FROM verification_codes
       WHERE user_id = ? AND purpose = ? AND target = ? AND used_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(user.id, purpose, target)
    .first();
  if (!row) return { ok: false, message: '请先获取验证码' };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, message: '验证码已过期，请重新获取' };
  }
  if (row.attempts >= 5) {
    return { ok: false, message: '验证码尝试次数过多，请重新获取' };
  }

  const hash = await sha256Hex(`${user.id}:${purpose}:${target}:${code}`);
  if (!safeEqual(hash, row.code_hash)) {
    await db.prepare('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run();
    return { ok: false, message: '验证码不正确' };
  }

  await db.prepare('UPDATE verification_codes SET used_at = ? WHERE id = ?').bind(nowIso(), row.id).run();
  return { ok: true };
}

function normalizePhone(value) {
  return String(value || '').replace(/\s|-/g, '');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const SETTING_PREFIX = 'social.';
const SITE_PREFIX = 'site.';
const DEMO_EMAIL = 'xiaoyiyi@inu.space';
const DEMO_PASSWORD = 'inu2026';

const SITE_DEFAULTS = {
  demoVisible: false,
  demoReadOnly: true,
  noticeEnabled: false,
  noticeText: '',
  noticeLevel: 'info',
  footerText: '© 2026 INU 无限宇宙 · 星际通行证',
  loginWelcome: '使用你的 INU 星际档案继续旅程。',
  supportEmail: 'support@inu.space',
  walletCardLast4: '0721',
  featureRecharge: true,
  featureWithdraw: false,
  featurePhoneBind: true,
  featureEmailChange: true,
  featureAvatar: true,
  featureSupply: true,
  featureAgreements: true,
  featureRegister: false,
  paymentMode: 'mock',
  verificationMode: 'console',
  rechargePresets: '50,100,200,500,1000',
  withdrawMinCents: 10000,
  nameChangeDays: 30,
  maintenanceEnabled: false,
  maintenanceText: '',
};

const SITE_NOTICE_LEVELS = ['info', 'success', 'warn'];
const PAYMENT_MODES = ['mock', 'off'];
const VERIFICATION_MODES = ['console', 'off'];
const AVATAR_TONES = ['blue', 'purple', 'cyan', 'green', 'orange'];

function base64UrlToBytes(value) {
  const pad = value.length % 4 ? '='.repeat(4 - (value.length % 4)) : '';
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

async function configCryptoKey(c) {
  if (!c.env.CONFIG_KEY) return null;
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(c.env.CONFIG_KEY)));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptConfig(c, value) {
  const key = await configCryptoKey(c);
  if (!key) throw new Error('config_key_missing');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value));
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(cipher))}`;
}

async function decryptConfig(c, stored) {
  const key = await configCryptoKey(c);
  if (!key) throw new Error('config_key_missing');
  const [version, ivPart, dataPart] = String(stored).split('.');
  if (version !== 'v1' || !ivPart || !dataPart) throw new Error('invalid_secret');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBytes(ivPart) },
    key,
    base64UrlToBytes(dataPart),
  );
  return new TextDecoder().decode(plain);
}

async function readSettings(db, prefix = '') {
  const statement = prefix
    ? db.prepare('SELECT key, value FROM app_settings WHERE key LIKE ?').bind(`${prefix}%`)
    : db.prepare('SELECT key, value FROM app_settings');
  const rows = await statement.all();
  return Object.fromEntries(rows.results.map((row) => [row.key, row.value]));
}

async function saveSetting(db, key, value) {
  await db
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(key, String(value), nowIso())
    .run();
}

async function siteSettings(c) {
  const cached = c.get('siteSettings');
  if (cached) return cached;

  let stored = {};
  try {
    stored = await readSettings(c.env.DB, SITE_PREFIX);
  } catch {
    stored = {};
  }

  const raw = (key) => stored[`${SITE_PREFIX}${key}`];
  const bool = (key, fallback) => {
    const value = raw(key);
    if (value === undefined || value === null || value === '') return fallback;
    return value === '1' || value === 'true';
  };
  const text = (key, fallback, max) => {
    const value = raw(key);
    return String(value === undefined || value === null ? fallback : value).slice(0, max);
  };
  const int = (key, fallback, min, max) => {
    const value = Number(raw(key));
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, Math.round(value)));
  };
  const choice = (key, fallback, options) => {
    const value = String(raw(key) || '');
    return options.includes(value) ? value : fallback;
  };
  const presetList = (key, fallback) => {
    const value = String(raw(key) === undefined ? fallback : raw(key))
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item) && item >= 1 && item <= 100000);
    return value.length ? Array.from(new Set(value)).slice(0, 8) : [50, 100, 200, 500, 1000];
  };

  const level = String(raw('notice_level') || '');
  const settings = {
    demoVisible: bool('demo_visible', SITE_DEFAULTS.demoVisible),
    demoReadOnly: bool('demo_readonly', SITE_DEFAULTS.demoReadOnly),
    noticeEnabled: bool('notice_enabled', SITE_DEFAULTS.noticeEnabled),
    noticeText: text('notice_text', SITE_DEFAULTS.noticeText, 200),
    noticeLevel: SITE_NOTICE_LEVELS.includes(level) ? level : SITE_DEFAULTS.noticeLevel,
    footerText: text('footer_text', SITE_DEFAULTS.footerText, 120),
    loginWelcome: text('login_welcome', SITE_DEFAULTS.loginWelcome, 120),
    supportEmail: text('support_email', SITE_DEFAULTS.supportEmail, 120),
    walletCardLast4: text('wallet_card_last4', SITE_DEFAULTS.walletCardLast4, 8),
    featureRecharge: bool('feature_recharge', SITE_DEFAULTS.featureRecharge),
    featureWithdraw: bool('feature_withdraw', SITE_DEFAULTS.featureWithdraw),
    featurePhoneBind: bool('feature_phone_bind', SITE_DEFAULTS.featurePhoneBind),
    featureEmailChange: bool('feature_email_change', SITE_DEFAULTS.featureEmailChange),
    featureAvatar: bool('feature_avatar', SITE_DEFAULTS.featureAvatar),
    featureSupply: bool('feature_supply', SITE_DEFAULTS.featureSupply),
    featureAgreements: bool('feature_agreements', SITE_DEFAULTS.featureAgreements),
    featureRegister: bool('feature_register', SITE_DEFAULTS.featureRegister),
    paymentMode: choice('payment_mode', SITE_DEFAULTS.paymentMode, PAYMENT_MODES),
    verificationMode: choice('verification_mode', SITE_DEFAULTS.verificationMode, VERIFICATION_MODES),
    rechargePresets: presetList('recharge_presets', SITE_DEFAULTS.rechargePresets),
    withdrawMinCents: int('withdraw_min_cents', SITE_DEFAULTS.withdrawMinCents, 1000, 5000000),
    nameChangeDays: int('name_change_days', SITE_DEFAULTS.nameChangeDays, 0, 365),
    maintenanceEnabled: bool('maintenance_enabled', SITE_DEFAULTS.maintenanceEnabled),
    maintenanceText: text('maintenance_text', SITE_DEFAULTS.maintenanceText, 200),
  };

  c.set('siteSettings', settings);
  return settings;
}

function publicSiteSettings(settings) {
  return {
    demoVisible: settings.demoVisible,
    demoReadOnly: settings.demoReadOnly,
    demo: settings.demoVisible ? { email: DEMO_EMAIL, password: DEMO_PASSWORD } : null,
    notice: {
      enabled: settings.noticeEnabled,
      text: settings.noticeText,
      level: settings.noticeLevel,
    },
    footerText: settings.footerText,
    loginWelcome: settings.loginWelcome,
    supportEmail: settings.supportEmail,
    nameChangeDays: settings.nameChangeDays,
    wallet: {
      cardLast4: settings.walletCardLast4,
      presets: settings.rechargePresets,
    },
    features: {
      recharge: settings.featureRecharge,
      withdraw: settings.featureWithdraw,
      phoneBind: settings.featurePhoneBind,
      emailChange: settings.featureEmailChange,
      avatar: settings.featureAvatar,
      supply: settings.featureSupply,
      agreements: settings.featureAgreements,
      register: settings.featureRegister,
    },
    payment: { mode: settings.paymentMode },
    verification: { mode: settings.verificationMode },
    maintenance: {
      enabled: settings.maintenanceEnabled,
      text: settings.maintenanceText,
    },
  };
}

function adminSiteSettings(settings) {
  return {
    ...settings,
    demoEmail: DEMO_EMAIL,
    demoPassword: DEMO_PASSWORD,
  };
}

async function serializeUserFor(c, row) {
  if (!row) return null;
  if (row.email !== DEMO_EMAIL) return serializeUser(row);
  const settings = await siteSettings(c);
  return serializeUser(row, { readOnly: settings.demoReadOnly });
}

async function socialConfigMap(c) {
  const settings = await readSettings(c.env.DB, SETTING_PREFIX);
  const map = {};

  for (const id of Object.keys(OAUTH_PROVIDERS)) {
    const provider = OAUTH_PROVIDERS[id];
    const prefix = `${SETTING_PREFIX}${id}.`;
    const hasDbConfig = Object.keys(settings).some((key) => key.startsWith(prefix));

    let clientId = '';
    let clientSecret = '';
    let enabled = false;
    let secretError = false;

    if (hasDbConfig) {
      clientId = String(settings[`${prefix}client_id`] || '').trim() || String(c.env[provider.clientIdEnv] || '');
      enabled = settings[`${prefix}enabled`] === '1';
      const stored = settings[`${prefix}client_secret`] || '';
      if (stored) {
        try {
          clientSecret = await decryptConfig(c, stored);
        } catch {
          secretError = true;
        }
      }
      if (!clientSecret) clientSecret = String(c.env[provider.clientSecretEnv] || '');
    } else {
      clientId = String(c.env[provider.clientIdEnv] || '');
      clientSecret = String(c.env[provider.clientSecretEnv] || '');
      enabled = Boolean(clientId && clientSecret);
    }

    const configured = Boolean(clientId && clientSecret);
    map[id] = {
      provider,
      clientId,
      clientSecret,
      enabled: enabled && configured,
      configured,
      source: hasDbConfig ? 'db' : configured ? 'env' : 'none',
      secretError,
    };
  }

  return map;
}

async function oauthConfig(c, id) {
  const provider = OAUTH_PROVIDERS[id];
  if (!provider) return null;
  const map = await socialConfigMap(c);
  return map[id];
}

function serializeSocialProvider(c, info) {
  const origin = new URL(c.req.url).origin;
  return {
    id: info.provider.id,
    label: info.provider.label,
    backup: Boolean(info.provider.backup),
    enabled: info.enabled,
    configured: info.configured,
    source: info.source,
    clientId: info.clientId,
    hasSecret: Boolean(info.clientSecret),
    secretError: info.secretError,
    callbackUrl: `${origin}/api/auth/oauth/${info.provider.id}/callback`,
  };
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
  const client = detectClient(c);
  const device = client.name;

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

  await addSecurityLog(db, user.id, event, `${client.label} · ${location}`, 'green', 'i-check');

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

async function ensureAdminAccess(c, user) {
  if (user.is_admin) return user;
  const emails = String(c.env.ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!emails.includes(String(user.email || '').toLowerCase())) return user;

  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO admin_users (user_id, granted_by, created_at) VALUES (?, 'ADMIN_EMAILS', ?)",
  )
    .bind(user.id, nowIso())
    .run();
  return { ...user, is_admin: 1 };
}

/* ------------------------------------------------------------------ */
/* 会话                                                                 */
/* ------------------------------------------------------------------ */

async function requireSession(c, next) {
  const path = c.req.path;
  if (
    path === '/api/auth/login' ||
    path === '/api/auth/register' ||
    path === '/api/auth/password-reset' ||
    path === '/api/auth/providers' ||
    path === '/api/health' ||
    path.startsWith('/api/auth/oauth/')
  ) {
    return next();
  }

  const user = await getSessionUser(c);
  if (!user) {
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return jsonError(c, 401, 'UNAUTHORIZED', '登录状态已失效，请重新进入星际通行证');
  }

  c.set('userRow', user);
  return next();
}

async function getSessionUser(c) {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const user = await c.env.DB.prepare(
    `SELECT u.*, CASE WHEN a.user_id IS NULL THEN 0 ELSE 1 END AS is_admin
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN admin_users a ON a.user_id = u.id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(tokenHash, nowIso())
    .first();

  if (user) c.set('tokenHash', tokenHash);
  return user || null;
}

app.use('/api/*', requireSession);

const DEMO_SAFE_WRITE_PATHS = new Set(['/api/auth/logout', '/api/oauth/authorize/decision']);

app.use('/api/*', async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

  const user = c.get('userRow');
  if (!user || user.email !== DEMO_EMAIL || user.is_admin) return next();
  if (DEMO_SAFE_WRITE_PATHS.has(c.req.path)) return next();

  const settings = await siteSettings(c);
  if (!settings.demoReadOnly) return next();

  return jsonError(c, 403, 'DEMO_READONLY', '演示账号为只读模式，无法修改数据');
});

app.use('/api/*', async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

  const path = c.req.path;
  if (
    path === '/api/auth/login' ||
    path === '/api/auth/register' ||
    path === '/api/auth/password-reset' ||
    path === '/api/auth/logout' ||
    path === '/api/health' ||
    path.startsWith('/api/auth/oauth/')
  ) {
    return next();
  }

  const user = c.get('userRow');
  if (user?.is_admin) return next();

  const settings = await siteSettings(c);
  if (!settings.maintenanceEnabled) return next();

  return jsonError(
    c,
    503,
    'MAINTENANCE',
    settings.maintenanceText || '星际网络正在维护，暂时无法保存操作，请稍后再试',
  );
});

async function requireAdmin(c, next) {
  const user = c.get('userRow');
  if (!user?.is_admin) {
    return jsonError(c, 403, 'ADMIN_REQUIRED', '需要超级管理员权限才能访问管理台');
  }
  if (c.req.method !== 'GET') {
    const origin = new URL(c.req.url).origin;
    const requestOrigin = c.req.header('Origin');
    if (requestOrigin && requestOrigin !== origin) {
      return jsonError(c, 403, 'CROSS_ORIGIN', '拒绝跨站管理操作');
    }
    const fetchSite = c.req.header('Sec-Fetch-Site');
    if (fetchSite && fetchSite !== 'same-origin') {
      return jsonError(c, 403, 'CROSS_ORIGIN', '拒绝跨站管理操作');
    }
  }
  return next();
}

app.use('/api/admin', requireAdmin);
app.use('/api/admin/*', requireAdmin);

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
  let sessionUser = await createSessionForUser(c, user);
  sessionUser = await ensureAdminAccess(c, sessionUser);
  return ok(c, {
    user: await serializeUserFor(c, sessionUser),
    site: publicSiteSettings(await siteSettings(c)),
  });
});

app.post('/api/auth/register', async (c) => {
  const settings = await siteSettings(c);
  if (!settings.featureRegister) {
    return jsonError(c, 403, 'REGISTER_DISABLED', '星际通行证暂未开放注册，请联系管理员开通');
  }

  const db = c.env.DB;
  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const name = cleanDisplayName(body.name || email.split('@')[0], email.split('@')[0]);

  if (!EMAIL_RE.test(email)) return jsonError(c, 400, 'INVALID_EMAIL', '请输入有效的邮箱地址');
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return jsonError(c, 400, 'WEAK_PASSWORD', '密码至少 8 位，且需同时包含字母与数字');
  }
  if (email === DEMO_EMAIL) return jsonError(c, 409, 'EMAIL_TAKEN', '该邮箱已被占用');

  const exists = await db.prepare('SELECT 1 AS hit FROM users WHERE email = ?').bind(email).first();
  if (exists) return jsonError(c, 409, 'EMAIL_TAKEN', '该邮箱已注册，请直接登录');

  const { inuId, orbit } = await uniqueInuId(db);
  const passwordHash = await hashPassword(password);
  const createdAt = nowIso();

  const inserted = await db
    .prepare(
      `INSERT INTO users (
         email, password_hash, display_name, inu_id, orbit_code, region, bio, avatar_text,
         level, member_tier, particles, star_energy_cents, miles, verified, phone,
         two_fa, guard_geo, guard_device, guard_sensitive, phone_verified, email_verified, created_at
       ) VALUES (?, ?, ?, ?, ?, '', '', ?, 1, 'stardust', 0, 0, 0, 0, NULL, 0, 1, 1, 0, 0, 1, ?)`,
    )
    .bind(email, passwordHash, name, inuId, orbit, avatarTextOf(name), createdAt)
    .run();

  const userId = inserted.meta?.last_row_id;
  let user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();

  await ensureAgreementsForUser(db, userId);
  await db
    .prepare(
      `INSERT INTO notification_settings (user_id, dnd_enabled, dnd_start, dnd_end, digest_enabled)
       VALUES (?, 0, '22:00', '08:00', 1)`,
    )
    .bind(userId)
    .run();
  await addActivity(db, userId, '加入 INU 星际网络', `通行证 ${inuId} 已激活`, 'blue', 'i-spark');
  await addSecurityLog(db, userId, '账号注册成功', `${detectClient(c).label} · ${clientLocation(c)}`, 'green', 'i-check');
  await pushNotification(db, userId, 'type_security', '欢迎加入 INU 星际网络', '你的星际通行证已激活，建议先完成实名认证并开启两步验证。', '/profile');

  let sessionUser = await createSessionForUser(c, user, '注册并登录');
  sessionUser = await ensureAdminAccess(c, sessionUser);
  user = sessionUser;
  return ok(c, {
    user: await serializeUserFor(c, user),
    site: publicSiteSettings(await siteSettings(c)),
  });
});

app.post('/api/auth/password-reset', async (c) => {
  const db = c.env.DB;
  const body = await readJson(c);
  const email = String(body?.email || '').trim().toLowerCase();
  const generic = {
    ok: true,
    message: '若该邮箱已注册，找回申请已提交，管理员会尽快处理。',
  };
  if (!EMAIL_RE.test(email)) return ok(c, generic);

  const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!user) return ok(c, generic);

  try {
    const recent = await db
      .prepare(
        "SELECT 1 AS hit FROM password_reset_requests WHERE user_id = ? AND status = 'pending' AND created_at >= ?",
      )
      .bind(user.id, new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .first();
    if (recent) return ok(c, generic);

    await db
      .prepare(
        "INSERT INTO password_reset_requests (user_id, email, status, note, created_at) VALUES (?, ?, 'pending', '', ?)",
      )
      .bind(user.id, email, nowIso())
      .run();

    const admins = await db
      .prepare('SELECT u.id FROM admin_users a JOIN users u ON u.id = a.user_id LIMIT 50')
      .all();
    for (const admin of admins.results) {
      await pushNotification(
        db,
        admin.id,
        'type_security',
        '收到密码找回申请',
        `${user.display_name}（${email}）申请重置密码，请前往用户管理处理。`,
        '/admin',
      );
    }
    await addSecurityLog(
      db,
      user.id,
      '提交密码找回申请',
      `${detectClient(c).label} · ${clientLocation(c)}`,
      'orange',
      'i-lock',
    );
  } catch {
    /* 找回申请表尚未迁移时保持静默，避免暴露账号是否存在 */
  }
  return ok(c, generic);
});

app.get('/api/auth/providers', async (c) => {
  const map = await socialConfigMap(c);
  const providers = Object.values(map).map((info) => ({
    id: info.provider.id,
    label: info.provider.label,
    backup: Boolean(info.provider.backup),
    enabled: info.enabled,
  }));
  return ok(c, { providers, site: publicSiteSettings(await siteSettings(c)) });
});

app.get('/api/auth/oauth/:provider/start', async (c) => {
  const id = c.req.param('provider');
  const cfg = await oauthConfig(c, id);
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
  const cfg = await oauthConfig(c, id);
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

app.get('/api/me', async (c) => {
  const user = await ensureAdminAccess(c, c.get('userRow'));
  const unread = await c.env.DB.prepare(
    'SELECT COUNT(*) AS count FROM notification_messages WHERE user_id = ? AND read_at IS NULL',
  )
    .bind(user.id)
    .first();
  return ok(c, {
    user: await serializeUserFor(c, user),
    dateLabel: dateLabel(),
    site: publicSiteSettings(await siteSettings(c)),
    unread: unread?.count || 0,
  });
});

/* ------------------------------------------------------------------ */
/* INU OAuth 2.0 身份提供方                                             */
/* ------------------------------------------------------------------ */

const INU_OAUTH_SCOPES = [
  { key: 'profile', label: '星际档案', description: '昵称、INU ID、轨道编号、会员等级与头像字符' },
  { key: 'email', label: '邮箱地址', description: '星际通行证邮箱与认证状态' },
];
const INU_OAUTH_SCOPE_KEYS = INU_OAUTH_SCOPES.map((item) => item.key);
const INU_OAUTH_CODE_TTL_MS = 5 * 60 * 1000;
const INU_OAUTH_TOKEN_TTL_MS = 60 * 60 * 1000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function tokenJson(c, payload, status = 200, headers = {}) {
  return c.json(payload, status, {
    ...CORS_HEADERS,
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
    ...headers,
  });
}

function oauthJsonError(c, status, error, description, headers = {}) {
  return tokenJson(c, { error, error_description: description }, status, headers);
}

function parseScopeList(value) {
  return Array.from(new Set(String(value || '').split(/\s+/).filter(Boolean)));
}

function normalizeScopes(value, fallback = 'profile') {
  const requested = parseScopeList(value || fallback);
  if (!requested.length) return { scopes: [fallback], error: null };
  const unknown = requested.find((scope) => !INU_OAUTH_SCOPE_KEYS.includes(scope));
  if (unknown) return { scopes: [], error: unknown };
  return { scopes: INU_OAUTH_SCOPE_KEYS.filter((scope) => requested.includes(scope)), error: null };
}

function isAllowedRedirectUri(value) {
  try {
    const url = new URL(String(value));
    if (url.hash) return false;
    if (url.username || url.password) return false;
    if (url.protocol === 'https:') return true;
    if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

function parseRedirectUris(row) {
  try {
    const list = JSON.parse(row.redirect_uris || '[]');
    return Array.isArray(list) ? list.filter((item) => typeof item === 'string' && item) : [];
  } catch {
    return [];
  }
}

function serializeClient(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    description: row.description || '',
    homepageUrl: row.homepage_url || '',
    redirectUris: parseRedirectUris(row),
    scopes: parseScopeList(row.scopes),
    isPublic: Boolean(row.is_public),
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

function oauthRedirectWith(redirectUri, params) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

function oauthErrorPage(c, title, message) {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} · INU 星际通行证</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box;margin:0;padding:0}
  body{min-height:100vh;display:grid;place-items:center;padding:24px;background:#070d1a;color:#e8edf7;
    font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
    background-image:radial-gradient(520px 320px at 82% -6%,rgba(139,92,246,.28),transparent 62%),
      radial-gradient(460px 300px at 8% 18%,rgba(6,182,212,.2),transparent 62%)}
  .card{width:min(440px,100%);padding:34px 30px;border-radius:22px;border:1px solid rgba(255,255,255,.1);
    background:linear-gradient(160deg,rgba(21,32,54,.96),rgba(11,18,32,.98));
    box-shadow:0 28px 70px rgba(0,0,0,.5);text-align:center}
  .mark{width:52px;height:52px;margin:0 auto 18px;border-radius:16px;display:grid;place-items:center;
    background:linear-gradient(135deg,#165DFF,#8B5CF6);box-shadow:0 10px 26px rgba(22,93,255,.4);font-size:22px;font-weight:800}
  h1{font-size:21px;letter-spacing:.02em;margin-bottom:10px}
  p{font-size:13.5px;line-height:1.8;color:#a7b4cb}
  .tag{display:inline-block;margin-top:20px;padding:6px 12px;border-radius:999px;font-size:11px;
    letter-spacing:.14em;color:#8fb6ff;background:rgba(77,141,255,.14);border:1px solid rgba(77,141,255,.24)}
</style>
</head>
<body>
  <main class="card">
    <div class="mark">INU</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <span class="tag">INU IDENTITY PROVIDER</span>
  </main>
</body>
</html>`;
  return c.html(html, 400, {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
  });
}

function authInputFromQuery(c) {
  return {
    clientId: c.req.query('client_id') || '',
    redirectUri: c.req.query('redirect_uri') || '',
    responseType: c.req.query('response_type') || '',
    scope: c.req.query('scope') || '',
    state: c.req.query('state') || '',
    challenge: c.req.query('code_challenge') || '',
    challengeMethod: c.req.query('code_challenge_method') || '',
    prompt: c.req.query('prompt') || '',
  };
}

async function validateAuthRequest(c, input) {
  const client = input.clientId
    ? await c.env.DB.prepare('SELECT * FROM oauth_clients WHERE client_id = ?').bind(input.clientId).first()
    : null;

  if (!client) {
    return {
      pageError: ['未找到该应用', 'client_id 不存在，请确认应用是否已在 INU 超级管理台注册。'],
    };
  }
  if (!client.enabled) {
    return { pageError: ['应用已停用', '该应用目前无法使用 INU 登录，请联系应用管理员。'] };
  }

  const redirectUris = parseRedirectUris(client);
  if (!input.redirectUri || !redirectUris.includes(input.redirectUri)) {
    return {
      pageError: ['回调地址不匹配', 'redirect_uri 必须与应用登记的回调地址完全一致。'],
    };
  }

  const fail = (error, description) => ({
    redirect: oauthRedirectWith(input.redirectUri, {
      error,
      error_description: description,
      state: input.state,
    }),
  });

  if (input.responseType !== 'code') {
    return fail('unsupported_response_type', '仅支持 response_type=code');
  }
  if (input.state.length > 512) {
    return fail('invalid_request', 'state 参数过长');
  }

  const normalized = normalizeScopes(input.scope, 'profile');
  if (normalized.error) {
    return fail('invalid_scope', `不支持的 scope：${normalized.error}`);
  }

  if (Boolean(client.is_public)) {
    if (!input.challenge || input.challengeMethod !== 'S256') {
      return fail('invalid_request', '公开客户端必须使用 PKCE，并提供 code_challenge_method=S256');
    }
  }
  if (input.challenge && input.challengeMethod !== 'S256') {
    return fail('invalid_request', '仅支持 code_challenge_method=S256');
  }
  if (input.challenge && (input.challenge.length < 43 || input.challenge.length > 128)) {
    return fail('invalid_request', 'code_challenge 长度不合法');
  }

  return {
    client,
    redirectUri: input.redirectUri,
    scopes: normalized.scopes,
    state: input.state,
    challenge: input.challenge,
    challengeMethod: input.challenge ? input.challengeMethod : '',
    forceConsent: input.prompt === 'consent',
  };
}

app.get('/oauth/authorize', async (c) => {
  const result = await validateAuthRequest(c, authInputFromQuery(c));
  if (result.pageError) return oauthErrorPage(c, result.pageError[0], result.pageError[1]);
  if (result.redirect) {
    c.header('Cache-Control', 'no-store');
    return c.redirect(result.redirect, 302);
  }

  const user = await getSessionUser(c);
  const search = new URL(c.req.url).search;
  const origin = new URL(c.req.url).origin;

  if (!user) {
    const login = new URL('/login', origin);
    login.searchParams.set('redirect', `/consent${search}`);
    c.header('Cache-Control', 'no-store');
    return c.redirect(login.toString(), 302);
  }

  c.header('Cache-Control', 'no-store');
  return c.redirect(`/consent${search}`, 302);
});

app.get('/api/oauth/authorize/context', async (c) => {
  const input = authInputFromQuery(c);
  const result = await validateAuthRequest(c, input);
  if (result.pageError) {
    return jsonError(c, 400, 'INVALID_AUTHORIZATION_REQUEST', result.pageError[1]);
  }
  if (result.redirect) return ok(c, { redirect: result.redirect });

  const user = c.get('userRow');
  const consent = await c.env.DB.prepare(
    'SELECT scopes FROM oauth_consents WHERE user_id = ? AND client_id = ?',
  )
    .bind(user.id, result.client.client_id)
    .first();
  const granted = consent ? parseScopeList(consent.scopes) : [];
  const approved =
    !result.forceConsent && result.scopes.every((scope) => granted.includes(scope));

  return ok(c, {
    client: {
      clientId: result.client.client_id,
      name: result.client.name,
      description: result.client.description || '',
      homepageUrl: result.client.homepage_url || '',
      isPublic: Boolean(result.client.is_public),
      redirectHost: new URL(result.redirectUri).host,
    },
    user: {
      name: user.display_name,
      inuId: user.inu_id,
      email: user.email,
      avatarText: user.avatar_text,
      tierLabel: tierOf(user).label,
    },
    scopes: INU_OAUTH_SCOPES.filter((scope) => result.scopes.includes(scope.key)),
    approved,
    forceConsent: result.forceConsent,
  });
});

app.post('/api/oauth/authorize/decision', async (c) => {
  const origin = new URL(c.req.url).origin;
  const requestOrigin = c.req.header('Origin');
  if (requestOrigin && requestOrigin !== origin) {
    return jsonError(c, 403, 'ORIGIN_MISMATCH', '跨站授权请求已被拒绝');
  }
  const fetchSite = c.req.header('Sec-Fetch-Site');
  if (fetchSite && fetchSite !== 'same-origin') {
    return jsonError(c, 403, 'ORIGIN_MISMATCH', '跨站授权请求已被拒绝');
  }

  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const input = {
    clientId: String(body.client_id || ''),
    redirectUri: String(body.redirect_uri || ''),
    responseType: String(body.response_type || ''),
    scope: String(body.scope || ''),
    state: String(body.state || ''),
    challenge: String(body.code_challenge || ''),
    challengeMethod: String(body.code_challenge_method || ''),
    prompt: String(body.prompt || ''),
  };
  const result = await validateAuthRequest(c, input);
  if (result.pageError) {
    return jsonError(c, 400, 'INVALID_AUTHORIZATION_REQUEST', result.pageError[1]);
  }
  if (result.redirect) return ok(c, { redirect: result.redirect });

  const decision = String(body.decision || '');
  if (decision === 'deny') {
    return ok(c, {
      redirect: oauthRedirectWith(result.redirectUri, {
        error: 'access_denied',
        error_description: '用户拒绝了本次授权请求',
        state: result.state,
      }),
    });
  }
  if (decision !== 'approve') {
    return jsonError(c, 400, 'INVALID_DECISION', '未知的授权结果');
  }

  const user = c.get('userRow');
  const code = `inu_ac_${randomBase64Url(32)}`;
  const codeHash = await sha256Hex(code);
  const now = nowIso();
  const scopes = result.scopes.join(' ');

  await c.env.DB.prepare('DELETE FROM oauth_authorization_codes WHERE expires_at <= ?').bind(now).run();
  await c.env.DB.prepare(
    `INSERT INTO oauth_authorization_codes
       (code_hash, client_id, user_id, redirect_uri, scopes, code_challenge, code_challenge_method, expires_at, used_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
  )
    .bind(
      codeHash,
      result.client.client_id,
      user.id,
      result.redirectUri,
      scopes,
      result.challenge || null,
      result.challengeMethod || null,
      new Date(Date.now() + INU_OAUTH_CODE_TTL_MS).toISOString(),
      now,
    )
    .run();

  await c.env.DB.prepare(
    `INSERT INTO oauth_consents (user_id, client_id, scopes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, client_id) DO UPDATE SET scopes = excluded.scopes, updated_at = excluded.updated_at`,
  )
    .bind(user.id, result.client.client_id, scopes, now, now)
    .run();

  try {
    await addActivity(
      c.env.DB,
      user.id,
      '授权第三方应用',
      `${result.client.name} · ${result.scopes.join(' / ')}`,
      'blue',
      'i-globe',
    );
  } catch {
    /* 活动记录失败不影响授权 */
  }

  return ok(c, {
    redirect: oauthRedirectWith(result.redirectUri, { code, state: result.state }),
  });
});

function readOAuthBody(c) {
  const type = c.req.header('Content-Type') || '';
  if (type.includes('application/json')) return readJson(c);
  return c.req.parseBody().catch(() => ({}));
}

function decodeBasicCredentials(value) {
  try {
    const binary = atob(value);
    const decoded = new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)));
    const index = decoded.indexOf(':');
    if (index < 0) return null;
    const decode = (part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    };
    return { clientId: decode(decoded.slice(0, index)), clientSecret: decode(decoded.slice(index + 1)) };
  } catch {
    return null;
  }
}

function clientCredentialsFromRequest(c, body) {
  let clientId = String(body.client_id || '').trim();
  let clientSecret = String(body.client_secret || '');
  const authorization = c.req.header('Authorization') || '';
  const usedBasic = authorization.startsWith('Basic ');
  if (usedBasic) {
    const decoded = decodeBasicCredentials(authorization.slice(6).trim());
    if (decoded) {
      clientId = decoded.clientId.trim();
      clientSecret = decoded.clientSecret;
    }
  }
  return { clientId, clientSecret, usedBasic };
}

async function authenticateOAuthClient(c, clientId, clientSecret) {
  if (!clientId) return { error: 'invalid_client' };
  const client = await c.env.DB.prepare('SELECT * FROM oauth_clients WHERE client_id = ?')
    .bind(clientId)
    .first();
  if (!client || !client.enabled) return { error: 'invalid_client' };

  if (client.is_public) {
    if (clientSecret) return { error: 'invalid_client' };
    return { client };
  }
  if (!clientSecret || !client.client_secret_hash) return { error: 'invalid_client' };
  const hash = await sha256Hex(clientSecret);
  if (!safeEqual(hash, client.client_secret_hash)) return { error: 'invalid_client' };
  return { client };
}

app.options('/oauth/token', (c) => c.body(null, 204, CORS_HEADERS));
app.options('/oauth/userinfo', (c) => c.body(null, 204, CORS_HEADERS));
app.options('/oauth/revoke', (c) => c.body(null, 204, CORS_HEADERS));

app.post('/oauth/token', async (c) => {
  const body = (await readOAuthBody(c)) || {};
  const grantType = String(body.grant_type || '');
  if (grantType !== 'authorization_code') {
    return oauthJsonError(c, 400, 'unsupported_grant_type', '仅支持 authorization_code');
  }

  const { clientId, clientSecret, usedBasic } = clientCredentialsFromRequest(c, body);
  const auth = await authenticateOAuthClient(c, clientId, clientSecret);
  if (auth.error) {
    return oauthJsonError(c, 401, 'invalid_client', '客户端认证失败', {
      'WWW-Authenticate': `Basic realm="inu-oauth"${usedBasic ? ', charset="UTF-8"' : ''}`,
    });
  }
  const client = auth.client;

  const code = String(body.code || '');
  const redirectUri = String(body.redirect_uri || '');
  if (!code || !redirectUri) {
    return oauthJsonError(c, 400, 'invalid_request', '缺少 code 或 redirect_uri');
  }

  const codeHash = await sha256Hex(code);
  const record = await c.env.DB.prepare('SELECT * FROM oauth_authorization_codes WHERE code_hash = ?')
    .bind(codeHash)
    .first();

  if (
    !record ||
    record.client_id !== client.client_id ||
    record.redirect_uri !== redirectUri ||
    record.used_at ||
    new Date(record.expires_at).getTime() <= Date.now()
  ) {
    return oauthJsonError(c, 400, 'invalid_grant', '授权码无效、已使用或已过期');
  }

  const verifier = String(body.code_verifier || '');
  if (record.code_challenge) {
    if (!verifier) return oauthJsonError(c, 400, 'invalid_grant', '缺少 code_verifier');
    const computed = await sha256Base64Url(verifier);
    if (!safeEqual(computed, record.code_challenge)) {
      return oauthJsonError(c, 400, 'invalid_grant', 'code_verifier 与 code_challenge 不匹配');
    }
  } else if (client.is_public) {
    return oauthJsonError(c, 400, 'invalid_grant', '公开客户端必须使用 PKCE');
  }

  const marked = await c.env.DB.prepare(
    'UPDATE oauth_authorization_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL',
  )
    .bind(nowIso(), codeHash)
    .run();
  if (!marked.meta?.changes) {
    return oauthJsonError(c, 400, 'invalid_grant', '授权码已被使用');
  }

  const token = `inu_at_${randomBase64Url(32)}`;
  const tokenHash = await sha256Hex(token);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + INU_OAUTH_TOKEN_TTL_MS).toISOString();

  await c.env.DB.prepare(
    `INSERT INTO oauth_tokens (token_hash, client_id, user_id, scopes, expires_at, created_at, last_used_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`,
  )
    .bind(tokenHash, client.client_id, record.user_id, record.scopes, expiresAt, createdAt)
    .run();
  await c.env.DB.prepare('UPDATE oauth_clients SET last_used_at = ? WHERE client_id = ?')
    .bind(createdAt, client.client_id)
    .run();
  await c.env.DB.prepare('DELETE FROM oauth_tokens WHERE expires_at <= ?').bind(createdAt).run();

  return tokenJson(c, {
    access_token: token,
    token_type: 'Bearer',
    expires_in: Math.floor(INU_OAUTH_TOKEN_TTL_MS / 1000),
    scope: record.scopes,
  });
});

app.get('/oauth/userinfo', async (c) => {
  const authorization = c.req.header('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    return tokenJson(c, { error: 'invalid_token', error_description: '缺少 Bearer Token' }, 401, {
      'WWW-Authenticate': 'Bearer realm="inu-oauth"',
    });
  }

  const tokenHash = await sha256Hex(token);
  const user = await c.env.DB.prepare(
    `SELECT t.scopes AS token_scopes, u.*
     FROM oauth_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ? AND t.revoked_at IS NULL AND t.expires_at > ?`,
  )
    .bind(tokenHash, nowIso())
    .first();

  if (!user) {
    return tokenJson(c, { error: 'invalid_token', error_description: 'Token 无效或已过期' }, 401, {
      'WWW-Authenticate': 'Bearer realm="inu-oauth", error="invalid_token"',
    });
  }

  await c.env.DB.prepare('UPDATE oauth_tokens SET last_used_at = ? WHERE token_hash = ?')
    .bind(nowIso(), tokenHash)
    .run();

  const scopes = parseScopeList(user.token_scopes);
  const payload = { sub: user.inu_id };
  if (scopes.includes('profile')) {
    payload.name = user.display_name;
    payload.preferred_username = user.display_name;
    payload.inu_id = user.inu_id;
    payload.orbit = user.orbit_code;
    payload.avatar_text = user.avatar_text;
    payload.tier = user.member_tier;
    payload.tier_label = tierOf(user).label;
  }
  if (scopes.includes('email')) {
    payload.email = user.email;
    payload.email_verified = Boolean(user.verified);
  }
  return tokenJson(c, payload);
});

app.post('/oauth/revoke', async (c) => {
  const body = (await readOAuthBody(c)) || {};
  const { clientId, clientSecret, usedBasic } = clientCredentialsFromRequest(c, body);
  const auth = await authenticateOAuthClient(c, clientId, clientSecret);
  if (auth.error) {
    return oauthJsonError(c, 401, 'invalid_client', '客户端认证失败', {
      'WWW-Authenticate': `Basic realm="inu-oauth"${usedBasic ? ', charset="UTF-8"' : ''}`,
    });
  }

  const token = String(body.token || '');
  if (token) {
    const tokenHash = await sha256Hex(token);
    await c.env.DB.prepare(
      'UPDATE oauth_tokens SET revoked_at = ? WHERE token_hash = ? AND client_id = ? AND revoked_at IS NULL',
    )
      .bind(nowIso(), tokenHash, auth.client.client_id)
      .run();
  }
  return tokenJson(c, { ok: true });
});

app.get('/.well-known/oauth-authorization-server', (c) => {
  const origin = new URL(c.req.url).origin;
  return c.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      userinfo_endpoint: `${origin}/oauth/userinfo`,
      revocation_endpoint: `${origin}/oauth/revoke`,
      scopes_supported: INU_OAUTH_SCOPE_KEYS,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      revocation_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      code_challenge_methods_supported: ['S256'],
      service_documentation: `${origin}/admin`,
    },
    200,
    {
      ...CORS_HEADERS,
      'Cache-Control': 'public, max-age=300',
    },
  );
});

/* ------------------------------------------------------------------ */
/* 超级管理台 API                                                       */
/* ------------------------------------------------------------------ */

async function addAdminAudit(c, action, detail) {
  try {
    const user = c.get('userRow');
    await c.env.DB.prepare(
      'INSERT INTO admin_audit_logs (admin_id, action, detail, ip, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(user.id, action, detail, clientIp(c), nowIso())
      .run();
  } catch {
    /* 审计写入失败不阻断管理操作 */
  }
}

async function adminList(c) {
  const rows = await c.env.DB.prepare(
    `SELECT a.user_id, a.granted_by, a.created_at AS granted_at, u.email, u.display_name, u.inu_id
     FROM admin_users a JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at ASC`,
  ).all();
  return rows.results.map((row) => ({
    userId: row.user_id,
    email: row.email,
    name: row.display_name,
    inuId: row.inu_id,
    grantedBy: row.granted_by,
    grantedAt: row.granted_at,
  }));
}

async function safeAll(db, sql, binds = []) {
  try {
    const stmt = binds.length ? db.prepare(sql).bind(...binds) : db.prepare(sql);
    const rows = await stmt.all();
    return rows.results || [];
  } catch {
    return [];
  }
}

async function safeFirst(db, sql, binds = []) {
  try {
    const stmt = binds.length ? db.prepare(sql).bind(...binds) : db.prepare(sql);
    return await stmt.first();
  } catch {
    return null;
  }
}

app.get('/api/admin', async (c) => {
  const db = c.env.DB;
  const now = nowIso();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const origin = new URL(c.req.url).origin;

  const [
    users,
    verified,
    clientsStats,
    clients,
    activeTokens,
    issued,
    consents,
    admins,
    audit,
    providerMap,
    site,
    products,
    agreementTemplates,
    recentOrders,
    recentWithdrawals,
    recentRecharges,
    recentUsers,
    finance,
    signStats,
    resetRequests,
  ] =
    await Promise.all([
      db.prepare('SELECT COUNT(*) AS count FROM users').first(),
      db.prepare('SELECT COUNT(*) AS count FROM users WHERE verified = 1').first(),
      db.prepare(
        'SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END), 0) AS enabled FROM oauth_clients',
      ).first(),
      db.prepare('SELECT * FROM oauth_clients ORDER BY created_at DESC LIMIT 50').all(),
      db.prepare('SELECT COUNT(*) AS count FROM oauth_tokens WHERE revoked_at IS NULL AND expires_at > ?')
        .bind(now)
        .first(),
      db.prepare('SELECT COUNT(*) AS count FROM oauth_tokens WHERE created_at >= ?').bind(weekAgo).first(),
      db.prepare('SELECT COUNT(*) AS count FROM oauth_consents').first(),
      adminList(c),
      db.prepare(
        `SELECT l.id, l.action, l.detail, l.ip, l.created_at, u.display_name AS admin_name
         FROM admin_audit_logs l LEFT JOIN users u ON u.id = l.admin_id
         ORDER BY l.created_at DESC LIMIT 20`,
      ).all(),
      socialConfigMap(c),
      siteSettings(c),
      safeAll(db, 'SELECT * FROM products ORDER BY sort ASC, id ASC'),
      safeAll(db, 'SELECT * FROM agreement_templates ORDER BY sort ASC, id ASC'),
      safeAll(
        db,
        `SELECT o.*, u.display_name AS user_name, u.email AS user_email, u.inu_id AS user_inu_id
         FROM orders o LEFT JOIN users u ON u.id = o.user_id
         ORDER BY o.created_at DESC LIMIT 20`,
      ),
      safeAll(
        db,
        `SELECT w.*, u.display_name AS user_name, u.email AS user_email
         FROM withdrawals w LEFT JOIN users u ON u.id = w.user_id
         ORDER BY w.created_at DESC LIMIT 20`,
      ),
      safeAll(
        db,
        `SELECT r.*, u.display_name AS user_name, u.email AS user_email
         FROM recharge_orders r LEFT JOIN users u ON u.id = r.user_id
         ORDER BY r.created_at DESC LIMIT 20`,
      ),
      safeAll(
        db,
        `SELECT u.id, u.email, u.display_name, u.inu_id, u.star_energy_cents, u.particles, u.verified,
                u.phone, u.phone_verified, u.email_verified, u.two_fa, u.created_at,
                CASE WHEN a.user_id IS NULL THEN 0 ELSE 1 END AS is_admin
         FROM users u LEFT JOIN admin_users a ON a.user_id = u.id
         ORDER BY u.created_at DESC LIMIT 20`,
      ),
      safeFirst(
        db,
        `SELECT
          (SELECT COALESCE(SUM(star_energy_cents), 0) FROM users) AS wallet_cents,
          (SELECT COALESCE(SUM(amount_cents), 0) FROM recharge_orders WHERE status = 'paid') AS recharge_cents,
          (SELECT COALESCE(SUM(energy_cents), 0) FROM orders WHERE status != 'cancelled') AS supply_cents,
          (SELECT COALESCE(SUM(amount_cents), 0) FROM withdrawals WHERE status = 'processing') AS withdraw_pending_cents,
          (SELECT COALESCE(SUM(amount_cents), 0) FROM withdrawals WHERE status = 'paid') AS withdrawn_cents,
          (SELECT COUNT(*) FROM orders) AS order_count,
          (SELECT COUNT(*) FROM withdrawals WHERE status = 'processing') AS withdraw_pending_count,
          (SELECT COUNT(*) FROM recharge_orders) AS recharge_count`,
      ),
      safeFirst(
        db,
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN status = 'signed' THEN 1 ELSE 0 END), 0) AS signed
         FROM agreements`,
      ),
      safeAll(
        db,
        `SELECT r.id, r.user_id, r.email, r.status, r.note, r.created_at,
                u.display_name AS user_name, u.inu_id AS user_inu_id
         FROM password_reset_requests r LEFT JOIN users u ON u.id = r.user_id
         WHERE r.status = 'pending'
         ORDER BY r.created_at DESC LIMIT 20`,
      ),
    ]);

  return ok(c, {
    stats: {
      users: users?.count || 0,
      verifiedUsers: verified?.count || 0,
      clients: clientsStats?.total || 0,
      enabledClients: clientsStats?.enabled || 0,
      activeTokens: activeTokens?.count || 0,
      issued7d: issued?.count || 0,
      consents: consents?.count || 0,
    },
    finance: {
      walletCents: finance?.wallet_cents || 0,
      rechargeCents: finance?.recharge_cents || 0,
      supplyCents: finance?.supply_cents || 0,
      withdrawPendingCents: finance?.withdraw_pending_cents || 0,
      withdrawnCents: finance?.withdrawn_cents || 0,
      orderCount: finance?.order_count || 0,
      withdrawPendingCount: finance?.withdraw_pending_count || 0,
      rechargeCount: finance?.recharge_count || 0,
      agreementTotal: signStats?.total || 0,
      agreementSigned: signStats?.signed || 0,
    },
    products: products.map((row) => ({
      id: row.id,
      name: row.name,
      desc: row.desc,
      priceCents: row.price_cents,
      icon: row.icon,
      tag: row.tag,
      tone: row.tone,
      stock: row.stock,
      active: Boolean(row.active),
      sort: row.sort,
      updatedAt: row.updated_at,
    })),
    agreementTemplates: agreementTemplates.map((row) => ({
      id: row.id,
      title: row.title,
      version: row.version,
      content: row.content,
      reward: row.reward,
      sort: row.sort,
      active: Boolean(row.active),
      updatedAt: row.updated_at,
    })),
    orders: recentOrders.map((row) => ({
      ...serializeOrder(row),
      userName: row.user_name || '未知用户',
      userEmail: row.user_email || '',
      userInuId: row.user_inu_id || '',
    })),
    withdrawals: recentWithdrawals.map((row) => ({
      id: row.id,
      code: row.code,
      userId: row.user_id,
      userName: row.user_name || '未知用户',
      userEmail: row.user_email || '',
      amountCents: row.amount_cents,
      account: row.account,
      status: row.status,
      note: row.note,
      createdAt: row.created_at,
      processedAt: row.processed_at,
      processedBy: row.processed_by,
    })),
    recharges: recentRecharges.map((row) => ({
      id: row.id,
      code: row.code,
      userId: row.user_id,
      userName: row.user_name || '未知用户',
      userEmail: row.user_email || '',
      amountCents: row.amount_cents,
      method: row.method,
      status: row.status,
      createdAt: row.created_at,
      paidAt: row.paid_at,
    })),
    users: recentUsers.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.display_name,
      inuId: row.inu_id,
      balanceCents: row.star_energy_cents,
      particles: row.particles,
      verified: Boolean(row.verified),
      phone: row.phone || '',
      phoneVerified: Boolean(row.phone_verified),
      emailVerified: row.email_verified === undefined ? true : Boolean(row.email_verified),
      isAdmin: Boolean(row.is_admin),
      twoFa: Boolean(row.two_fa),
      createdAt: row.created_at,
    })),
    passwordResets: resetRequests.map((row) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,
      userName: row.user_name || '未知用户',
      userInuId: row.user_inu_id || '',
      note: row.note || '',
      createdAt: row.created_at,
    })),
    providers: Object.values(providerMap).map((info) => serializeSocialProvider(c, info)),
    clients: clients.results.map(serializeClient),
    admins,
    audit: audit.results.map((row) => ({
      id: row.id,
      action: row.action,
      detail: row.detail,
      ip: row.ip,
      adminName: row.admin_name || '系统',
      createdAt: row.created_at,
    })),
    settings: adminSiteSettings(site),
    endpoints: {
      issuer: origin,
      authorization: `${origin}/oauth/authorize`,
      token: `${origin}/oauth/token`,
      userinfo: `${origin}/oauth/userinfo`,
      revocation: `${origin}/oauth/revoke`,
      discovery: `${origin}/.well-known/oauth-authorization-server`,
    },
    scopes: INU_OAUTH_SCOPES,
    config: {
      secretKeyReady: Boolean(c.env.CONFIG_KEY),
      envAdminCount: String(c.env.ADMIN_EMAILS || '').split(',').map((item) => item.trim()).filter(Boolean).length,
    },
  });
});

app.patch('/api/admin/settings', async (c) => {
  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const current = await siteSettings(c);
  const next = { ...current };

  const boolKeys = [
    'demoVisible',
    'demoReadOnly',
    'noticeEnabled',
    'featureRecharge',
    'featureWithdraw',
    'featurePhoneBind',
    'featureEmailChange',
    'featureAvatar',
    'featureSupply',
    'featureAgreements',
    'featureRegister',
    'maintenanceEnabled',
  ];
  for (const key of boolKeys) {
    if (body[key] !== undefined) next[key] = Boolean(body[key]);
  }

  if (body.noticeText !== undefined) {
    const text = String(body.noticeText).trim();
    if ([...text].length > 200) return jsonError(c, 400, 'INVALID_NOTICE', '公告内容最多 200 个字符');
    next.noticeText = text;
  }

  if (body.noticeLevel !== undefined) {
    const level = String(body.noticeLevel || '');
    if (!SITE_NOTICE_LEVELS.includes(level)) {
      return jsonError(c, 400, 'INVALID_NOTICE_LEVEL', '公告级别只能是 info / success / warn');
    }
    next.noticeLevel = level;
  }

  if (body.footerText !== undefined) {
    const text = String(body.footerText).trim();
    if (!text) return jsonError(c, 400, 'INVALID_FOOTER', '页脚文案不能为空');
    if ([...text].length > 120) return jsonError(c, 400, 'INVALID_FOOTER', '页脚文案最多 120 个字符');
    next.footerText = text;
  }

  if (body.loginWelcome !== undefined) {
    const text = String(body.loginWelcome).trim();
    if (!text) return jsonError(c, 400, 'INVALID_LOGIN_WELCOME', '登录页欢迎语不能为空');
    if ([...text].length > 120) return jsonError(c, 400, 'INVALID_LOGIN_WELCOME', '登录页欢迎语最多 120 个字符');
    next.loginWelcome = text;
  }

  if (body.supportEmail !== undefined) {
    const email = String(body.supportEmail).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return jsonError(c, 400, 'INVALID_SUPPORT_EMAIL', '请输入有效的客服邮箱');
    next.supportEmail = email;
  }

  if (body.walletCardLast4 !== undefined) {
    const value = String(body.walletCardLast4).trim();
    if (!/^\d{4}$/.test(value)) return jsonError(c, 400, 'INVALID_CARD', '钱包尾号需为 4 位数字');
    next.walletCardLast4 = value;
  }

  if (body.paymentMode !== undefined) {
    const mode = String(body.paymentMode || '');
    if (!PAYMENT_MODES.includes(mode)) {
      return jsonError(c, 400, 'INVALID_PAYMENT_MODE', '支付模式只能是 mock 或 off');
    }
    next.paymentMode = mode;
  }

  if (body.verificationMode !== undefined) {
    const mode = String(body.verificationMode || '');
    if (!VERIFICATION_MODES.includes(mode)) {
      return jsonError(c, 400, 'INVALID_VERIFY_MODE', '验证码通道只能是 console 或 off');
    }
    next.verificationMode = mode;
  }

  if (body.rechargePresets !== undefined) {
    const source = Array.isArray(body.rechargePresets)
      ? body.rechargePresets
      : String(body.rechargePresets).split(',');
    const presets = source
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item >= 1 && item <= 100000);
    if (!presets.length || presets.length > 8) {
      return jsonError(c, 400, 'INVALID_PRESETS', '请填写 1–8 个充值金额（元）');
    }
    next.rechargePresets = Array.from(new Set(presets));
  }

  if (body.withdrawMinCents !== undefined) {
    const value = Number(body.withdrawMinCents);
    if (!Number.isFinite(value) || value < 1000 || value > 5000000) {
      return jsonError(c, 400, 'INVALID_WITHDRAW_MIN', '提现门槛需在 10–50000 元之间');
    }
    next.withdrawMinCents = Math.round(value);
  }

  if (body.nameChangeDays !== undefined) {
    const value = Number(body.nameChangeDays);
    if (!Number.isFinite(value) || value < 0 || value > 365) {
      return jsonError(c, 400, 'INVALID_NAME_DAYS', '昵称修改间隔需在 0–365 天之间，0 表示不限制');
    }
    next.nameChangeDays = Math.round(value);
  }

  if (body.maintenanceText !== undefined) {
    const text = String(body.maintenanceText).trim();
    if ([...text].length > 200) return jsonError(c, 400, 'INVALID_MAINTENANCE_TEXT', '维护提示最多 200 个字符');
    next.maintenanceText = text;
  }

  if (next.noticeEnabled && !next.noticeText) {
    return jsonError(c, 400, 'NOTICE_TEXT_REQUIRED', '开启站点公告前请填写公告内容');
  }
  if (next.maintenanceEnabled && !next.maintenanceText) {
    return jsonError(c, 400, 'MAINTENANCE_TEXT_REQUIRED', '开启维护模式前请填写维护提示');
  }

  const boolSetting = (key, value) => saveSetting(c.env.DB, `${SITE_PREFIX}${key}`, value ? '1' : '0');
  await Promise.all([
    boolSetting('demo_visible', next.demoVisible),
    boolSetting('demo_readonly', next.demoReadOnly),
    boolSetting('notice_enabled', next.noticeEnabled),
    saveSetting(c.env.DB, `${SITE_PREFIX}notice_text`, next.noticeText),
    saveSetting(c.env.DB, `${SITE_PREFIX}notice_level`, next.noticeLevel),
    saveSetting(c.env.DB, `${SITE_PREFIX}footer_text`, next.footerText),
    saveSetting(c.env.DB, `${SITE_PREFIX}login_welcome`, next.loginWelcome),
    saveSetting(c.env.DB, `${SITE_PREFIX}support_email`, next.supportEmail),
    saveSetting(c.env.DB, `${SITE_PREFIX}wallet_card_last4`, next.walletCardLast4),
    boolSetting('feature_recharge', next.featureRecharge),
    boolSetting('feature_withdraw', next.featureWithdraw),
    boolSetting('feature_phone_bind', next.featurePhoneBind),
    boolSetting('feature_email_change', next.featureEmailChange),
    boolSetting('feature_avatar', next.featureAvatar),
    boolSetting('feature_supply', next.featureSupply),
    boolSetting('feature_agreements', next.featureAgreements),
    boolSetting('feature_register', next.featureRegister),
    saveSetting(c.env.DB, `${SITE_PREFIX}payment_mode`, next.paymentMode),
    saveSetting(c.env.DB, `${SITE_PREFIX}verification_mode`, next.verificationMode),
    saveSetting(c.env.DB, `${SITE_PREFIX}recharge_presets`, next.rechargePresets.join(',')),
    saveSetting(c.env.DB, `${SITE_PREFIX}withdraw_min_cents`, String(next.withdrawMinCents)),
    saveSetting(c.env.DB, `${SITE_PREFIX}name_change_days`, String(next.nameChangeDays)),
    boolSetting('maintenance_enabled', next.maintenanceEnabled),
    saveSetting(c.env.DB, `${SITE_PREFIX}maintenance_text`, next.maintenanceText),
  ]);

  c.set('siteSettings', next);
  await addAdminAudit(
    c,
    '更新站点设置',
    `公告${next.noticeEnabled ? '开启' : '关闭'} · 充值${next.featureRecharge ? '开启' : '关闭'} · 维护${next.maintenanceEnabled ? '开启' : '关闭'}`,
  );

  return ok(c, { settings: adminSiteSettings(next) });
});

app.patch('/api/admin/providers/:id', async (c) => {
  const id = c.req.param('id');
  const provider = OAUTH_PROVIDERS[id];
  if (!provider) return jsonError(c, 404, 'UNKNOWN_PROVIDER', '未知的第三方登录方式');

  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const clientId = String(body.clientId ?? '').trim();
  const hasClientId = body.clientId !== undefined;
  const clientSecret = String(body.clientSecret ?? '');
  const clearSecret = Boolean(body.clearSecret);
  const current = (await socialConfigMap(c))[id];
  const effectiveClientId = hasClientId ? clientId : current.clientId;
  const enabled = body.enabled === undefined ? current.enabled : Boolean(body.enabled);

  if (clientId.length > 300) return jsonError(c, 400, 'INVALID_CLIENT_ID', 'Client ID 过长');
  if (clientSecret.length > 1000) return jsonError(c, 400, 'INVALID_CLIENT_SECRET', 'Client Secret 过长');
  if (clientSecret && !c.env.CONFIG_KEY) {
    return jsonError(
      c,
      400,
      'CONFIG_KEY_MISSING',
      '未配置 CONFIG_KEY，无法加密保存 Client Secret。请先为 Worker 设置 CONFIG_KEY 密钥',
    );
  }

  const effectiveSecret = clearSecret
    ? String(c.env[provider.clientSecretEnv] || '')
    : clientSecret || current.clientSecret;
  if (enabled && (!effectiveClientId || !effectiveSecret)) {
    return jsonError(c, 400, 'INCOMPLETE_CONFIG', '启用前请填写 Client ID 与 Client Secret');
  }

  const prefix = `${SETTING_PREFIX}${id}.`;
  await saveSetting(c.env.DB, `${prefix}client_id`, effectiveClientId);
  if (clientSecret) {
    await saveSetting(c.env.DB, `${prefix}client_secret`, await encryptConfig(c, clientSecret));
  } else if (clearSecret) {
    await c.env.DB.prepare('DELETE FROM app_settings WHERE key = ?').bind(`${prefix}client_secret`).run();
  }
  await saveSetting(c.env.DB, `${prefix}enabled`, enabled ? '1' : '0');

  await addAdminAudit(
    c,
    '更新第三方登录',
    `${provider.label} · ${enabled ? '已启用' : '已停用'}${clientSecret ? ' · 已更新密钥' : ''}`,
  );

  const updated = (await socialConfigMap(c))[id];
  return ok(c, { provider: serializeSocialProvider(c, updated) });
});

function normalizeRedirectUris(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
  const seen = new Set();
  const list = [];
  for (const item of source) {
    const uri = String(item || '').trim();
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    list.push(uri);
  }
  return list;
}

app.post('/api/admin/oauth-clients', async (c) => {
  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const name = String(body.name || '').trim();
  if ([...name].length < 2 || [...name].length > 40) {
    return jsonError(c, 400, 'INVALID_NAME', '应用名称需为 2–40 个字符');
  }
  const description = String(body.description || '').trim().slice(0, 200);
  const homepageUrl = String(body.homepageUrl || '').trim();
  if (homepageUrl && !/^https?:\/\//i.test(homepageUrl)) {
    return jsonError(c, 400, 'INVALID_HOMEPAGE', '应用主页需以 http:// 或 https:// 开头');
  }

  const redirectUris = normalizeRedirectUris(body.redirectUris);
  if (!redirectUris.length || redirectUris.length > 10) {
    return jsonError(c, 400, 'INVALID_REDIRECT_URIS', '请填写 1–10 个回调地址');
  }
  const invalidUri = redirectUris.find((uri) => !isAllowedRedirectUri(uri));
  if (invalidUri) {
    return jsonError(
      c,
      400,
      'INVALID_REDIRECT_URI',
      `回调地址不合法：${invalidUri}（需为 https，或 localhost 的 http）`,
    );
  }

  const normalized = normalizeScopes(
    Array.isArray(body.scopes) ? body.scopes.join(' ') : body.scopes || 'profile email',
    'profile email',
  );
  if (normalized.error) return jsonError(c, 400, 'INVALID_SCOPE', `不支持的 scope：${normalized.error}`);

  const isPublic = Boolean(body.isPublic);
  const enabled = body.enabled === undefined ? true : Boolean(body.enabled);
  const clientId = `inu_${randomBase64Url(18)}`;
  const clientSecret = isPublic ? '' : `inu_sk_${randomBase64Url(32)}`;
  const clientSecretHash = clientSecret ? await sha256Hex(clientSecret) : null;
  const createdAt = nowIso();

  const inserted = await c.env.DB.prepare(
    `INSERT INTO oauth_clients
       (client_id, client_secret_hash, name, description, homepage_url, redirect_uris, scopes,
        is_public, enabled, created_by, created_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  )
    .bind(
      clientId,
      clientSecretHash,
      name,
      description,
      homepageUrl,
      JSON.stringify(redirectUris),
      normalized.scopes.join(' '),
      isPublic ? 1 : 0,
      enabled ? 1 : 0,
      c.get('userRow').id,
      createdAt,
    )
    .run();

  const row = await c.env.DB.prepare('SELECT * FROM oauth_clients WHERE id = ?')
    .bind(inserted.meta?.last_row_id)
    .first();
  await addAdminAudit(c, '创建 OAuth 应用', `${name} · ${clientId}`);
  return ok(c, { client: serializeClient(row), clientSecret: clientSecret || null });
});

app.patch('/api/admin/oauth-clients/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const row = await c.env.DB.prepare('SELECT * FROM oauth_clients WHERE id = ?').bind(id).first();
  if (!row) return jsonError(c, 404, 'NOT_FOUND', '未找到该应用');

  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');
  if (body.isPublic !== undefined && Boolean(body.isPublic) !== Boolean(row.is_public)) {
    return jsonError(c, 400, 'IMMUTABLE_CLIENT_TYPE', '应用类型创建后不可修改，请新建应用');
  }

  const name = body.name === undefined ? row.name : String(body.name).trim();
  if ([...name].length < 2 || [...name].length > 40) {
    return jsonError(c, 400, 'INVALID_NAME', '应用名称需为 2–40 个字符');
  }
  const description =
    body.description === undefined ? row.description : String(body.description).trim().slice(0, 200);
  const homepageUrl = body.homepageUrl === undefined ? row.homepage_url : String(body.homepageUrl).trim();
  if (homepageUrl && !/^https?:\/\//i.test(homepageUrl)) {
    return jsonError(c, 400, 'INVALID_HOMEPAGE', '应用主页需以 http:// 或 https:// 开头');
  }

  const redirectUris =
    body.redirectUris === undefined ? parseRedirectUris(row) : normalizeRedirectUris(body.redirectUris);
  if (!redirectUris.length || redirectUris.length > 10) {
    return jsonError(c, 400, 'INVALID_REDIRECT_URIS', '请填写 1–10 个回调地址');
  }
  const invalidUri = redirectUris.find((uri) => !isAllowedRedirectUri(uri));
  if (invalidUri) {
    return jsonError(c, 400, 'INVALID_REDIRECT_URI', `回调地址不合法：${invalidUri}`);
  }

  let scopes = parseScopeList(row.scopes);
  if (body.scopes !== undefined) {
    const normalized = normalizeScopes(
      Array.isArray(body.scopes) ? body.scopes.join(' ') : body.scopes,
      'profile',
    );
    if (normalized.error) return jsonError(c, 400, 'INVALID_SCOPE', `不支持的 scope：${normalized.error}`);
    scopes = normalized.scopes;
  }

  const enabled = body.enabled === undefined ? Boolean(row.enabled) : Boolean(body.enabled);

  await c.env.DB.prepare(
    `UPDATE oauth_clients
     SET name = ?, description = ?, homepage_url = ?, redirect_uris = ?, scopes = ?, enabled = ?
     WHERE id = ?`,
  )
    .bind(
      name,
      description,
      homepageUrl,
      JSON.stringify(redirectUris),
      scopes.join(' '),
      enabled ? 1 : 0,
      id,
    )
    .run();

  if (!enabled) {
    await c.env.DB.prepare('UPDATE oauth_tokens SET revoked_at = ? WHERE client_id = ? AND revoked_at IS NULL')
      .bind(nowIso(), row.client_id)
      .run();
  }

  const updated = await c.env.DB.prepare('SELECT * FROM oauth_clients WHERE id = ?').bind(id).first();
  await addAdminAudit(c, '更新 OAuth 应用', `${name} · ${enabled ? '已启用' : '已停用'}`);
  return ok(c, { client: serializeClient(updated) });
});

app.post('/api/admin/oauth-clients/:id/rotate-secret', async (c) => {
  const id = Number(c.req.param('id'));
  const row = await c.env.DB.prepare('SELECT * FROM oauth_clients WHERE id = ?').bind(id).first();
  if (!row) return jsonError(c, 404, 'NOT_FOUND', '未找到该应用');
  if (row.is_public) return jsonError(c, 400, 'PUBLIC_CLIENT', '公开客户端没有 Client Secret');

  const clientSecret = `inu_sk_${randomBase64Url(32)}`;
  const clientSecretHash = await sha256Hex(clientSecret);
  await c.env.DB.prepare('UPDATE oauth_clients SET client_secret_hash = ? WHERE id = ?')
    .bind(clientSecretHash, id)
    .run();
  await addAdminAudit(c, '轮换 OAuth 密钥', `${row.name} · ${row.client_id}`);
  return ok(c, { client: serializeClient(row), clientSecret });
});

app.delete('/api/admin/oauth-clients/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const row = await c.env.DB.prepare('SELECT * FROM oauth_clients WHERE id = ?').bind(id).first();
  if (!row) return jsonError(c, 404, 'NOT_FOUND', '未找到该应用');

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM oauth_authorization_codes WHERE client_id = ?').bind(row.client_id),
    c.env.DB.prepare('DELETE FROM oauth_tokens WHERE client_id = ?').bind(row.client_id),
    c.env.DB.prepare('DELETE FROM oauth_consents WHERE client_id = ?').bind(row.client_id),
    c.env.DB.prepare('DELETE FROM oauth_clients WHERE id = ?').bind(id),
  ]);
  await addAdminAudit(c, '删除 OAuth 应用', `${row.name} · ${row.client_id}`);
  return ok(c, { ok: true });
});

app.get('/api/admin/audit', async (c) => {
  const limit = Math.max(1, Math.min(100, Number(c.req.query('limit')) || 50));
  const rows = await c.env.DB.prepare(
    `SELECT l.id, l.action, l.detail, l.ip, l.created_at, u.display_name AS admin_name
     FROM admin_audit_logs l LEFT JOIN users u ON u.id = l.admin_id
     ORDER BY l.created_at DESC LIMIT ?`,
  )
    .bind(limit)
    .all();
  return ok(c, {
    logs: rows.results.map((row) => ({
      id: row.id,
      action: row.action,
      detail: row.detail,
      ip: row.ip,
      adminName: row.admin_name || '系统',
      createdAt: row.created_at,
    })),
  });
});

app.post('/api/admin/admins', async (c) => {
  const body = await readJson(c);
  const email = String(body?.email || '').trim().toLowerCase();
  if (!email) return jsonError(c, 400, 'INVALID_INPUT', '请输入要授权的账号邮箱');

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!user) return jsonError(c, 404, 'USER_NOT_FOUND', '该邮箱尚未注册 INU 通行证');
  const exists = await c.env.DB.prepare('SELECT 1 AS hit FROM admin_users WHERE user_id = ?')
    .bind(user.id)
    .first();
  if (exists) return jsonError(c, 409, 'ALREADY_ADMIN', '该账号已经是超级管理员');

  await c.env.DB.prepare('INSERT INTO admin_users (user_id, granted_by, created_at) VALUES (?, ?, ?)')
    .bind(user.id, `admin:${c.get('userRow').id}`, nowIso())
    .run();
  await addAdminAudit(c, '授予管理员', `${user.display_name} · ${user.email}`);
  return ok(c, { admins: await adminList(c) });
});

app.delete('/api/admin/admins/:userId', async (c) => {
  const userId = Number(c.req.param('userId'));
  const current = c.get('userRow');
  if (userId === current.id) {
    return jsonError(c, 400, 'SELF_REMOVE', '不能移除自己的管理员权限');
  }

  const exists = await c.env.DB.prepare('SELECT 1 AS hit FROM admin_users WHERE user_id = ?')
    .bind(userId)
    .first();
  if (!exists) return jsonError(c, 404, 'NOT_FOUND', '该账号不是管理员');

  const count = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM admin_users').first();
  if ((count?.count || 0) <= 1) {
    return jsonError(c, 400, 'LAST_ADMIN', '至少需要保留一位超级管理员');
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  await c.env.DB.prepare('DELETE FROM admin_users WHERE user_id = ?').bind(userId).run();
  await addAdminAudit(c, '移除管理员', user ? `${user.display_name} · ${user.email}` : `用户 #${userId}`);
  return ok(c, { admins: await adminList(c) });
});

/* 商品管理 */

function serializeAdminProduct(row) {
  return {
    id: row.id,
    name: row.name,
    desc: row.desc,
    priceCents: row.price_cents,
    icon: row.icon,
    tag: row.tag,
    tone: row.tone,
    stock: row.stock,
    active: Boolean(row.active),
    sort: row.sort,
    updatedAt: row.updated_at,
  };
}

function readProductInput(body, base = null) {
  const name = body.name !== undefined ? String(body.name).trim() : base?.name || '';
  if ([...name].length < 1 || [...name].length > 40) return { error: '商品名称需为 1–40 个字符' };

  const desc = body.desc !== undefined ? String(body.desc).trim() : base?.desc || '';
  if ([...desc].length > 160) return { error: '商品描述最多 160 个字符' };

  const priceCents =
    body.priceCents !== undefined ? Math.round(Number(body.priceCents)) : Number(base?.priceCents);
  if (!Number.isFinite(priceCents) || priceCents < 100 || priceCents > 10000000) {
    return { error: '商品价格需在 1–100000 星能之间' };
  }

  const icon = body.icon !== undefined ? String(body.icon).trim() : base?.icon || 'i-box';
  if (!/^i-[a-z0-9-]{1,30}$/.test(icon)) return { error: '请选择有效的商品图标' };

  const tag = body.tag !== undefined ? String(body.tag).trim() : base?.tag || '';
  if ([...tag].length > 12) return { error: '商品标签最多 12 个字符' };

  const tone = body.tone !== undefined ? String(body.tone) : base?.tone || 'blue';
  if (!AVATAR_TONES.includes(tone)) return { error: '请选择有效的配色' };

  const stockRaw = body.stock !== undefined ? Math.round(Number(body.stock)) : (base?.stock ?? -1);
  if (!Number.isFinite(stockRaw) || stockRaw < -1 || stockRaw > 99999) {
    return { error: '库存需在 -1（不限）到 99999 之间' };
  }

  const sortRaw = body.sort !== undefined ? Math.round(Number(body.sort)) : (base?.sort ?? 0);
  if (!Number.isFinite(sortRaw) || sortRaw < 0 || sortRaw > 9999) {
    return { error: '排序值需在 0–9999 之间' };
  }

  const active = body.active !== undefined ? Boolean(body.active) : base?.active ?? true;
  return { value: { name, desc, priceCents, icon, tag, tone, stock: stockRaw, sort: sortRaw, active } };
}

app.post('/api/admin/products', async (c) => {
  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const parsed = readProductInput(body);
  if (parsed.error) return jsonError(c, 400, 'INVALID_PRODUCT', parsed.error);

  const requestedId = String(body.id || '').trim().toLowerCase();
  if (requestedId && !/^[a-z0-9][a-z0-9-]{1,39}$/.test(requestedId)) {
    return jsonError(c, 400, 'INVALID_PRODUCT_ID', '商品 ID 只能包含小写字母、数字与连字符（2–40 位）');
  }
  const id = requestedId || `sku-${Date.now().toString(36)}${randomDigits(3)}`;
  const exists = await c.env.DB.prepare('SELECT 1 AS hit FROM products WHERE id = ?').bind(id).first();
  if (exists) return jsonError(c, 409, 'PRODUCT_EXISTS', '该商品 ID 已存在');

  const value = parsed.value;
  await c.env.DB.prepare(
    `INSERT INTO products (id, name, desc, price_cents, icon, tag, tone, stock, active, sort, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      value.name,
      value.desc,
      value.priceCents,
      value.icon,
      value.tag,
      value.tone,
      value.stock,
      value.active ? 1 : 0,
      value.sort,
      nowIso(),
    )
    .run();

  await addAdminAudit(c, '新增补给商品', `${value.name} · ${(value.priceCents / 100).toFixed(2)} 星能`);
  const row = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  return ok(c, { product: serializeAdminProduct(row) });
});

app.patch('/api/admin/products/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  if (!existing) return jsonError(c, 404, 'NOT_FOUND', '未找到该商品');

  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const parsed = readProductInput(body, serializeAdminProduct(existing));
  if (parsed.error) return jsonError(c, 400, 'INVALID_PRODUCT', parsed.error);
  const value = parsed.value;

  await c.env.DB.prepare(
    `UPDATE products SET name = ?, desc = ?, price_cents = ?, icon = ?, tag = ?, tone = ?,
       stock = ?, active = ?, sort = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(
      value.name,
      value.desc,
      value.priceCents,
      value.icon,
      value.tag,
      value.tone,
      value.stock,
      value.active ? 1 : 0,
      value.sort,
      nowIso(),
      id,
    )
    .run();

  await addAdminAudit(c, '更新补给商品', `${value.name} · ${value.active ? '上架' : '下架'}`);
  const row = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  return ok(c, { product: serializeAdminProduct(row) });
});

app.delete('/api/admin/products/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  if (!existing) return jsonError(c, 404, 'NOT_FOUND', '未找到该商品');

  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  await addAdminAudit(c, '删除补给商品', existing.name);
  return ok(c, { ok: true });
});

/* 协议模板管理 */

function readTemplateInput(body, base = null) {
  const title = body.title !== undefined ? String(body.title).trim() : base?.title || '';
  if ([...title].length < 2 || [...title].length > 40) return { error: '协议名称需为 2–40 个字符' };

  const version = body.version !== undefined ? String(body.version).trim() : base?.version || 'v1.0';
  if ([...version].length < 1 || [...version].length > 20) return { error: '协议版本需为 1–20 个字符' };

  const content = body.content !== undefined ? String(body.content) : base?.content || '';
  if ([...content].length < 10) return { error: '协议正文至少需要 10 个字符' };
  if ([...content].length > 20000) return { error: '协议正文最多 20000 个字符' };

  const rewardRaw = body.reward !== undefined ? Math.round(Number(body.reward)) : (base?.reward ?? 50);
  if (!Number.isFinite(rewardRaw) || rewardRaw < 0 || rewardRaw > 10000) {
    return { error: '签署奖励需在 0–10000 粒子之间' };
  }

  const sortRaw = body.sort !== undefined ? Math.round(Number(body.sort)) : (base?.sort ?? 0);
  if (!Number.isFinite(sortRaw) || sortRaw < 0 || sortRaw > 9999) return { error: '排序值需在 0–9999 之间' };

  const active = body.active !== undefined ? Boolean(body.active) : base?.active ?? true;
  return { value: { title, version, content, reward: rewardRaw, sort: sortRaw, active } };
}

async function syncAgreementSnapshots(db, template) {
  await db
    .prepare(
      `UPDATE agreements SET title = ?, version = ?, content = ?, reward = ?, sort = ?
       WHERE template_id = ? AND status = 'pending'`,
    )
    .bind(template.title, template.version, template.content, template.reward, template.sort, template.id)
    .run();
}

app.post('/api/admin/agreement-templates', async (c) => {
  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const parsed = readTemplateInput(body);
  if (parsed.error) return jsonError(c, 400, 'INVALID_TEMPLATE', parsed.error);
  const value = parsed.value;

  const exists = await c.env.DB.prepare('SELECT 1 AS hit FROM agreement_templates WHERE title = ?')
    .bind(value.title)
    .first();
  if (exists) return jsonError(c, 409, 'TEMPLATE_EXISTS', '同名协议模板已存在');

  const inserted = await c.env.DB.prepare(
    `INSERT INTO agreement_templates (title, version, content, reward, sort, active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(value.title, value.version, value.content, value.reward, value.sort, value.active ? 1 : 0, nowIso())
    .run();

  await ensureAgreementsAllUsers(c.env.DB, inserted.meta?.last_row_id);
  await addAdminAudit(c, '新增协议模板', value.title);
  const row = await c.env.DB.prepare('SELECT * FROM agreement_templates WHERE id = ?')
    .bind(inserted.meta?.last_row_id)
    .first();
  return ok(c, {
    template: {
      id: row.id,
      title: row.title,
      version: row.version,
      content: row.content,
      reward: row.reward,
      sort: row.sort,
      active: Boolean(row.active),
      updatedAt: row.updated_at,
    },
  });
});

async function ensureAgreementsAllUsers(db, templateId) {
  try {
    const template = await db.prepare('SELECT * FROM agreement_templates WHERE id = ?').bind(templateId).first();
    if (!template || !template.active) return;
    const users = await db.prepare('SELECT id FROM users').all();
    for (const user of users.results) {
      await db
        .prepare(
          `INSERT INTO agreements (user_id, title, version, status, signed_at, sort, content, reward, template_id)
           VALUES (?, ?, ?, 'pending', NULL, ?, ?, ?, ?)`,
        )
        .bind(user.id, template.title, template.version, template.sort, template.content, template.reward, template.id)
        .run();
    }
  } catch {
    /* 用户协议补齐失败不阻断模板保存 */
  }
}

app.patch('/api/admin/agreement-templates/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const existing = await c.env.DB.prepare('SELECT * FROM agreement_templates WHERE id = ?').bind(id).first();
  if (!existing) return jsonError(c, 404, 'NOT_FOUND', '未找到该协议模板');

  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const base = {
    title: existing.title,
    version: existing.version,
    content: existing.content,
    reward: existing.reward,
    sort: existing.sort,
    active: Boolean(existing.active),
  };
  const parsed = readTemplateInput(body, base);
  if (parsed.error) return jsonError(c, 400, 'INVALID_TEMPLATE', parsed.error);
  const value = parsed.value;

  const sameTitle = await c.env.DB.prepare(
    'SELECT 1 AS hit FROM agreement_templates WHERE title = ? AND id != ?',
  )
    .bind(value.title, id)
    .first();
  if (sameTitle) return jsonError(c, 409, 'TEMPLATE_EXISTS', '同名协议模板已存在');

  await c.env.DB.prepare(
    `UPDATE agreement_templates SET title = ?, version = ?, content = ?, reward = ?, sort = ?, active = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(value.title, value.version, value.content, value.reward, value.sort, value.active ? 1 : 0, nowIso(), id)
    .run();

  await syncAgreementSnapshots(c.env.DB, { ...value, id });
  if (value.active && !existing.active) await ensureAgreementsAllUsers(c.env.DB, id);

  await addAdminAudit(c, '更新协议模板', `${value.title} · ${value.version}`);
  const row = await c.env.DB.prepare('SELECT * FROM agreement_templates WHERE id = ?').bind(id).first();
  return ok(c, {
    template: {
      id: row.id,
      title: row.title,
      version: row.version,
      content: row.content,
      reward: row.reward,
      sort: row.sort,
      active: Boolean(row.active),
      updatedAt: row.updated_at,
    },
  });
});

app.delete('/api/admin/agreement-templates/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const existing = await c.env.DB.prepare('SELECT * FROM agreement_templates WHERE id = ?').bind(id).first();
  if (!existing) return jsonError(c, 404, 'NOT_FOUND', '未找到该协议模板');

  await c.env.DB.prepare('DELETE FROM agreement_templates WHERE id = ?').bind(id).run();
  await c.env.DB.prepare('UPDATE agreements SET template_id = NULL WHERE template_id = ?').bind(id).run();
  await addAdminAudit(c, '删除协议模板', existing.title);
  return ok(c, { ok: true });
});

/* 站内信广播 */

app.post('/api/admin/notifications', async (c) => {
  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const title = String(body.title || '').trim();
  const text = String(body.body || '').trim();
  if ([...title].length < 2 || [...title].length > 40) {
    return jsonError(c, 400, 'INVALID_TITLE', '消息标题需为 2–40 个字符');
  }
  if ([...text].length < 2 || [...text].length > 300) {
    return jsonError(c, 400, 'INVALID_BODY', '消息正文需为 2–300 个字符');
  }
  const category = String(body.category || 'type_radio');
  if (!NOTIFICATION_TYPES.some((item) => item.key === category)) {
    return jsonError(c, 400, 'INVALID_CATEGORY', '未知的消息分类');
  }
  const link = String(body.link || '').trim().slice(0, 200);
  const email = String(body.email || '').trim().toLowerCase();

  let targets;
  if (email) {
    const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (!user) return jsonError(c, 404, 'USER_NOT_FOUND', '该邮箱尚未注册 INU 通行证');
    targets = [user.id];
  } else {
    const rows = await c.env.DB.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 5000').all();
    targets = rows.results.map((row) => row.id);
  }

  let sent = 0;
  for (const userId of targets) {
    if (await pushNotification(c.env.DB, userId, category, title, text, link)) sent += 1;
  }

  await addAdminAudit(c, '发送站内信', `${title} · ${sent}/${targets.length}`);
  return ok(c, { sent, total: targets.length });
});

/* 订单与提现处理 */

app.patch('/api/admin/orders/:id', async (c) => {
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  if (!order) return jsonError(c, 404, 'NOT_FOUND', '未找到该补给订单');

  const status = String(body.status || order.status);
  if (!['pending_payment', 'transit', 'delivered', 'cancelled'].includes(status)) {
    return jsonError(c, 400, 'INVALID_STATUS', '未知的订单状态');
  }
  if (status === 'pending_payment' && order.status !== 'pending_payment') {
    return jsonError(c, 400, 'INVALID_STATUS', '订单不能回退到待支付状态');
  }
  if (status === 'transit' && !order.paid_at) {
    return jsonError(c, 400, 'UNPAID_ORDER', '待支付订单需要用户完成支付后才能进入运输状态');
  }

  const trackingNo =
    body.trackingNo !== undefined ? String(body.trackingNo).trim().slice(0, 60) : order.tracking_no || '';
  const carrier = body.carrier !== undefined ? String(body.carrier).trim().slice(0, 30) : order.carrier || '';
  const now = nowIso();
  let paidAt = order.paid_at;
  let deliveredAt = order.delivered_at;
  let cancelledAt = order.cancelled_at;
  let refunded = 0;

  if (status === 'delivered' && !deliveredAt) deliveredAt = now;
  if (status === 'cancelled' && !cancelledAt) cancelledAt = now;

  if (status === 'cancelled' && order.status !== 'cancelled' && order.paid_at) {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(order.user_id).first();
    if (user) {
      const balance = user.star_energy_cents + order.energy_cents;
      await db.prepare('UPDATE users SET star_energy_cents = ? WHERE id = ?').bind(balance, user.id).run();
      await addWalletTransaction(db, user.id, {
        kind: 'refund',
        title: '补给订单退款',
        detail: `订单 ${order.code} 已被取消，星能原路退回`,
        amountCents: order.energy_cents,
        balanceAfter: balance,
        ref: order.code,
        createdAt: now,
      });
      await pushNotification(
        db,
        user.id,
        'type_supply',
        '补给订单已取消',
        `订单 ${order.code} 已取消，${(order.energy_cents / 100).toFixed(2)} 星能已退回钱包。`,
        '/wallet',
      );
      refunded = order.energy_cents;
    }
  }

  await db
    .prepare(
      `UPDATE orders SET status = ?, tracking_no = ?, carrier = ?, updated_at = ?,
         paid_at = ?, delivered_at = ?, cancelled_at = ? WHERE id = ?`,
    )
    .bind(status, trackingNo || null, carrier || null, now, paidAt, deliveredAt, cancelledAt, id)
    .run();

  if (status === 'delivered' && order.status !== 'delivered') {
    await pushNotification(
      db,
      order.user_id,
      'type_supply',
      '补给已送达',
      `订单 ${order.code} 已完成签收，感谢你的星际旅行。`,
      '/supply',
    );
  }
  if (status === 'transit' && trackingNo && trackingNo !== (order.tracking_no || '')) {
    await pushNotification(
      db,
      order.user_id,
      'type_supply',
      '物流信息已更新',
      `订单 ${order.code} 运单号 ${trackingNo} · ${carrier || '星际快递'}`,
      '/supply',
    );
  }

  await addAdminAudit(c, '更新补给订单', `${order.code} → ${status}${refunded ? ' · 已退款' : ''}`);
  const updated = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  return ok(c, { order: serializeOrder(updated), refunded });
});

app.patch('/api/admin/withdrawals/:id', async (c) => {
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const action = String(body.action || '');
  if (!['approve', 'reject'].includes(action)) {
    return jsonError(c, 400, 'INVALID_ACTION', '请选择通过或驳回');
  }

  const row = await db.prepare('SELECT * FROM withdrawals WHERE id = ?').bind(id).first();
  if (!row) return jsonError(c, 404, 'NOT_FOUND', '未找到该提现申请');
  if (row.status !== 'processing') {
    return jsonError(c, 409, 'INVALID_STATUS', '该提现申请已处理');
  }

  const note = String(body.note || '').trim().slice(0, 200);
  const now = nowIso();
  if (action === 'approve') {
    await db
      .prepare("UPDATE withdrawals SET status = 'paid', note = ?, processed_at = ?, processed_by = ? WHERE id = ?")
      .bind(note, now, c.get('userRow').id, id)
      .run();
    await pushNotification(
      db,
      row.user_id,
      'type_energy',
      '提现已完成',
      `${(row.amount_cents / 100).toFixed(2)} 星能已转入收款账户。`,
      '/wallet',
    );
    await addSecurityLog(db, row.user_id, '提现复核通过', `${row.code} · ${(row.amount_cents / 100).toFixed(2)} 星能`, 'green', 'i-check');
  } else {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(row.user_id).first();
    const balance = (user?.star_energy_cents || 0) + row.amount_cents;
    if (user) {
      await db.prepare('UPDATE users SET star_energy_cents = ? WHERE id = ?').bind(balance, row.user_id).run();
      await addWalletTransaction(db, row.user_id, {
        kind: 'refund',
        title: '提现申请被驳回',
        detail: row.code,
        amountCents: row.amount_cents,
        balanceAfter: balance,
        ref: row.code,
        createdAt: now,
      });
    }
    await db
      .prepare("UPDATE withdrawals SET status = 'rejected', note = ?, processed_at = ?, processed_by = ? WHERE id = ?")
      .bind(note, now, c.get('userRow').id, id)
      .run();
    await pushNotification(
      db,
      row.user_id,
      'type_energy',
      '提现申请未通过',
      `${(row.amount_cents / 100).toFixed(2)} 星能已退回钱包。${note ? `原因：${note}` : ''}`,
      '/wallet',
    );
    await addSecurityLog(db, row.user_id, '提现复核驳回', `${row.code} · 已退回星能`, 'orange', 'i-shield');
  }

  await addAdminAudit(c, action === 'approve' ? '通过提现申请' : '驳回提现申请', `${row.code} · ${(row.amount_cents / 100).toFixed(2)} 星能`);
  return ok(c, { ok: true, status: action === 'approve' ? 'paid' : 'rejected' });
});

/* 用户管理 */

function serializeAdminUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.display_name,
    inuId: row.inu_id,
    balanceCents: row.star_energy_cents,
    particles: row.particles,
    verified: Boolean(row.verified),
    phone: row.phone || '',
    phoneVerified: Boolean(row.phone_verified),
    emailVerified: row.email_verified === undefined ? true : Boolean(row.email_verified),
    isAdmin: Boolean(row.is_admin),
    twoFa: Boolean(row.two_fa),
    createdAt: row.created_at,
  };
}

const ADMIN_USER_FIELDS = `u.id, u.email, u.display_name, u.inu_id, u.star_energy_cents, u.particles, u.verified,
  u.phone, u.phone_verified, u.email_verified, u.two_fa, u.created_at,
  CASE WHEN a.user_id IS NULL THEN 0 ELSE 1 END AS is_admin`;

app.get('/api/admin/users', async (c) => {
  const q = String(c.req.query('q') || '').trim();
  const limit = Math.max(1, Math.min(100, Number(c.req.query('limit')) || 50));
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = await c.env.DB.prepare(
      `SELECT ${ADMIN_USER_FIELDS} FROM users u LEFT JOIN admin_users a ON a.user_id = u.id
       WHERE u.email LIKE ? OR u.display_name LIKE ? OR u.inu_id LIKE ? OR u.phone LIKE ?
       ORDER BY u.created_at DESC LIMIT ?`,
    )
      .bind(like, like, like, like, limit)
      .all();
  } else {
    rows = await c.env.DB.prepare(
      `SELECT ${ADMIN_USER_FIELDS} FROM users u LEFT JOIN admin_users a ON a.user_id = u.id
       ORDER BY u.created_at DESC LIMIT ?`,
    )
      .bind(limit)
      .all();
  }
  return ok(c, { users: rows.results.map(serializeAdminUser) });
});

app.patch('/api/admin/users/:id', async (c) => {
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!user) return jsonError(c, 404, 'NOT_FOUND', '未找到该用户');

  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const updates = [];
  const binds = [];
  let nextBalance = user.star_energy_cents;
  let nextParticles = user.particles;
  const notes = [];

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if ([...name].length < 2 || [...name].length > 20) {
      return jsonError(c, 400, 'INVALID_NAME', '昵称需为 2–20 个字符');
    }
    updates.push('display_name = ?');
    binds.push(name);
    notes.push(`昵称调整为 ${name}`);
  }

  if (body.verified !== undefined) {
    updates.push('verified = ?');
    binds.push(body.verified ? 1 : 0);
    notes.push(body.verified ? '已标记为星际公民' : '已取消星际公民认证');
  }

  const passwordChanged = body.password !== undefined && String(body.password) !== '';
  if (passwordChanged) {
    const password = String(body.password);
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return jsonError(c, 400, 'WEAK_PASSWORD', '密码至少 8 位，且需同时包含字母与数字');
    }
    updates.push('password_hash = ?');
    binds.push(await hashPassword(password));
    updates.push('password_changed_at = ?');
    binds.push(nowIso());
    notes.push('登录密码已重置');
  }

  const particlesDelta = body.particlesDelta === undefined ? 0 : Math.round(Number(body.particlesDelta));
  if (!Number.isFinite(particlesDelta) || Math.abs(particlesDelta) > 1000000) {
    return jsonError(c, 400, 'INVALID_PARTICLES', '粒子调整值无效');
  }
  if (particlesDelta) {
    nextParticles = Math.max(0, user.particles + particlesDelta);
    updates.push('particles = ?');
    binds.push(nextParticles);
    notes.push(`粒子 ${nextParticles - user.particles >= 0 ? '+' : ''}${nextParticles - user.particles}`);
  }

  const balanceDelta = body.balanceDelta === undefined ? 0 : Math.round(Number(body.balanceDelta));
  if (!Number.isFinite(balanceDelta) || Math.abs(balanceDelta) > 100000000) {
    return jsonError(c, 400, 'INVALID_BALANCE', '星能调整值无效');
  }
  if (balanceDelta) {
    nextBalance = Math.max(0, user.star_energy_cents + balanceDelta);
    updates.push('star_energy_cents = ?');
    binds.push(nextBalance);
    notes.push(`星能 ${nextBalance - user.star_energy_cents >= 0 ? '+' : ''}${(nextBalance - user.star_energy_cents) / 100}`);
  }

  if (!updates.length) return jsonError(c, 400, 'EMPTY_UPDATE', '没有需要更新的内容');

  await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...binds, id).run();

  if (passwordChanged) {
    try {
      await db
        .prepare(
          "UPDATE password_reset_requests SET status = 'resolved', handled_at = ?, handled_by = ? WHERE user_id = ? AND status = 'pending'",
        )
        .bind(nowIso(), c.get('userRow').id, id)
        .run();
    } catch {
      /* 申请表尚未迁移时忽略 */
    }
  }

  if (nextBalance !== user.star_energy_cents) {
    await addWalletTransaction(db, id, {
      kind: 'admin',
      title: '管理员调整星能',
      detail: notes.filter((item) => item.startsWith('星能')).join(' · '),
      amountCents: nextBalance - user.star_energy_cents,
      balanceAfter: nextBalance,
    });
  }
  if (nextParticles !== user.particles) {
    await db
      .prepare('INSERT INTO particle_logs (user_id, label, delta, balance, occurred_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, '管理员调整粒子', nextParticles - user.particles, nextParticles, nowIso())
      .run();
  }

  await pushNotification(db, id, 'type_member', '账户数据已调整', notes.join('；'), '/profile');
  await addAdminAudit(c, '调整用户数据', `${user.email} · ${notes.join('；')}`);

  const updated = await db
    .prepare(`SELECT ${ADMIN_USER_FIELDS} FROM users u LEFT JOIN admin_users a ON a.user_id = u.id WHERE u.id = ?`)
    .bind(id)
    .first();
  return ok(c, { user: serializeAdminUser(updated) });
});

app.patch('/api/admin/password-resets/:id', async (c) => {
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  const body = await readJson(c);
  const row = await db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').bind(id).first();
  if (!row) return jsonError(c, 404, 'NOT_FOUND', '未找到该找回申请');
  if (row.status !== 'pending') return jsonError(c, 409, 'INVALID_STATUS', '该找回申请已处理');

  const note = String(body?.note || '').trim().slice(0, 200);
  await db
    .prepare("UPDATE password_reset_requests SET status = 'resolved', note = ?, handled_at = ?, handled_by = ? WHERE id = ?")
    .bind(note, nowIso(), c.get('userRow').id, id)
    .run();
  await addAdminAudit(c, '处理密码找回申请', `${row.email}${note ? ` · ${note}` : ''}`);
  return ok(c, { ok: true });
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
    user: await serializeUserFor(c, user),
    dateLabel: dateLabel(),
    wallet: { balanceCents: user.star_energy_cents, cardLast4: (await siteSettings(c)).walletCardLast4 },
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

app.get('/api/overview/activities', async (c) => {
  const limit = Math.max(1, Math.min(100, Number(c.req.query('limit')) || 50));
  const rows = await c.env.DB.prepare(
    'SELECT * FROM activities WHERE user_id = ? ORDER BY occurred_at DESC LIMIT ?',
  )
    .bind(c.get('userRow').id, limit)
    .all();
  return ok(c, {
    activities: rows.results.map((row) => ({
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
    user: await serializeUserFor(c, user),
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
  const bio = String(body.bio || '').trim();
  const nextEmail = String(body.email || user.email).trim().toLowerCase();

  const nameLength = [...name].length;
  if (nameLength < 2 || nameLength > 16) {
    return jsonError(c, 400, 'INVALID_NAME', '昵称需为 2–16 个字符');
  }
  if ([...bio].length > 60) {
    return jsonError(c, 400, 'INVALID_BIO', '星际签名最多 60 个字符');
  }
  if (nextEmail !== String(user.email).toLowerCase()) {
    return jsonError(c, 400, 'EMAIL_CHANGE_REQUIRES_VERIFY', '更换邮箱需要通过验证码校验');
  }

  const settings = await siteSettings(c);
  const nameChanged = name !== user.display_name;
  if (nameChanged && settings.nameChangeDays > 0 && user.display_name_changed_at) {
    const elapsed = Date.now() - new Date(user.display_name_changed_at).getTime();
    const days = Math.floor(elapsed / 86400000);
    if (days < settings.nameChangeDays) {
      return jsonError(
        c,
        429,
        'NAME_CHANGE_COOLDOWN',
        `昵称每 ${settings.nameChangeDays} 天可修改一次，还需等待 ${settings.nameChangeDays - days} 天`,
      );
    }
  }

  const changedAt = nameChanged ? nowIso() : user.display_name_changed_at;
  await db
    .prepare('UPDATE users SET display_name = ?, bio = ?, display_name_changed_at = ? WHERE id = ?')
    .bind(name, bio, changedAt, user.id)
    .run();

  if (nameChanged) {
    await addSecurityLog(db, user.id, '昵称已更新', `${user.display_name} → ${name}`, 'blue', 'i-pen');
    await addActivity(db, user.id, '更新星际档案', `昵称已改为 ${name}`, 'blue', 'i-pen');
  }

  const updated = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  return ok(c, {
    user: await serializeUserFor(c, updated),
    nameChangeDays: settings.nameChangeDays,
  });
});

app.post('/api/profile/avatar', async (c) => {
  const settings = await siteSettings(c);
  if (!settings.featureAvatar) {
    return jsonError(c, 503, 'FEATURE_DISABLED', '头像更换功能暂未开放');
  }
  const user = c.get('userRow');
  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const text = Array.from(String(body.text || '').replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, 2).join('');
  const tone = String(body.tone || 'blue');
  if (!text) return jsonError(c, 400, 'INVALID_AVATAR', '请选择或输入头像字符');
  if (!AVATAR_TONES.includes(tone)) {
    return jsonError(c, 400, 'INVALID_AVATAR_TONE', '头像配色不在可选范围内');
  }

  await c.env.DB.prepare('UPDATE users SET avatar_text = ?, avatar_tone = ? WHERE id = ?')
    .bind(text, tone, user.id)
    .run();
  await addActivity(c.env.DB, user.id, '更新星际头像', `头像已更换为「${text}」`, 'purple', 'i-user');

  const updated = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  return ok(c, { user: await serializeUserFor(c, updated) });
});

app.post('/api/profile/phone/code', async (c) => {
  const settings = await siteSettings(c);
  if (!settings.featurePhoneBind) {
    return jsonError(c, 503, 'FEATURE_DISABLED', '手机号绑定功能暂未开放');
  }
  const user = c.get('userRow');
  const body = await readJson(c);
  const phone = normalizePhone(body?.phone);
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return jsonError(c, 400, 'INVALID_PHONE', '请输入有效的 11 位手机号');
  }
  const conflict = await c.env.DB.prepare('SELECT id FROM users WHERE phone = ? AND id <> ?')
    .bind(phone, user.id)
    .first();
  if (conflict) return jsonError(c, 409, 'PHONE_TAKEN', '该手机号已绑定其他星际档案');

  const result = await issueVerificationCode(c, user, 'phone', phone);
  if (result.error) return result.error;
  return ok(c, {
    ...result,
    message: result.devCode ? '演示环境验证码已生成，请查看下方提示' : '验证码已发送',
  });
});

app.post('/api/profile/phone/verify', async (c) => {
  const user = c.get('userRow');
  const body = await readJson(c);
  const phone = normalizePhone(body?.phone);
  const code = String(body?.code || '').trim();
  if (!/^1[3-9]\d{9}$/.test(phone)) return jsonError(c, 400, 'INVALID_PHONE', '请输入有效的 11 位手机号');
  if (!/^\d{6}$/.test(code)) return jsonError(c, 400, 'INVALID_CODE', '请输入 6 位验证码');

  const checked = await consumeVerificationCode(c.env.DB, user, 'phone', phone, code);
  if (!checked.ok) return jsonError(c, 400, 'INVALID_CODE', checked.message);

  await c.env.DB.prepare('UPDATE users SET phone = ?, phone_verified = 1 WHERE id = ?')
    .bind(phone, user.id)
    .run();
  await addSecurityLog(c.env.DB, user.id, '手机号已绑定', `${phone.slice(0, 3)}****${phone.slice(-4)}`, 'green', 'i-phone');
  await addActivity(c.env.DB, user.id, '绑定手机号', '安全验证与找回能力已增强', 'green', 'i-phone');
  await pushNotification(c.env.DB, user.id, 'type_security', '手机号绑定成功', '你的账号已绑定新的安全手机号。', '/security');

  const updated = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  return ok(c, { user: await serializeUserFor(c, updated) });
});

app.delete('/api/profile/phone', async (c) => {
  const user = c.get('userRow');
  const body = await readJson(c);
  const password = String(body?.password || '');
  if (!user.phone) return jsonError(c, 400, 'PHONE_NOT_BOUND', '当前账号尚未绑定手机号');
  const valid = await verifyPassword(user.password_hash, password);
  if (!valid) return jsonError(c, 400, 'INVALID_PASSWORD', '登录密码不正确');

  await c.env.DB.prepare('UPDATE users SET phone = NULL, phone_verified = 0 WHERE id = ?').bind(user.id).run();
  await c.env.DB.prepare("UPDATE notification_prefs SET enabled = 0 WHERE user_id = ? AND key = 'channel_sms'")
    .bind(user.id)
    .run();
  await addSecurityLog(c.env.DB, user.id, '手机号已解绑', '短信通知已关闭', 'orange', 'i-phone');

  const updated = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  return ok(c, { user: await serializeUserFor(c, updated) });
});

app.post('/api/profile/email/code', async (c) => {
  const settings = await siteSettings(c);
  if (!settings.featureEmailChange) {
    return jsonError(c, 503, 'FEATURE_DISABLED', '安全邮箱更换功能暂未开放');
  }
  const user = c.get('userRow');
  const body = await readJson(c);
  const email = String(body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return jsonError(c, 400, 'INVALID_EMAIL', '请输入有效的邮箱地址');
  if (email === String(user.email).toLowerCase()) {
    return jsonError(c, 400, 'SAME_EMAIL', '新邮箱与当前邮箱相同');
  }
  const conflict = await c.env.DB.prepare('SELECT id FROM users WHERE email = ? AND id <> ?')
    .bind(email, user.id)
    .first();
  if (conflict) return jsonError(c, 409, 'EMAIL_TAKEN', '该邮箱已被其他星际档案使用');

  const result = await issueVerificationCode(c, user, 'email', email);
  if (result.error) return result.error;
  return ok(c, {
    ...result,
    message: result.devCode ? '演示环境验证码已生成，请查看下方提示' : '验证码已发送至新邮箱',
  });
});

app.post('/api/profile/email/verify', async (c) => {
  const user = c.get('userRow');
  const body = await readJson(c);
  const email = String(body?.email || '').trim().toLowerCase();
  const code = String(body?.code || '').trim();
  if (!EMAIL_RE.test(email)) return jsonError(c, 400, 'INVALID_EMAIL', '请输入有效的邮箱地址');
  if (!/^\d{6}$/.test(code)) return jsonError(c, 400, 'INVALID_CODE', '请输入 6 位验证码');

  const checked = await consumeVerificationCode(c.env.DB, user, 'email', email, code);
  if (!checked.ok) return jsonError(c, 400, 'INVALID_CODE', checked.message);

  const conflict = await c.env.DB.prepare('SELECT id FROM users WHERE email = ? AND id <> ?')
    .bind(email, user.id)
    .first();
  if (conflict) return jsonError(c, 409, 'EMAIL_TAKEN', '该邮箱已被其他星际档案使用');

  const oldEmail = user.email;
  await c.env.DB.prepare('UPDATE users SET email = ?, email_verified = 1 WHERE id = ?')
    .bind(email, user.id)
    .run();
  await addSecurityLog(c.env.DB, user.id, '安全邮箱已更换', `${oldEmail} → ${email}`, 'green', 'i-mail');
  await addActivity(c.env.DB, user.id, '更换安全邮箱', email, 'blue', 'i-mail');
  await pushNotification(c.env.DB, user.id, 'type_security', '安全邮箱更换成功', `新的安全邮箱为 ${email}，如非本人操作请立即联系客服。`, '/security');

  const updated = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  return ok(c, { user: await serializeUserFor(c, updated) });
});

app.post('/api/profile/verify', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const settings = await siteSettings(c);
  if (settings.verificationMode === 'off') {
    return jsonError(c, 503, 'VERIFICATION_UNAVAILABLE', '星际公民认证通道尚未开启，请联系管理员');
  }
  if (user.verified) {
    return ok(c, { user: await serializeUserFor(c, user), message: '星际公民身份已认证' });
  }

  await db.prepare('UPDATE users SET verified = 1 WHERE id = ?').bind(user.id).run();
  await addSecurityLog(db, user.id, '星际公民认证完成', '身份核验通过 · 权限已解锁', 'green', 'i-idcard');
  await addActivity(db, user.id, '完成星际公民认证', '补给站下单与星能提现已解锁', 'purple', 'i-idcard');

  const updated = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  return ok(c, { user: await serializeUserFor(c, updated) });
});

/* ------------------------------------------------------------------ */
/* 账户安全                                                             */
/* ------------------------------------------------------------------ */

app.get('/api/security', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const now = nowIso();
  const [logs, connections] = await Promise.all([
    db
      .prepare('SELECT * FROM security_logs WHERE user_id = ? ORDER BY occurred_at DESC LIMIT 4')
      .bind(user.id)
      .all(),
    db
      .prepare(
        `SELECT cons.client_id, cons.scopes, cons.created_at, cons.updated_at,
                cl.name, cl.description, cl.homepage_url, cl.enabled, cl.is_public,
                (SELECT COUNT(*) FROM oauth_tokens t
                  WHERE t.user_id = cons.user_id AND t.client_id = cons.client_id
                    AND t.revoked_at IS NULL AND t.expires_at > ?) AS active_tokens,
                (SELECT MAX(t.last_used_at) FROM oauth_tokens t
                  WHERE t.user_id = cons.user_id AND t.client_id = cons.client_id) AS last_used_at
         FROM oauth_consents cons
         JOIN oauth_clients cl ON cl.client_id = cons.client_id
         WHERE cons.user_id = ?
         ORDER BY cons.updated_at DESC`,
      )
      .bind(now, user.id)
      .all(),
  ]);

  const score = 78 + (user.two_fa ? 8 : 0) + (user.phone_verified ? 6 : user.phone ? 3 : 0) + (user.email_verified === 0 ? 0 : 4);

  return ok(c, {
    user: await serializeUserFor(c, user),
    score,
    scoreLabel: score >= 90 ? '防护严密' : '仍有提升空间',
    percentile: score >= 90 ? '高于 92% 星际公民' : '高于 78% 星际公民',
    items: [
      { label: '密码强度', value: '中等' },
      { label: '两步验证', value: user.two_fa ? '已开启' : '未开启' },
      { label: '绑定手机', value: user.phone ? (user.phone_verified ? '已验证' : '待验证') : '未绑定' },
    ],
    credentials: {
      email: user.email,
      emailVerified: user.email_verified !== 0,
      phone: user.phone || '',
      phoneVerified: Boolean(user.phone_verified),
      passwordAgeDays: daysSince(user.password_changed_at),
    },
    guards: {
      geo: Boolean(user.guard_geo),
      device: Boolean(user.guard_device),
      sensitive: Boolean(user.guard_sensitive),
    },
    connections: connections.results.map((row) => {
      const scopes = parseScopeList(row.scopes);
      return {
        clientId: row.client_id,
        name: row.name,
        description: row.description || '',
        homepageUrl: row.homepage_url || '',
        enabled: Boolean(row.enabled),
        isPublic: Boolean(row.is_public),
        scopes: scopes.map((scope) => {
          const meta = INU_OAUTH_SCOPES.find((item) => item.key === scope);
          return { key: scope, label: meta?.label || scope };
        }),
        activeTokens: Number(row.active_tokens) || 0,
        authorizedAt: row.created_at,
        updatedAt: row.updated_at,
        lastUsedAt: row.last_used_at || '',
      };
    }),
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

app.get('/api/security/logs', async (c) => {
  const limit = Math.max(1, Math.min(100, Number(c.req.query('limit')) || 50));
  const rows = await c.env.DB.prepare(
    'SELECT * FROM security_logs WHERE user_id = ? ORDER BY occurred_at DESC LIMIT ?',
  )
    .bind(c.get('userRow').id, limit)
    .all();
  return ok(c, {
    logs: rows.results.map((row) => ({
      id: row.id,
      event: row.event,
      detail: row.detail,
      tone: row.tone,
      icon: row.icon,
      occurredAt: row.occurred_at,
    })),
  });
});

app.delete('/api/security/connections/:clientId', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const clientId = decodeURIComponent(c.req.param('clientId') || '').trim();
  if (!clientId) return jsonError(c, 400, 'INVALID_CLIENT', '应用标识无效');

  const client = await db
    .prepare('SELECT name FROM oauth_clients WHERE client_id = ?')
    .bind(clientId)
    .first();
  const consent = await db
    .prepare('SELECT scopes FROM oauth_consents WHERE user_id = ? AND client_id = ?')
    .bind(user.id, clientId)
    .first();
  if (!consent) return jsonError(c, 404, 'NOT_FOUND', '没有找到该应用的授权记录');

  const now = nowIso();
  await db
    .prepare('UPDATE oauth_tokens SET revoked_at = ? WHERE user_id = ? AND client_id = ? AND revoked_at IS NULL')
    .bind(now, user.id, clientId)
    .run();
  await db
    .prepare('DELETE FROM oauth_consents WHERE user_id = ? AND client_id = ?')
    .bind(user.id, clientId)
    .run();

  const name = client?.name || clientId;
  await addSecurityLog(db, user.id, '撤销应用授权', `${name} · 已吊销全部访问令牌`, 'orange', 'i-globe');
  await addActivity(db, user.id, '撤销应用授权', name, 'orange', 'i-globe');
  return ok(c, { ok: true, message: `已撤销「${name}」的授权` });
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

  return ok(c, {
    twoFa: enabled,
    score: 78 + (enabled ? 8 : 0) + (user.phone_verified ? 6 : user.phone ? 3 : 0) + (user.email_verified === 0 ? 0 : 4),
  });
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
  const currentHash = c.get('tokenHash') || '';
  const [devices, logs, sessions] = await Promise.all([
    db.prepare('SELECT * FROM devices WHERE user_id = ? ORDER BY is_current DESC, last_active_at DESC').bind(user.id).all(),
    db
      .prepare('SELECT * FROM security_logs WHERE user_id = ? ORDER BY occurred_at DESC LIMIT 4')
      .bind(user.id)
      .all(),
    db
      .prepare(
        `SELECT rowid AS id, token_hash, created_at, expires_at, ip, location, user_agent
         FROM sessions WHERE user_id = ? AND expires_at > ?
         ORDER BY created_at DESC LIMIT 20`,
      )
      .bind(user.id, nowIso())
      .all(),
  ]);

  return ok(c, {
    devices: devices.results.map(serializeDevice),
    current: devices.results.filter((row) => row.is_current).map(serializeDevice)[0] || null,
    sessions: sessions.results.map((row) => {
      const client = parseUserAgent(row.user_agent);
      return {
        id: row.id,
        current: row.token_hash === currentHash,
        name: client.name,
        browser: client.browser,
        browserName: client.browserName,
        browserVersion: client.browserVersion,
        os: client.os,
        kind: client.kind,
        label: client.label,
        ip: row.ip,
        location: row.location,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      };
    }),
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

app.get('/api/devices/logs', async (c) => {
  const limit = Math.max(1, Math.min(100, Number(c.req.query('limit')) || 50));
  const rows = await c.env.DB.prepare(
    'SELECT * FROM security_logs WHERE user_id = ? ORDER BY occurred_at DESC LIMIT ?',
  )
    .bind(c.get('userRow').id, limit)
    .all();
  return ok(c, {
    logs: rows.results.map((row) => ({
      id: row.id,
      event: row.event,
      detail: row.detail,
      tone: row.tone,
      icon: row.icon,
      occurredAt: row.occurred_at,
    })),
  });
});

app.post('/api/devices/sessions/:id/revoke', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return jsonError(c, 400, 'INVALID_ID', '会话编号无效');
  }

  const row = await db
    .prepare('SELECT rowid AS id, token_hash, user_agent, location FROM sessions WHERE rowid = ? AND user_id = ?')
    .bind(id, user.id)
    .first();
  if (!row) return jsonError(c, 404, 'NOT_FOUND', '该会话已失效');
  if (row.token_hash === c.get('tokenHash')) {
    return jsonError(c, 400, 'CURRENT_SESSION', '当前会话请使用「退出登录」结束');
  }

  await db.prepare('DELETE FROM sessions WHERE rowid = ? AND user_id = ?').bind(id, user.id).run();
  const client = parseUserAgent(row.user_agent);
  await addSecurityLog(db, user.id, '退出远程会话', `${client.label} · ${row.location || '未知位置'}`, 'orange', 'i-device');
  return ok(c, { ok: true, message: '该会话已退出' });
});

app.post('/api/devices', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const body = await readJson(c);
  if (!body) return jsonError(c, 400, 'INVALID_INPUT', '请求内容无法解析');

  const name = String(body.name || '').trim();
  const kind = String(body.kind || 'laptop');
  const os = String(body.os || '').trim() || detectDevice(c);
  if ([...name].length < 2 || [...name].length > 24) {
    return jsonError(c, 400, 'INVALID_NAME', '终端名称需为 2–24 个字符');
  }
  if (!['laptop', 'phone', 'tablet'].includes(kind)) {
    return jsonError(c, 400, 'INVALID_KIND', '未知的终端类型');
  }

  const count = await db.prepare('SELECT COUNT(*) AS count FROM devices WHERE user_id = ?').bind(user.id).first();
  if ((count?.count || 0) >= 20) {
    return jsonError(c, 400, 'DEVICE_LIMIT', '最多只能绑定 20 台星际终端，请先解绑不用的终端');
  }

  const now = nowIso();
  const inserted = await db
    .prepare(
      `INSERT INTO devices (user_id, name, kind, os, ip, location, method, last_active_at, trusted, is_current)
       VALUES (?, ?, ?, ?, ?, ?, '当前终端验证', ?, 1, 0)`,
    )
    .bind(user.id, name, kind, os, clientIp(c), clientLocation(c), now)
    .run();

  await addSecurityLog(db, user.id, '新增星际终端', `${name} · ${clientLocation(c)}`, 'blue', 'i-device');
  await addActivity(db, user.id, '绑定星际终端', `${name} 已加入可信终端`, 'orange', 'i-device');
  await pushNotification(db, user.id, 'type_security', '新终端已绑定', `${name} 已加入你的可信终端列表。`, '/devices');

  const row = await db.prepare('SELECT * FROM devices WHERE id = ?').bind(inserted.meta?.last_row_id).first();
  return ok(c, { device: serializeDevice(row) });
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
  const [prefs, settings, deviceCount, messages, unread] = await Promise.all([
    db.prepare('SELECT key, enabled FROM notification_prefs WHERE user_id = ?').bind(user.id).all(),
    db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').bind(user.id).first(),
    db.prepare('SELECT COUNT(*) AS count FROM devices WHERE user_id = ?').bind(user.id).first(),
    db
      .prepare('SELECT * FROM notification_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 10')
      .bind(user.id)
      .all(),
    db
      .prepare('SELECT COUNT(*) AS count FROM notification_messages WHERE user_id = ? AND read_at IS NULL')
      .bind(user.id)
      .first(),
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
    unread: unread?.count || 0,
    messages: messages.results.map((row) => ({
      id: row.id,
      category: row.category,
      title: row.title,
      body: row.body,
      link: row.link,
      read: Boolean(row.read_at),
      createdAt: row.created_at,
    })),
  });
});

app.get('/api/notifications/messages', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const limit = Math.max(1, Math.min(100, Number(c.req.query('limit')) || 30));
  const onlyUnread = c.req.query('unread') === '1';
  const rows = await db
    .prepare(
      `SELECT * FROM notification_messages WHERE user_id = ? ${onlyUnread ? 'AND read_at IS NULL' : ''}
       ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(user.id, limit)
    .all();
  return ok(c, {
    messages: rows.results.map((row) => ({
      id: row.id,
      category: row.category,
      title: row.title,
      body: row.body,
      link: row.link,
      read: Boolean(row.read_at),
      createdAt: row.created_at,
    })),
  });
});

app.post('/api/notifications/messages/:id/read', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const id = Number(c.req.param('id'));
  const result = await db
    .prepare('UPDATE notification_messages SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?')
    .bind(nowIso(), id, user.id)
    .run();
  if (!result.meta?.changes) return jsonError(c, 404, 'NOT_FOUND', '未找到该通知');
  return ok(c, { ok: true });
});

app.post('/api/notifications/messages/read-all', async (c) => {
  const result = await c.env.DB.prepare(
    'UPDATE notification_messages SET read_at = ? WHERE user_id = ? AND read_at IS NULL',
  )
    .bind(nowIso(), c.get('userRow').id)
    .run();
  return ok(c, { ok: true, updated: result.meta?.changes || 0 });
});

app.delete('/api/notifications/messages/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const result = await c.env.DB.prepare('DELETE FROM notification_messages WHERE id = ? AND user_id = ?')
    .bind(id, c.get('userRow').id)
    .run();
  if (!result.meta?.changes) return jsonError(c, 404, 'NOT_FOUND', '未找到该通知');
  return ok(c, { ok: true });
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
    rules: [
      { title: '等级如何计算', text: '会员等级由累计 INU 粒子决定：星尘 0、行星 10,000、恒星 50,000、星系 200,000。等级只升不降，粒子消费不会导致降级。' },
      { title: '粒子如何获得', text: '签署协议、兑换补给、参与星际活动都会获得粒子。补给消费按 100 星能返 5 粒子计算，签署协议奖励以协议配置为准。' },
      { title: '会员折扣', text: '补给站结算时自动应用当前等级折扣，页面展示的会员价即最终星能价格。' },
      { title: '有效期', text: '粒子自获得之日起 12 个月内有效，过期后按 100:1 自动折算为星能，折算结果会写入钱包流水。' },
    ],
  });
});

app.get('/api/member/particles', async (c) => {
  const limit = Math.max(1, Math.min(200, Number(c.req.query('limit')) || 100));
  const rows = await c.env.DB.prepare(
    'SELECT * FROM particle_logs WHERE user_id = ? ORDER BY occurred_at DESC LIMIT ?',
  )
    .bind(c.get('userRow').id, limit)
    .all();
  return ok(c, {
    logs: rows.results.map((row) => ({
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
  await ensureAgreementsForUser(db, user.id);

  const rows = await db
    .prepare(
      `SELECT a.*, t.content AS template_content, t.reward AS template_reward, t.active AS template_active
       FROM agreements a LEFT JOIN agreement_templates t ON t.id = a.template_id
       WHERE a.user_id = ? ORDER BY a.sort ASC, a.id ASC`,
    )
    .bind(user.id)
    .all();

  const items = rows.results.map((row) => ({
    id: row.id,
    title: row.title,
    version: row.version,
    status: row.status,
    signedAt: row.signed_at,
    reward: row.template_reward ?? row.reward ?? 50,
    hasContent: Boolean(row.template_content || row.content),
    active: row.template_active === undefined || row.template_active === null ? true : Boolean(row.template_active),
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

app.get('/api/agreements/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const id = Number(c.req.param('id'));
  const row = await db
    .prepare(
      `SELECT a.*, t.content AS template_content, t.reward AS template_reward, t.active AS template_active
       FROM agreements a LEFT JOIN agreement_templates t ON t.id = a.template_id
       WHERE a.id = ? AND a.user_id = ?`,
    )
    .bind(id, user.id)
    .first();
  if (!row) return jsonError(c, 404, 'NOT_FOUND', '未找到该协议');

  return ok(c, {
    item: {
      id: row.id,
      title: row.title,
      version: row.version,
      status: row.status,
      signedAt: row.signed_at,
      reward: row.template_reward ?? row.reward ?? 50,
      active: row.template_active === undefined || row.template_active === null ? true : Boolean(row.template_active),
      content: row.template_content || row.content || '协议正文正在归档中，请稍后再试。',
    },
  });
});

app.get('/api/agreements/:id/export', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const id = Number(c.req.param('id'));
  const row = await db
    .prepare(
      `SELECT a.*, t.content AS template_content FROM agreements a
       LEFT JOIN agreement_templates t ON t.id = a.template_id
       WHERE a.id = ? AND a.user_id = ?`,
    )
    .bind(id, user.id)
    .first();
  if (!row) return jsonError(c, 404, 'NOT_FOUND', '未找到该协议');

  const content = row.template_content || row.content || '协议正文正在归档中。';
  const body = [
    `# ${row.title}`,
    '',
    `- 版本：${row.version}`,
    `- 签署状态：${row.status === 'signed' ? '已签署' : '待签署'}`,
    `- 签署时间：${row.signed_at || '—'}`,
    `- 星际 ID：${user.inu_id}`,
    `- 导出时间：${nowIso()}`,
    '',
    '---',
    '',
    content,
    '',
    '---',
    '',
    '本文件由 INU 星际通行证生成，签署记录可在协议中心查询。',
  ].join('\n');

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="inu-agreement-${row.id}.md"`,
      'Cache-Control': 'no-store',
    },
  });
});

app.post('/api/agreements/:id/sign', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const settings = await siteSettings(c);
  if (!settings.featureAgreements) {
    return jsonError(c, 503, 'FEATURE_DISABLED', '协议签署功能暂未开放');
  }
  const id = Number(c.req.param('id'));
  const agreement = await db
    .prepare(
      `SELECT a.*, t.content AS template_content, t.reward AS template_reward, t.active AS template_active
       FROM agreements a LEFT JOIN agreement_templates t ON t.id = a.template_id
       WHERE a.id = ? AND a.user_id = ?`,
    )
    .bind(id, user.id)
    .first();

  if (!agreement) return jsonError(c, 404, 'NOT_FOUND', '未找到该协议');
  if (agreement.status === 'signed') {
    return jsonError(c, 409, 'ALREADY_SIGNED', '该协议已签署，无需重复操作');
  }
  if (agreement.template_active === 0) {
    return jsonError(c, 400, 'AGREEMENT_INACTIVE', '该协议已下线，无法继续签署');
  }

  const reward = Number(agreement.template_reward ?? agreement.reward ?? 50);
  const signedAt = nowIso();
  const particles = user.particles + reward;

  await db
    .prepare("UPDATE agreements SET status = 'signed', signed_at = ? WHERE id = ?")
    .bind(signedAt, id)
    .run();
  await db.prepare('UPDATE users SET particles = ? WHERE id = ?').bind(particles, user.id).run();
  await db
    .prepare(
      'INSERT INTO particle_logs (user_id, label, delta, balance, occurred_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(user.id, `签署《${agreement.title}》`, reward, particles, signedAt)
    .run();
  await addActivity(db, user.id, `签署《${agreement.title}》`, `协议版本 ${agreement.version}`, 'purple', 'i-file');
  await pushNotification(
    db,
    user.id,
    'type_member',
    '协议签署完成',
    `《${agreement.title}》已归档，获得 ${reward} INU 粒子。`,
    '/agreements',
  );

  return ok(c, {
    item: {
      id: agreement.id,
      title: agreement.title,
      version: agreement.version,
      status: 'signed',
      signedAt,
    },
    particles,
    reward,
  });
});

/* ------------------------------------------------------------------ */
/* 星际补给站                                                           */
/* ------------------------------------------------------------------ */

function serializeOrder(row) {
  let address = null;
  if (row.address) {
    try {
      address = JSON.parse(row.address);
    } catch {
      address = null;
    }
  }
  return {
    id: row.id,
    code: row.code,
    productId: row.product_id,
    item: row.item,
    energyCents: row.energy_cents,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    paidAt: row.paid_at || null,
    deliveredAt: row.delivered_at || null,
    cancelledAt: row.cancelled_at || null,
    trackingNo: row.tracking_no || '',
    carrier: row.carrier || '',
    address,
    canPay: row.status === 'pending_payment',
    canCancel: row.status === 'pending_payment',
    canConfirm: row.status === 'transit',
  };
}

async function createSupplyOrderFor(c, user, product) {
  const db = c.env.DB;
  const settings = await siteSettings(c);
  if (!settings.featureSupply) {
    return { error: jsonError(c, 503, 'FEATURE_DISABLED', '星际补给站暂未开放') };
  }
  if (!user.verified) {
    return { error: jsonError(c, 403, 'VERIFY_REQUIRED', '完成星际公民认证后才可下单') };
  }
  if (Number(product.stock) === 0) {
    return { error: jsonError(c, 400, 'OUT_OF_STOCK', '该补给物资已售罄') };
  }

  const address = await db.prepare('SELECT * FROM addresses WHERE user_id = ?').bind(user.id).first();
  if (!address) {
    return { error: jsonError(c, 400, 'ADDRESS_REQUIRED', '请先填写收货坐标后再兑换补给') };
  }

  const tier = tierOf(user);
  const price = Math.round(product.priceCents * (tier.rate || 0.95));
  if (user.star_energy_cents < price) {
    return { error: jsonError(c, 400, 'INSUFFICIENT_FUNDS', '星能余额不足，请先补充星能') };
  }

  const now = new Date(Date.now() + 8 * 3600 * 1000);
  const stamp = `${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  const suffix = String(Math.floor(Math.random() * 9000) + 1000);
  const code = `INU-${stamp}-${suffix}`;
  const createdAt = nowIso();
  const reward = Math.floor((price / 10000) * 5);
  const balance = user.star_energy_cents - price;
  const particles = user.particles + reward;
  const trackingNo = `INU-EXP-${randomDigits(10)}`;
  const snapshot = JSON.stringify({
    receiver: address.receiver,
    phone: address.phone,
    region: address.region,
    detail: address.detail,
    updatedAt: address.updated_at,
  });

  const inserted = await db
    .prepare(
      `INSERT INTO orders
         (user_id, code, product_id, item, energy_cents, status, created_at, address, tracking_no, carrier, updated_at, paid_at)
       VALUES (?, ?, ?, ?, ?, 'transit', ?, ?, ?, '星际快递', ?, ?)`,
    )
    .bind(user.id, code, product.id, `${product.name} ×1`, price, createdAt, snapshot, trackingNo, createdAt, createdAt)
    .run();

  await db
    .prepare('UPDATE users SET star_energy_cents = ?, particles = ? WHERE id = ?')
    .bind(balance, particles, user.id)
    .run();

  if (typeof product.stock === 'number' && product.stock > 0) {
    await db.prepare('UPDATE products SET stock = stock - 1 WHERE id = ? AND stock > 0').bind(product.id).run();
  }

  await addWalletTransaction(db, user.id, {
    kind: 'supply',
    title: `兑换${product.name}`,
    detail: `订单 ${code}`,
    amountCents: -price,
    balanceAfter: balance,
    ref: code,
    createdAt,
  });
  await db
    .prepare('INSERT INTO particle_logs (user_id, label, delta, balance, occurred_at) VALUES (?, ?, ?, ?, ?)')
    .bind(user.id, `兑换${product.name}`, reward, particles, createdAt)
    .run();
  await addActivity(db, user.id, '兑换星际补给', `${product.name} · 消耗 ${(price / 100).toFixed(2)} 星能`, 'blue', 'i-box');
  await pushNotification(
    db,
    user.id,
    'type_supply',
    '补给已进入跃迁队列',
    `${product.name} 已支付，订单 ${code} 预计 1–3 个星际日送达。`,
    '/supply',
  );

  const row = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(inserted.meta?.last_row_id).first();
  return {
    order: serializeOrder(row),
    balanceCents: balance,
    particles,
    reward,
  };
}

app.get('/api/supply', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const tier = tierOf(user);
  const [orders, address, transit, monthly, productList] = await Promise.all([
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
    listProducts(db),
  ]);
  const settings = await siteSettings(c);

  return ok(c, {
    user: await serializeUserFor(c, user),
    wallet: { balanceCents: user.star_energy_cents, cardLast4: settings.walletCardLast4 },
    counts: {
      transit: transit?.count || 0,
      monthOrders: monthly?.count || 0,
      monthSpendCents: monthly?.spend || 0,
    },
    orders: orders.results.map(serializeOrder),
    address: address
      ? {
          receiver: address.receiver,
          phone: address.phone,
          region: address.region,
          detail: address.detail,
          updatedAt: address.updated_at,
        }
      : null,
    products: productList.map((item) => ({
      ...item,
      memberPriceCents: Math.round(item.priceCents * (tier.rate || 0.95)),
    })),
    tips: SUPPLY_TIPS,
    discountLabel: tier.discount,
    verified: Boolean(user.verified),
    supportEmail: settings.supportEmail,
    featureEnabled: settings.featureSupply,
  });
});

app.get('/api/supply/orders', async (c) => {
  const limit = Math.max(1, Math.min(100, Number(c.req.query('limit')) || 50));
  const rows = await c.env.DB.prepare(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
  )
    .bind(c.get('userRow').id, limit)
    .all();
  return ok(c, { orders: rows.results.map(serializeOrder) });
});

app.get('/api/supply/orders/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const row = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .bind(id, c.get('userRow').id)
    .first();
  if (!row) return jsonError(c, 404, 'NOT_FOUND', '未找到该补给订单');

  const timeline = [{ at: row.created_at, title: '订单创建', detail: '补给订单已提交' }];
  if (row.paid_at) timeline.push({ at: row.paid_at, title: '星能支付完成', detail: `${(row.energy_cents / 100).toFixed(2)} 星能已扣除` });
  if (row.tracking_no) timeline.push({ at: row.updated_at || row.created_at, title: '已交付星际快递', detail: `运单号 ${row.tracking_no}` });
  if (row.status === 'delivered' && row.delivered_at) timeline.push({ at: row.delivered_at, title: '补给已送达', detail: '订单已完成' });
  if (row.status === 'cancelled') timeline.push({ at: row.cancelled_at || row.updated_at, title: '订单已取消', detail: '星能未扣除或已退回' });

  return ok(c, { order: { ...serializeOrder(row), timeline } });
});


app.post('/api/supply/orders', async (c) => {
  const user = c.get('userRow');
  const body = await readJson(c);
  const products = await listProducts(c.env.DB);
  const product = products.find((item) => item.id === body?.productId);
  if (!product) return jsonError(c, 404, 'NOT_FOUND', '该补给物资已离开货架');

  const result = await createSupplyOrderFor(c, user, product);
  if (result.error) return result.error;
  return ok(c, result);
});

app.post('/api/supply/orders/:id/rebuy', async (c) => {
  const user = c.get('userRow');
  const id = Number(c.req.param('id'));
  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first();
  if (!order) return jsonError(c, 404, 'NOT_FOUND', '未找到该补给订单');

  const products = await listProducts(c.env.DB);
  const product = products.find((item) => item.id === order.product_id);
  if (!product) return jsonError(c, 404, 'NOT_FOUND', '该补给物资已下架');

  const result = await createSupplyOrderFor(c, user, product);
  if (result.error) return result.error;
  return ok(c, { ...result, message: '已按原订单重新下单' });
});

app.post('/api/supply/orders/:id/pay', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const id = Number(c.req.param('id'));
  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first();
  if (!order) return jsonError(c, 404, 'NOT_FOUND', '未找到该补给订单');
  if (order.status !== 'pending_payment') {
    return jsonError(c, 409, 'INVALID_STATUS', '该订单当前无需支付');
  }
  if (user.star_energy_cents < order.energy_cents) {
    return jsonError(c, 400, 'INSUFFICIENT_FUNDS', '星能余额不足，请先补充星能');
  }
  const address = await db.prepare('SELECT * FROM addresses WHERE user_id = ?').bind(user.id).first();
  if (!address) return jsonError(c, 400, 'ADDRESS_REQUIRED', '请先填写收货坐标后再支付');

  const balance = user.star_energy_cents - order.energy_cents;
  const paidAt = nowIso();
  const trackingNo = order.tracking_no || `INU-EXP-${randomDigits(10)}`;
  await db
    .prepare(
      `UPDATE orders SET status = 'transit', paid_at = ?, updated_at = ?, tracking_no = ?, carrier = '星际快递', address = ?
       WHERE id = ?`,
    )
    .bind(
      paidAt,
      paidAt,
      trackingNo,
      JSON.stringify({
        receiver: address.receiver,
        phone: address.phone,
        region: address.region,
        detail: address.detail,
        updatedAt: address.updated_at,
      }),
      id,
    )
    .run();
  await db.prepare('UPDATE users SET star_energy_cents = ? WHERE id = ?').bind(balance, user.id).run();
  await addWalletTransaction(db, user.id, {
    kind: 'supply',
    title: `支付${order.item}`,
    detail: `订单 ${order.code}`,
    amountCents: -order.energy_cents,
    balanceAfter: balance,
    ref: order.code,
  });
  await addActivity(db, user.id, '补给订单已支付', `${order.item} · ${(order.energy_cents / 100).toFixed(2)} 星能`, 'blue', 'i-box');
  await pushNotification(db, user.id, 'type_supply', '补给已进入跃迁队列', `订单 ${order.code} 已支付，预计 1–3 个星际日送达。`, '/supply');

  const updated = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  return ok(c, { order: serializeOrder(updated), balanceCents: balance });
});

app.post('/api/supply/orders/:id/cancel', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const id = Number(c.req.param('id'));
  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first();
  if (!order) return jsonError(c, 404, 'NOT_FOUND', '未找到该补给订单');
  if (order.status !== 'pending_payment') {
    return jsonError(c, 409, 'INVALID_STATUS', '只有待支付订单可以取消');
  }

  const cancelledAt = nowIso();
  await db
    .prepare("UPDATE orders SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?")
    .bind(cancelledAt, cancelledAt, id)
    .run();
  await addActivity(db, user.id, '取消补给订单', order.code, 'orange', 'i-box');
  const updated = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  return ok(c, { order: serializeOrder(updated) });
});

app.post('/api/supply/orders/:id/confirm', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const id = Number(c.req.param('id'));
  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first();
  if (!order) return jsonError(c, 404, 'NOT_FOUND', '未找到该补给订单');
  if (order.status !== 'transit') {
    return jsonError(c, 409, 'INVALID_STATUS', '该订单当前无法确认收货');
  }

  const deliveredAt = nowIso();
  await db
    .prepare("UPDATE orders SET status = 'delivered', delivered_at = ?, updated_at = ? WHERE id = ?")
    .bind(deliveredAt, deliveredAt, id)
    .run();
  await addActivity(db, user.id, '补给已签收', order.item, 'green', 'i-check');
  const updated = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  return ok(c, { order: serializeOrder(updated) });
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
/* 星际钱包                                                             */
/* ------------------------------------------------------------------ */

function walletMethodLabel(method) {
  return { inu_pay: 'INU PAY', alipay: '支付宝', wechat: '微信支付' }[method] || '星际支付';
}

async function settleRecharge(c, user, order) {
  const db = c.env.DB;
  if (order.status !== 'pending') {
    return { error: jsonError(c, 409, 'INVALID_STATUS', order.status === 'paid' ? '该充值订单已到账' : '该订单已关闭') };
  }
  const balance = user.star_energy_cents + order.amount_cents;
  const paidAt = nowIso();
  await db.prepare("UPDATE recharge_orders SET status = 'paid', paid_at = ? WHERE id = ?").bind(paidAt, order.id).run();
  await db.prepare('UPDATE users SET star_energy_cents = ? WHERE id = ?').bind(balance, user.id).run();
  await addWalletTransaction(db, user.id, {
    kind: 'recharge',
    title: '星能充值到账',
    detail: `${walletMethodLabel(order.method)} · ${order.code}`,
    amountCents: order.amount_cents,
    balanceAfter: balance,
    ref: order.code,
    createdAt: paidAt,
  });
  await addActivity(db, user.id, '星能充值到账', `+${(order.amount_cents / 100).toFixed(2)} 星能 · ${walletMethodLabel(order.method)}`, 'blue', 'i-spark');
  await pushNotification(
    db,
    user.id,
    'type_energy',
    '星能充值到账',
    `+${(order.amount_cents / 100).toFixed(2)} 星能已存入星际钱包。`,
    '/wallet',
  );
  return { balance, paidAt };
}

app.get('/api/wallet', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const settings = await siteSettings(c);
  const [transactions, recharges, withdrawals] = await Promise.all([
    db
      .prepare('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 30')
      .bind(user.id)
      .all(),
    db
      .prepare('SELECT * FROM recharge_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10')
      .bind(user.id)
      .all(),
    db
      .prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 10')
      .bind(user.id)
      .all(),
  ]);

  return ok(c, {
    balanceCents: user.star_energy_cents,
    cardLast4: settings.walletCardLast4,
    presets: settings.rechargePresets,
    withdrawMinCents: settings.withdrawMinCents,
    paymentMode: settings.paymentMode,
    features: {
      recharge: settings.featureRecharge,
      withdraw: settings.featureWithdraw,
    },
    verified: Boolean(user.verified),
    phone: user.phone || '',
    transactions: transactions.results.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      detail: row.detail,
      amountCents: row.amount_cents,
      balanceAfter: row.balance_after,
      ref: row.ref,
      createdAt: row.created_at,
    })),
    recharges: recharges.results.map((row) => ({
      id: row.id,
      code: row.code,
      amountCents: row.amount_cents,
      method: row.method,
      status: row.status,
      createdAt: row.created_at,
      paidAt: row.paid_at,
    })),
    withdrawals: withdrawals.results.map((row) => ({
      id: row.id,
      code: row.code,
      amountCents: row.amount_cents,
      account: row.account,
      status: row.status,
      note: row.note,
      createdAt: row.created_at,
      processedAt: row.processed_at,
    })),
  });
});

app.post('/api/wallet/recharge', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const settings = await siteSettings(c);
  if (!settings.featureRecharge) {
    return jsonError(c, 503, 'FEATURE_DISABLED', '星能充值暂未开放');
  }
  if (settings.paymentMode === 'off') {
    return jsonError(c, 503, 'PAYMENT_UNAVAILABLE', '支付通道正在接入星际网络，请稍后再试');
  }

  const body = await readJson(c);
  const amountCents = Math.round(Number(body?.amountCents));
  const method = String(body?.method || 'inu_pay');
  if (!Number.isFinite(amountCents) || amountCents < 1000 || amountCents > 5000000) {
    return jsonError(c, 400, 'INVALID_AMOUNT', '充值金额需在 10–50000 星能之间');
  }
  if (!['inu_pay', 'alipay', 'wechat'].includes(method)) {
    return jsonError(c, 400, 'INVALID_METHOD', '未知的支付方式');
  }

  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const code = `RC-${stamp}-${randomDigits(4)}`;
  const createdAt = nowIso();
  const inserted = await db
    .prepare(
      "INSERT INTO recharge_orders (user_id, code, amount_cents, method, status, created_at, paid_at) VALUES (?, ?, ?, ?, 'pending', ?, NULL)",
    )
    .bind(user.id, code, amountCents, method, createdAt)
    .run();

  let order = await db.prepare('SELECT * FROM recharge_orders WHERE id = ?').bind(inserted.meta?.last_row_id).first();
  let balance = user.star_energy_cents;
  let paid = false;

  if (settings.paymentMode === 'mock') {
    const result = await settleRecharge(c, user, order);
    if (result.error) return result.error;
    balance = result.balance;
    paid = true;
    order = await db.prepare('SELECT * FROM recharge_orders WHERE id = ?').bind(order.id).first();
  }

  return ok(c, {
    order: {
      id: order.id,
      code: order.code,
      amountCents: order.amount_cents,
      method: order.method,
      status: order.status,
      createdAt: order.created_at,
      paidAt: order.paid_at,
    },
    paid,
    balanceCents: balance,
    message: paid ? '充值已到账' : '充值订单已创建，请完成支付',
  });
});

app.post('/api/wallet/recharge/:id/pay', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const settings = await siteSettings(c);
  if (settings.paymentMode === 'off') {
    return jsonError(c, 503, 'PAYMENT_UNAVAILABLE', '支付通道正在接入星际网络，请稍后再试');
  }
  const id = Number(c.req.param('id'));
  const order = await db.prepare('SELECT * FROM recharge_orders WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first();
  if (!order) return jsonError(c, 404, 'NOT_FOUND', '未找到该充值订单');

  const result = await settleRecharge(c, user, order);
  if (result.error) return result.error;
  const updated = await db.prepare('SELECT * FROM recharge_orders WHERE id = ?').bind(id).first();
  return ok(c, {
    order: {
      id: updated.id,
      code: updated.code,
      amountCents: updated.amount_cents,
      method: updated.method,
      status: updated.status,
      paidAt: updated.paid_at,
    },
    paid: true,
    balanceCents: result.balance,
  });
});

app.post('/api/wallet/recharge/:id/cancel', async (c) => {
  const id = Number(c.req.param('id'));
  const order = await c.env.DB.prepare('SELECT * FROM recharge_orders WHERE id = ? AND user_id = ?')
    .bind(id, c.get('userRow').id)
    .first();
  if (!order) return jsonError(c, 404, 'NOT_FOUND', '未找到该充值订单');
  if (order.status !== 'pending') return jsonError(c, 409, 'INVALID_STATUS', '该订单无法取消');
  await c.env.DB.prepare("UPDATE recharge_orders SET status = 'cancelled' WHERE id = ?").bind(id).run();
  return ok(c, { ok: true });
});

app.post('/api/wallet/withdraw', async (c) => {
  const db = c.env.DB;
  const user = c.get('userRow');
  const settings = await siteSettings(c);
  if (!settings.featureWithdraw) {
    return jsonError(c, 503, 'FEATURE_DISABLED', '星能提现已关闭，请联系管理员');
  }
  if (!user.verified) {
    return jsonError(c, 403, 'VERIFY_REQUIRED', '完成星际公民认证后才可提现');
  }
  if (!user.phone) {
    return jsonError(c, 400, 'PHONE_REQUIRED', '请先绑定手机号后再申请提现');
  }

  const body = await readJson(c);
  const amountCents = Math.round(Number(body?.amountCents));
  const account = String(body?.account || '').trim();
  if (!Number.isFinite(amountCents) || amountCents < settings.withdrawMinCents) {
    return jsonError(c, 400, 'INVALID_AMOUNT', `单次提现至少 ${(settings.withdrawMinCents / 100).toFixed(0)} 星能`);
  }
  if (amountCents > user.star_energy_cents) {
    return jsonError(c, 400, 'INSUFFICIENT_FUNDS', '星能余额不足');
  }
  if ([...account].length < 4 || [...account].length > 80) {
    return jsonError(c, 400, 'INVALID_ACCOUNT', '请填写有效的收款账号');
  }

  const balance = user.star_energy_cents - amountCents;
  const createdAt = nowIso();
  const code = `WD-${createdAt.replace(/\D/g, '').slice(0, 14)}-${randomDigits(4)}`;
  await db.prepare('UPDATE users SET star_energy_cents = ? WHERE id = ?').bind(balance, user.id).run();
  const inserted = await db
    .prepare(
      "INSERT INTO withdrawals (user_id, code, amount_cents, account, status, note, created_at, processed_at, processed_by) VALUES (?, ?, ?, ?, 'processing', '', ?, NULL, NULL)",
    )
    .bind(user.id, code, amountCents, account, createdAt)
    .run();
  await addWalletTransaction(db, user.id, {
    kind: 'withdraw',
    title: '星能提现申请',
    detail: `${code} · 等待复核`,
    amountCents: -amountCents,
    balanceAfter: balance,
    ref: code,
    createdAt,
  });
  await addSecurityLog(db, user.id, '提交提现申请', `${(amountCents / 100).toFixed(2)} 星能 · ${code}`, 'blue', 'i-wallet');
  await pushNotification(db, user.id, 'type_energy', '提现申请已提交', `${(amountCents / 100).toFixed(2)} 星能提现已进入人工复核。`, '/wallet');

  return ok(c, {
    withdrawal: {
      id: inserted.meta?.last_row_id,
      code,
      amountCents,
      account,
      status: 'processing',
      createdAt,
    },
    balanceCents: balance,
  });
});


/* ------------------------------------------------------------------ */
/* 静态资源与错误处理                                                   */
/* ------------------------------------------------------------------ */

app.get('/inu-oauth-integration.md', async (c) => {
  const asset = await c.env.ASSETS.fetch(c.req.raw);
  const headers = new Headers(asset.headers);
  headers.set('Content-Type', 'text/markdown; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=300');
  return new Response(asset.body, { status: asset.status, headers });
});

app.notFound((c) => {
  if (
    c.req.path.startsWith('/api/') ||
    c.req.path.startsWith('/oauth/') ||
    c.req.path.startsWith('/.well-known/')
  ) {
    return c.json({ error: { code: 'NOT_FOUND', message: '接口不存在' } }, 404, {
      ...CORS_HEADERS,
      'Cache-Control': 'no-store',
    });
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((error, c) => {
  console.error('worker error', error);
  if (
    c.req.path.startsWith('/api/') ||
    c.req.path.startsWith('/oauth/') ||
    c.req.path.startsWith('/.well-known/')
  ) {
    return c.json(
      { error: { code: 'INTERNAL', message: '星际网络暂时波动，请稍后重试' } },
      500,
      { ...CORS_HEADERS, 'Cache-Control': 'no-store' },
    );
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;

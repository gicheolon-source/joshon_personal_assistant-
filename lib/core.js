/* 공용: 저장소(Upstash Redis), 로그인 쿠키, 요청 파싱 */
import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';

let redis;
/* KV_REST_API_URL / KV_REST_API_TOKEN (Vercel Upstash 연동이 자동 주입). 로컬 개발에선 메모리 저장소 */
export const kv = () => (redis ||= (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) ? Redis.fromEnv() : memKv());
function memKv() {
  const m = new Map();
  return {
    async get(k) { return m.get(k) ?? null; },
    async set(k, v, o = {}) { if (o.nx && m.has(k)) return null; m.set(k, v); return 'OK'; },
    async del(k) { m.delete(k); },
    async hgetall(k) { return Object.fromEntries(m.get(k) || []); }, async hget(k, f) { return (m.get(k) || new Map()).get(f) ?? null; },
    async hset(k, o) { const h = m.get(k) || new Map(); for (const [f, v] of Object.entries(o)) h.set(f, v); m.set(k, h); },
    async hdel(k, f) { (m.get(k) || new Map()).delete(f); },
  };
}

/* ── 데이터 ── */
export async function getBrief() { return (await kv().get('brief:latest')) || null; }
export async function setBrief(b) { await kv().set('brief:latest', b); }
export async function getTodos() {
  const h = (await kv().hgetall('todos')) || {};
  return Object.entries(h).map(([id, v]) => ({ id, ...(typeof v === 'string' ? JSON.parse(v) : v) }));
}
export async function getTodo(id) { const v = await kv().hget('todos', id); return v ? (typeof v === 'string' ? JSON.parse(v) : v) : null; }
export async function putTodo(id, t) { await kv().hset('todos', { [id]: JSON.stringify(t) }); }
export async function delTodo(id) { await kv().hdel('todos', id); }
export async function getFlex() {
  const h = (await kv().hgetall('flex')) || {};
  return Object.entries(h).map(([id, v]) => ({ id, ...(typeof v === 'string' ? JSON.parse(v) : v) }));
}
export async function putFlexMany(map) { if (Object.keys(map).length) await kv().hset('flex', Object.fromEntries(Object.entries(map).map(([k, v]) => [k, JSON.stringify(v)]))); }
export async function delFlex(id) { await kv().hdel('flex', id); }
/* Jarvis 기억: 취향·규칙 메모 (hash 'memory', 최대 50개) */
export async function getMemory() {
  const h = (await kv().hgetall('memory')) || {};
  return Object.entries(h).map(([id, v]) => ({ id, ...(typeof v === 'string' ? JSON.parse(v) : v) })).sort((a, b) => String(a.at).localeCompare(String(b.at)));
}
export async function addMemory(text) {
  const t = String(text || '').trim().slice(0, 300); if (!t) throw new Error('내용이 비어 있어요');
  const cur = await getMemory(); if (cur.length >= 50) throw new Error('기억이 50개로 가득 찼어요. 오래된 걸 먼저 지워 주세요');
  const id = 'mem-' + Date.now().toString(36);
  await kv().hset('memory', { [id]: JSON.stringify({ text: t, at: new Date().toISOString() }) });
  return id;
}
export async function delMemory(id) { await kv().hdel('memory', String(id)); }
export const PRIOS = ['high', 'mid', 'low'];
export function newTodo({ title, priority, due, source, note, sourceUrl }) {
  const t = { title: String(title || '').trim().slice(0, 200), priority: PRIOS.includes(priority) ? priority : 'mid',
    source: source || 'manual', done: false, createdAt: new Date().toISOString() };
  if (due && /^\d{4}-\d{2}-\d{2}$/.test(due)) t.due = due;
  if (note) t.note = String(note).slice(0, 200);
  if (sourceUrl && /^https:\/\//.test(sourceUrl)) t.sourceUrl = sourceUrl;
  return t;
}
export const mkId = () => 'm-' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex');

/* ── 로그인: HMAC 서명 쿠키 (30일) ── */
const COOKIE = 'jd_session';
const sign = v => crypto.createHmac('sha256', process.env.DESK_SECRET || '').update(v).digest('base64url');
export function sessionCookie() {
  const exp = String(Date.now() + 30 * 864e5);
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 86400}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
export function authed(req) {
  if (!process.env.DESK_SECRET) return false;
  const m = String(req.headers.cookie || '').match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

/* ── 요청 ── */
export async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = ''; for await (const c of req) raw += c;
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
export function json(res, code, data) { res.statusCode = code; res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(data)); }
export function guard(req, res) { if (authed(req)) return true; json(res, 401, { error: 'login_required' }); return false; }

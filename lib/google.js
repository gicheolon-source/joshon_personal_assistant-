/* 구글 연결: 로그인 + Gmail(읽기·초안) · 캘린더(읽기·응답) · 드라이브(읽기)
   refresh token 은 Redis 'google:token' 에 AES-256-GCM 암호화(키 = sha256(DESK_SECRET))로 저장
   env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ALLOWED_EMAILS */
import crypto from 'node:crypto';
import { kv } from './core.js';

export const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/drive.readonly'];
export const redirectUri = req => `https://${req.headers['x-forwarded-host'] || req.headers.host}/api/google?action=callback`;
export const allowedEmails = () => String(process.env.ALLOWED_EMAILS || 'gicheol.on@neosimplix.com').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

const key = () => crypto.createHash('sha256').update('google:' + (process.env.DESK_SECRET || '')).digest();
function enc(obj) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key(), iv); const d = Buffer.concat([c.update(JSON.stringify(obj)), c.final()]); return [iv, c.getAuthTag(), d].map(b => b.toString('base64url')).join('.'); }
function dec(s) { const [iv, tag, d] = String(s).split('.').map(x => Buffer.from(x, 'base64url')); const c = crypto.createDecipheriv('aes-256-gcm', key(), iv); c.setAuthTag(tag); return JSON.parse(Buffer.concat([c.update(d), c.final()]).toString()); }

export function authUrl(req, state) {
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(req), response_type: 'code', scope: SCOPES.join(' '),
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state, hd: 'neosimplix.com', login_hint: allowedEmails()[0] || '',
  });
}
export async function exchangeCode(req, code) {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri(req), grant_type: 'authorization_code' }) });
  const t = await r.json(); if (!r.ok) throw new Error('token ' + (t.error_description || t.error || r.status));
  const info = await (await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(t.id_token))).json();
  if (info.aud !== process.env.GOOGLE_CLIENT_ID || String(info.email_verified) !== 'true') throw new Error('id_token invalid');
  return { tokens: t, email: String(info.email).toLowerCase() };
}
export async function saveGoogle({ tokens, email }) {
  const prev = await loadGoogle();
  const refresh = tokens.refresh_token || prev?.refresh_token;
  if (!refresh) throw new Error('refresh_token 없음 — 다시 연결해 주세요');
  await kv().set('google:token', enc({ refresh_token: refresh, email, scope: tokens.scope, at: new Date().toISOString() }));
  accessCache = { token: tokens.access_token, exp: Date.now() + (tokens.expires_in - 60) * 1000 };
}
export async function loadGoogle() { const s = await kv().get('google:token'); if (!s) return null; try { return dec(s); } catch { return null; } }
export async function googleStatus() { const g = await loadGoogle(); return g ? { connected: true, email: g.email, scope: g.scope, at: g.at } : { connected: false }; }
export async function disconnectGoogle() { await kv().del('google:token'); accessCache = null; }

let accessCache = null;
async function accessToken() {
  if (accessCache && accessCache.exp > Date.now()) return accessCache.token;
  const g = await loadGoogle(); if (!g) throw Object.assign(new Error('구글이 연결되지 않았어요'), { code: 'google_not_connected' });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: g.refresh_token, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token' }) });
  const t = await r.json(); if (!r.ok) throw Object.assign(new Error('구글 인증 만료 — 다시 연결해 주세요 (' + (t.error || r.status) + ')'), { code: 'google_expired' });
  accessCache = { token: t.access_token, exp: Date.now() + (t.expires_in - 60) * 1000 };
  return accessCache.token;
}
async function gfetch(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { authorization: 'Bearer ' + await accessToken(), ...(opts.headers || {}) } });
  if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`google ${r.status} ${url.split('?')[0].split('/').slice(-2).join('/')} ${t.slice(0, 200)}`); }
  return r;
}
const G = 'https://gmail.googleapis.com/gmail/v1/users/me';
const hdr = (m, n) => (m.payload?.headers || []).find(h => h.name.toLowerCase() === n.toLowerCase())?.value || '';
const viewUrl = id => { try { return `https://mail.google.com/mail/?authuser=${allowedEmails()[0]}#all/thread-f:${BigInt('0x' + id)}`; } catch { return null; } };

/* Gmail 검색 → search_threads(MCP)와 같은 모양 [{id, viewUrl, messages:[{id,date,subject,snippet,sender,labelIds,viewUrl}]}] */
export async function gmailThreads(q, max = 25) {
  const list = await (await gfetch(`${G}/threads?` + new URLSearchParams({ q, maxResults: String(max) }))).json();
  return Promise.all((list.threads || []).map(async t => {
    const th = await (await gfetch(`${G}/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`)).json();
    return { id: t.id, viewUrl: viewUrl(t.id), messages: (th.messages || []).map(m => ({
      id: m.id, date: new Date(Number(m.internalDate)).toISOString(), subject: hdr(m, 'Subject'), sender: hdr(m, 'From'), to: hdr(m, 'To'),
      snippet: m.snippet, labelIds: m.labelIds, viewUrl: viewUrl(m.id) })) };
  }));
}

/* 답장 초안 (보내지 않음) — 스레드 마지막 메일에 대한 답장 */
export async function createReplyDraft(threadId, bodyText) {
  const th = await (await gfetch(`${G}/threads/${threadId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Reply-To&metadataHeaders=Message-ID&metadataHeaders=References&metadataHeaders=To`)).json();
  const me = (await loadGoogle())?.email || '';
  const msgs = th.messages || []; if (!msgs.length) throw new Error('스레드를 찾을 수 없어요');
  const last = [...msgs].reverse().find(m => !hdr(m, 'From').toLowerCase().includes(me)) || msgs.at(-1);
  const to = hdr(last, 'Reply-To') || hdr(last, 'From');
  const subj = hdr(last, 'Subject'); const subject = /^re:/i.test(subj) ? subj : 'Re: ' + subj;
  const mid = hdr(last, 'Message-ID'), refs = [hdr(last, 'References'), mid].filter(Boolean).join(' ');
  const b64h = s => `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`;
  const headers = [`To: ${to}`, `Subject: ${b64h(subject)}`, mid ? `In-Reply-To: ${mid}` : null, refs ? `References: ${refs}` : null,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64'].filter(Boolean);
  const mime = headers.join('\r\n') + '\r\n\r\n' + Buffer.from(String(bodyText)).toString('base64');
  const d = await (await gfetch(`${G}/drafts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: { threadId, raw: Buffer.from(mime).toString('base64url') } }) })).json();
  return { draftId: d.id, to, subject, url: 'https://mail.google.com/mail/#drafts' };
}

/* 캘린더 */
const C = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
export async function calendarEvents(days = 7) {
  const now = new Date(Date.now() + 9 * 36e5), start = now.toISOString().slice(0, 10);
  const end = new Date(Date.parse(start) + days * 864e5).toISOString().slice(0, 10);
  const j = await (await gfetch(C + '?' + new URLSearchParams({ timeMin: `${start}T00:00:00+09:00`, timeMax: `${end}T23:59:59+09:00`, singleEvents: 'true', orderBy: 'startTime', timeZone: 'Asia/Seoul', maxResults: '100' }))).json();
  return (j.items || []).filter(e => e.status !== 'cancelled');
}
export async function respondEvent(eventId, response) {
  if (!['accepted', 'declined', 'tentative'].includes(response)) throw new Error('응답은 accepted/declined/tentative 중 하나');
  const ev = await (await gfetch(`${C}/${encodeURIComponent(eventId)}`)).json();
  const attendees = (ev.attendees || []).map(a => (a.self ? { ...a, responseStatus: response } : a));
  if (!attendees.some(a => a.self)) throw new Error('내가 초대된 일정이 아니에요');
  await gfetch(`${C}/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attendees }) });
  return { title: ev.summary, start: ev.start?.dateTime || ev.start?.date, response };
}

/* 드라이브: 구글 시트 → CSV (첫 번째 탭) */
export async function driveCsv(fileId) {
  return (await gfetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`)).text();
}

import { body, json, safeEqual, sessionCookie, clearCookie } from '../lib/core.js';

/* 로그인
   - POST {credential}  : 구글 로그인(ID 토큰) — ALLOWED_EMAILS(기본 gicheol.on@neosimplix.com)만 허용
   - POST {password}    : 비밀번호 (DESK_PASSWORD 가 설정돼 있을 때만)
   - GET                : 로그인 화면 설정 {googleClientId, password}
   - DELETE             : 로그아웃 */
const allowed = () => String(process.env.ALLOWED_EMAILS || 'gicheol.on@neosimplix.com').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
const fail = async (res, code, error) => { await new Promise(r => setTimeout(r, 800)); json(res, code, { error }); };

export default async function handler(req, res) {
  if (req.method === 'GET') return json(res, 200, { google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), password: !!process.env.DESK_PASSWORD });
  if (req.method === 'DELETE') { res.setHeader('set-cookie', clearCookie()); return json(res, 200, { ok: true }); }
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  if (!process.env.DESK_SECRET) return json(res, 500, { error: 'not_configured' });
  const b = await body(req);

  if (b.credential) {
    const cid = process.env.GOOGLE_CLIENT_ID;
    if (!cid) return json(res, 400, { error: 'google_not_configured' });
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(String(b.credential)));
    const t = await r.json().catch(() => ({}));
    const email = String(t.email || '').toLowerCase();
    const okIss = t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com';
    if (!r.ok || t.aud !== cid || !okIss || String(t.email_verified) !== 'true' || Number(t.exp) * 1000 < Date.now()) return fail(res, 401, 'google_invalid');
    if (!allowed().includes(email)) return fail(res, 403, 'not_allowed');
    res.setHeader('set-cookie', sessionCookie());
    return json(res, 200, { ok: true, email });
  }

  if (!process.env.DESK_PASSWORD) return fail(res, 401, 'password_disabled');
  if (!b.password || !safeEqual(b.password, process.env.DESK_PASSWORD)) return fail(res, 401, 'wrong_password');
  res.setHeader('set-cookie', sessionCookie());
  json(res, 200, { ok: true });
}

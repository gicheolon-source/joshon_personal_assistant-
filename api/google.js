import crypto from 'node:crypto';
import { json, authed, sessionCookie } from '../lib/core.js';
import { authUrl, exchangeCode, saveGoogle, googleStatus, disconnectGoogle, allowedEmails } from '../lib/google.js';

/* 구글 연결 (로그인 겸용)
   GET ?action=start     → 구글 동의 화면으로 이동
   GET ?action=callback  → 코드 교환, 허용된 계정이면 토큰 저장 + 로그인 쿠키
   GET ?action=status    → 연결 상태 (로그인 필요)
   POST ?action=disconnect → 연결 해제 (로그인 필요) */
const cookie = (req, name) => (String(req.headers.cookie || '').match(new RegExp(name + '=([^;]+)')) || [])[1];

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x'), action = url.searchParams.get('action');
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return json(res, 500, { error: 'google_not_configured' });

  if (action === 'start') {
    const state = crypto.randomBytes(16).toString('base64url');
    res.statusCode = 302;
    res.setHeader('set-cookie', `g_state=${state}; Path=/api/google; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
    res.setHeader('location', authUrl(req, state));
    return res.end();
  }
  if (action === 'callback') {
    const back = msg => { res.statusCode = 302; res.setHeader('location', '/?google=' + encodeURIComponent(msg)); res.end(); };
    if (url.searchParams.get('error')) return back('cancelled');
    if (!url.searchParams.get('state') || url.searchParams.get('state') !== cookie(req, 'g_state')) return back('state_mismatch');
    try {
      const r = await exchangeCode(req, url.searchParams.get('code'));
      if (!allowedEmails().includes(r.email)) return back('not_allowed');
      await saveGoogle(r);
      res.setHeader('set-cookie', [sessionCookie(), 'g_state=; Path=/api/google; Max-Age=0']);
      return back('connected');
    } catch (e) { console.error('google callback', e); return back('failed'); }
  }
  if (!authed(req)) return json(res, 401, { error: 'login_required' });
  if (action === 'status') return json(res, 200, await googleStatus());
  if (action === 'disconnect' && req.method === 'POST') { await disconnectGoogle(); return json(res, 200, { ok: true }); }
  json(res, 400, { error: 'bad_action' });
}

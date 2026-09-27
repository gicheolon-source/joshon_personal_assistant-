import { guard, json, body } from '../lib/core.js';
import { typecastTTS, TypecastError } from '../lib/typecast.js';

/* 타입캐스트 TTS 프록시 → mp3. {text, tempo?, pitch?, prev?, next?} · 목소리는 TYPECAST_VOICE_ID 고정 */
export default async function handler(req, res) {
  if (!guard(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  const b = await body(req);
  const text = String(b.text || '').trim().slice(0, 1000);
  if (!text) return json(res, 400, { error: 'text_required' });
  try {
    const buf = await typecastTTS(text, { prev: b.prev, next: b.next, tempo: Number(b.tempo) || 1.1, pitch: Number(b.pitch) || 0 });
    res.statusCode = 200; res.setHeader('content-type', 'audio/mpeg'); res.setHeader('cache-control', 'no-store'); res.end(buf);
  } catch (e) {
    const s = e instanceof TypecastError ? e.status : 500, blocked = [401, 402, 403].includes(s);
    json(res, s === 429 ? 429 : blocked ? 403 : 502, { error: blocked ? 'typecast_blocked' : 'typecast_failed', status: s, code: e.code || '', detail: e.detail || '' });
  }
}

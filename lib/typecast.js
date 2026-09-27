/* 타입캐스트 TTS 공용 (목소리는 TYPECAST_VOICE_ID 고정). 429·5xx는 최대 3번 재시도 */
export class TypecastError extends Error { constructor(status, code, detail) { super(`typecast ${status} ${code}`); this.status = status; this.code = code; this.detail = detail; } }

export async function typecastTTS(text, { prev = '', next = '', tempo = 1.1, pitch = 0 } = {}) {
  const key = process.env.TYPECAST_API_KEY, voice = process.env.TYPECAST_VOICE_ID;
  if (!key || !voice) throw new TypecastError(500, 'not_configured', '');
  const payload = {
    voice_id: voice, text: String(text).slice(0, 2000), model: 'ssfm-v30', language: 'kor',
    prompt: { emotion_type: 'smart', previous_text: String(prev).slice(-500), next_text: String(next).slice(0, 500) },
    output: { audio_format: 'mp3', audio_tempo: Math.min(2, Math.max(0.5, tempo)), audio_pitch: Math.min(12, Math.max(-12, Math.round(pitch))), remove_silence_ms: 150 },
  };
  let r, detail = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise(ok => setTimeout(ok, 500 * attempt + Math.random() * 300));
    r = await fetch('https://api.typecast.ai/v1/text-to-speech', { method: 'POST', headers: { 'X-API-KEY': key, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    detail = await r.text().catch(() => '');
    if (r.status !== 429 && r.status < 500) break;
  }
  let code = ''; try { code = JSON.parse(detail).error_code || ''; } catch {}
  console.error('typecast failed', r.status, detail.slice(0, 300));
  throw new TypecastError(r.status, code, detail.slice(0, 300));
}

/* 틱톡샵 대시보드(Firestore tts_kv)의 팀원 할 일 읽기 — 읽기 전용, 5분 캐시
   문서: td_<member>_daily_<YYYY-MM-DD>, td_<member>_weekly  (v = [{id, text, done}]) */
const MEMBERS = [{ code: 'ksw', name: '김세원' }, { code: 'wjy', name: '왕지윤' }, { code: 'okc', name: '온기철' }];
const BASE = 'https://firestore.googleapis.com/v1/projects/tts-dashboard-5b16e/databases/(default)/documents/tts_kv/';
let cache = null, cachedAt = 0;

function fsVal(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsVal);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fsVal(x)]));
  return null;
}
async function doc(key) {
  // After the dashboard's Firestore is locked to signed-in users, read through its server (TTS_KV_SECRET = its KV_SECRET).
  const r = process.env.TTS_KV_SECRET
    ? await fetch('https://tik-tok-shop-dashboard.vercel.app/api/kv?key=' + encodeURIComponent(key), { headers: { 'x-kv-secret': process.env.TTS_KV_SECRET } })
    : await fetch(BASE + key + '?key=' + process.env.FIREBASE_API_KEY);
  if (!r.ok) return [];
  const j = await r.json();
  let v = fsVal(j.fields?.v);
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = []; } }
  if (v && !Array.isArray(v) && Array.isArray(v.items)) v = v.items;
  return (Array.isArray(v) ? v : []).filter(x => x && (x.text || x.title)).map(x => ({ text: String(x.text || x.title).slice(0, 200), done: !!x.done }));
}

export async function getTeam({ fresh = false } = {}) {
  if (!process.env.FIREBASE_API_KEY && !process.env.TTS_KV_SECRET) return null;
  if (!fresh && cache && Date.now() - cachedAt < 5 * 60e3) return cache;
  const today = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
  try {
    const members = await Promise.all(MEMBERS.map(async m => ({ ...m, today: await doc(`td_${m.code}_daily_${today}`), weekly: await doc(`td_${m.code}_weekly`) })));
    cache = { date: today, members }; cachedAt = Date.now();
  } catch (e) { console.error('team', e.message); }
  return cache;
}

import { json, body, safeEqual } from '../lib/core.js';
import { applyIngest } from '../lib/ingestCore.js';
import { fullRefresh } from '../lib/refresh.js';

/* POST: 아침 스케줄 작업·클라우드 루틴이 브리핑 전송 (Authorization: Bearer <INGEST_TOKEN|ROUTINE_TOKEN>)
   GET : Vercel 크론(매일 06:30 KST) → 서버가 Gmail·캘린더·드라이브·슬랙을 직접 읽어 전체 업데이트 (Bearer <CRON_SECRET>) */
export default async function handler(req, res) {
  const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const okTok = t => t && tok && safeEqual(tok, t);
  if (req.method === 'GET') {
    if (!okTok(process.env.CRON_SECRET)) return json(res, 401, { error: 'unauthorized' });
    try { return json(res, 200, await fullRefresh()); } catch (e) { console.error('cron refresh', e); return json(res, 500, { error: e.message }); }
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  /* INGEST_TOKEN = 로컬 스크립트용, ROUTINE_TOKEN = 클라우드 루틴용 (따로 교체 가능) */
  if (!okTok(process.env.INGEST_TOKEN) && !okTok(process.env.ROUTINE_TOKEN)) return json(res, 401, { error: 'unauthorized' });
  json(res, 200, await applyIngest(await body(req)));
}

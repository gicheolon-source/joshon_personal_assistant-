import { guard, json } from '../lib/core.js';
import { buildPodcast, getPodcastMeta, getPodcastAudio, todayKST } from '../lib/podcast.js';

/* GET ?meta=1 → 상태 · GET → 오늘 mp3 · POST → 만들기 (?force=1 다시 만들기) */
export default async function handler(req, res) {
  if (!guard(req, res)) return;
  const url = new URL(req.url, 'http://x'), date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('date') || '') ? url.searchParams.get('date') : todayKST();
  if (req.method === 'POST') return json(res, 200, await buildPodcast({ force: url.searchParams.get('force') === '1' }));
  if (url.searchParams.get('meta')) { const m = await getPodcastMeta(date); return json(res, 200, m ? { ...m, script: m.status === 'script_only' ? m.script : undefined, hasScript: !!m.script } : { status: 'none' }); }
  const buf = await getPodcastAudio(date);
  if (!buf) return json(res, 404, { error: 'not_ready' });
  res.statusCode = 200; res.setHeader('content-type', 'audio/mpeg'); res.setHeader('content-length', buf.length);
  res.setHeader('cache-control', 'private, max-age=3600'); res.end(buf);
}

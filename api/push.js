import { guard, json, body } from '../lib/core.js';
import { saveSub, removeSub, subCount, pushAll } from '../lib/push.js';

/* GET → {publicKey, count} · POST {subscription} 구독 · POST {test:true} 테스트 알림 · DELETE {subscription} 해제 */
export default async function handler(req, res) {
  if (!guard(req, res)) return;
  if (req.method === 'GET') return json(res, 200, { publicKey: process.env.VAPID_PUBLIC_KEY || null, count: await subCount() });
  const b = await body(req);
  if (req.method === 'DELETE') { await removeSub(b.subscription); return json(res, 200, { ok: true }); }
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  if (b.test) return json(res, 200, await pushAll({ title: 'Josh Desk', body: '알림이 잘 연결됐어요. 급한 일이 생기면 여기로 알려드릴게요.', url: '/', tag: 'test' }));
  try { await saveSub(b.subscription); json(res, 200, { ok: true, count: await subCount() }); }
  catch (e) { json(res, 400, { error: e.message }); }
}

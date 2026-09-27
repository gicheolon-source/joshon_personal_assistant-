/* 폰·PC 알림 (Web Push, VAPID). 구독 정보는 Redis hash 'push:subs' (endpoint → subscription) */
import webpush from 'web-push';
import { kv } from './core.js';

let ready = false;
function init() {
  if (ready) return !!process.env.VAPID_PRIVATE_KEY;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails('mailto:gicheol.on@neosimplix.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  return (ready = true);
}
const keyOf = sub => Buffer.from(String(sub.endpoint)).toString('base64url').slice(-80);

export async function saveSub(sub) {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) throw new Error('bad_subscription');
  await kv().hset('push:subs', { [keyOf(sub)]: JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys, at: new Date().toISOString() }) });
}
export async function removeSub(sub) { if (sub?.endpoint) await kv().hdel('push:subs', keyOf(sub)); }
export async function subCount() { return Object.keys((await kv().hgetall('push:subs')) || {}).length; }

/* payload: {title, body, url?, tag?} — 만료된 구독(404/410)은 자동 삭제 */
export async function pushAll(payload) {
  if (!init()) return { sent: 0, reason: 'vapid_not_configured' };
  const subs = (await kv().hgetall('push:subs')) || {};
  let sent = 0;
  await Promise.all(Object.entries(subs).map(async ([k, v]) => {
    const sub = typeof v === 'string' ? JSON.parse(v) : v;
    try { await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 6 * 3600, urgency: 'high' }); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await kv().hdel('push:subs', k); else console.error('push', e.statusCode, e.body || e.message); }
  }));
  return { sent };
}

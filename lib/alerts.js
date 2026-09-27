/* 이상 신호: 새 브리핑이 들어올 때 계산해서 알림 보내기 (같은 알림은 한 번만)
   - 매출: 채널 최근 일매출이 전날보다 30%↓ (월 누적 1억 원 이상 채널만) / 아마존 실시간 어제 매출이 7일 평균보다 30%↓
   - 광고: 메신저·메일 요약에 정책 정지·Suspended 등
   - Flex: 새 휴가 결재 요청 */
import { kv } from './core.js';
import { pushAll } from './push.js';

const pct = (a, b) => (b ? Math.round((a / b - 1) * 100) : 0);
const won = v => (v >= 1e8 ? (v / 1e8).toFixed(1) + '억' : Math.round(v / 1e4).toLocaleString() + '만');

export function computeAlerts(brief, newFlex = []) {
  const out = [];
  for (const c of brief?.sales?.channels || []) {
    if (c.total < 1e8 || !c.last || !c.prevDay) continue;
    const d = pct(c.last, c.prevDay);
    if (d <= -30) out.push({ key: `sales:${c.platform}:${c.name}:${c.through}`, kind: 'sales', level: 'high',
      title: `${c.platform} ${c.name} 매출 ${d}%`, body: `${c.through?.slice(5)} ₩${won(c.last)} (전날 ₩${won(c.prevDay)})` });
  }
  for (const [code, m] of Object.entries(brief?.live?.amazon?.markets || {})) {
    const days = m.days || []; if (days.length < 8) continue;
    const last = days.at(-1), avg = days.slice(-8, -1).reduce((a, x) => a + x.sales, 0) / 7, d = pct(last.sales, avg);
    const avgOrders = days.slice(-8, -1).reduce((a, x) => a + (x.orders || 0), 0) / 7;
    if (avgOrders < 20) continue;   // 소규모 마켓은 하루 변동이 커서 제외
    if (d <= -30) out.push({ key: `amz:${code}:${last.date}`, kind: 'sales', level: 'high',
      title: `아마존 ${code} 어제 매출 ${d}%`, body: `${last.date.slice(5)} ${m.symbol}${Math.round(last.sales).toLocaleString()} (7일 평균 대비)` });
  }
  const adRe = /정책\s*(위반|정지)|suspend|policing|disapprov|비승인|광고\s*(중단|정지)/i;
  for (const x of [...(brief?.messages || []), ...(brief?.emails || [])]) {
    const text = `${x.subject || ''} ${x.summary || ''}`;
    if (adRe.test(text)) out.push({ key: `ad:${x.id || text.slice(0, 40)}`, kind: 'ads', level: 'high',
      title: '광고 정지·정책 알림', body: (x.summary || x.subject || '').slice(0, 120) });
  }
  for (const f of newFlex) if (f.kind === 'leave' && !f.ref) out.push({ key: `leave:${f.id}`, kind: 'leave', level: 'mid',
    title: `휴가 결재 요청 · ${f.who}`, body: `${f.what || '휴가'} ${f.start?.slice(5) || ''}${f.end && f.end !== f.start ? '~' + f.end.slice(5) : ''} ${f.days || ''}`.trim() });
  return out;
}

/* 새 알림만 푸시하고 목록 반환. 알림 키는 30일 보관 */
export async function notifyNew(alerts) {
  const fresh = [];
  for (const a of alerts) { const ok = await kv().set('alert:' + a.key, 1, { nx: true, ex: 30 * 86400 }); if (ok) fresh.push(a); }
  if (!fresh.length) return { fresh: 0 };
  const title = fresh.length === 1 ? fresh[0].title : `Josh Desk · 확인할 것 ${fresh.length}건`;
  const body = fresh.length === 1 ? fresh[0].body : fresh.slice(0, 4).map(a => '• ' + a.title).join('\n');
  const r = await pushAll({ title, body, url: '/', tag: 'alerts' });
  return { fresh: fresh.length, ...r };
}

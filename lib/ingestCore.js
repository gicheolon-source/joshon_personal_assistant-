import { kv, setBrief, getBrief, getTodo, putTodo, newTodo, getFlex, putFlexMany, delFlex } from './core.js';
import { parseSalesCsv, parseFlexMessages } from './parsers.js';
import { fetchAmazonDaily } from './amazon.js';
import { computeAlerts, notifyNew } from './alerts.js';
import { buildPodcast } from './podcast.js';
import { waitUntil } from '@vercel/functions';

/* 브리핑 데이터 반영 (ingest API · 서버 전체 업데이트 · 크론 공용)
   b = {brief?, ai?, raw?:{salesCsv, flexMessages}, todos?, flex?, noPodcast?}
   할 일·Flex 모두 새 id만 추가하고, 기존 항목의 완료/처리 체크는 건드리지 않는다. */
const ymd = s => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
const str = (s, n) => (s == null ? '' : String(s).slice(0, n));

export async function applyIngest(b) {
  const newFlex = [];
  const out = { ok: true, brief: false, added: 0, skipped: 0, flexAdded: 0, flexCancelled: 0, flexPruned: 0 };

  if (b.brief && typeof b.brief === 'object') {
    /* 아마존은 서버가 전 계정(북미·유럽·일본·호주)을 직접 조회해서 덮어씀 — PC 스크립트는 북미만 가져오므로 */
    try { const a = await fetchAmazonDaily(); if (a && Object.keys(a.markets).length) b.brief.live = { ...(b.brief.live || {}), amazon: a }; } catch (e) { out.amazonError = e.message; }
    await setBrief(b.brief); out.brief = true;
  }

  /* 클라우드 루틴 형식: ai(요약) + raw(매출 CSV·Flex 메일 원본) → 서버가 해석해서 brief 조립, 아마존은 서버가 SP-API로 직접 조회 */
  if (b.ai && typeof b.ai === 'object') {
    const prev = (await getBrief()) || {};
    const ai = b.ai, sources = { ...(ai.sources || {}) };
    let sales = prev.sales || null;
    if (b.raw?.salesCsv) { try { sales = parseSalesCsv(b.raw.salesCsv); } catch (e) { sources.sales = '실패: ' + e.message; } }
    else sources.sales = sources.sales || '시트 미수신(이전 값 유지)';
    let amazon = prev.live?.amazon || null;
    try { const a = await fetchAmazonDaily(); if (a && Object.keys(a.markets).length) amazon = a; } catch (e) { sources.amazon = '실패: ' + e.message; }
    await setBrief({
      generatedAt: new Date().toISOString(), headline: str(ai.headline, 600),
      emails: Array.isArray(ai.emails) ? ai.emails.slice(0, 15) : [], messages: Array.isArray(ai.messages) ? ai.messages.slice(0, 15) : [],
      calendar: Array.isArray(ai.calendar) ? ai.calendar.slice(0, 40) : [], sources,
      sales, live: { amazon, tiktokUS: prev.live?.tiktokUS || null },
    });
    out.brief = true; out.sales = !!sales && !sources.sales?.startsWith('실패'); out.amazon = !!amazon && !sources.amazon;
  }
  if (Array.isArray(b.raw?.flexMessages)) {
    const p = parseFlexMessages(b.raw.flexMessages);
    b.flex = { items: [...(b.flex?.items || []), ...p.items], cancels: [...(b.flex?.cancels || []), ...p.cancels] };
    out.flexParsed = p.items.length;
  }
  for (const t of Array.isArray(b.todos) ? b.todos : []) {
    const id = String(t.id || '').replace(/[^\w.:@+-]/g, '').slice(0, 120);
    if (!id || await getTodo(id)) { out.skipped++; continue; }
    const nt = newTodo(t); if (!nt.title) { out.skipped++; continue; }
    await putTodo(id, nt); out.added++;
  }

  if (b.flex && typeof b.flex === 'object') {
    const existing = await getFlex(), have = new Map(existing.map(f => [f.id, f])), upd = {};
    for (const f of Array.isArray(b.flex.items) ? b.flex.items : []) {
      const id = String(f.id || '').replace(/[^\w-]/g, '').slice(0, 64);
      if (!id || have.has(id) || !['leave', 'work', 'doc'].includes(f.kind) || !f.who) continue;
      const item = { kind: f.kind, who: str(f.who, 40), what: str(f.what, 80), reason: str(f.reason, 200), days: str(f.days, 20),
        start: ymd(f.start), end: ymd(f.end), workDate: ymd(f.workDate), requestedAt: str(f.requestedAt, 40),
        url: /^https:\/\//.test(f.url || '') ? str(f.url, 300) : null, ref: !!f.ref, done: !!f.ref, cancelled: false };
      upd[id] = item; have.set(id, { id, ...item }); newFlex.push({ id, ...item }); out.flexAdded++;
    }
    for (const c of Array.isArray(b.flex.cancels) ? b.flex.cancels : []) {
      const d = ymd(c.date); if (!d || !c.who) continue;
      for (const f of have.values()) if (f.kind === 'leave' && !f.cancelled && f.who === c.who && f.start && f.start <= d && (f.end || f.start) >= d) {
        const { id, ...rest } = f; upd[id] = { ...(upd[id] || rest), cancelled: true }; f.cancelled = true; out.flexCancelled++;
      }
    }
    await putFlexMany(upd);
    /* 정리: 요청 45일 지난 근무·문서, 끝난 지 14일 지난 휴가 */
    const now = Date.now(), today = new Date(now + 9 * 36e5).toISOString().slice(0, 10);
    const cutoff = new Date(now - 14 * 864e5 + 9 * 36e5).toISOString().slice(0, 10);
    for (const f of have.values()) {
      const old = f.requestedAt && now - Date.parse(f.requestedAt) > 45 * 864e5;
      const leaveOver = f.kind === 'leave' && (f.end || f.start) && (f.end || f.start) < cutoff;
      if ((f.kind !== 'leave' && old) || leaveOver || (f.kind === 'leave' && !f.start && old)) { await delFlex(f.id); out.flexPruned++; }
    }
    void today;
  }

  /* 이상 신호 → 폰 알림 (새 것만), 대시보드 배너용으로 저장 · 새 브리핑이면 팟캐스트를 뒤에서 만들기 */
  try {
    const brief = await getBrief();
    const alerts = computeAlerts(brief, newFlex);
    await kv().set('alerts:latest', { at: new Date().toISOString(), items: alerts }, { ex: 7 * 86400 });
    out.alerts = await notifyNew(alerts);
  } catch (e) { out.alertsError = e.message; }
  if (out.brief && !b.noPodcast) waitUntil(buildPodcast().catch(e => console.error('podcast', e)));
  return out;
}

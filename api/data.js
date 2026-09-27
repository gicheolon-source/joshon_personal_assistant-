import { guard, json, kv, body, getBrief, setBrief, getTodos, getFlex, getMemory, delMemory } from '../lib/core.js';
import { getTeam } from '../lib/team.js';
import { fetchAmazonDaily, configuredAccounts } from '../lib/amazon.js';
import { computeAlerts, notifyNew } from '../lib/alerts.js';
import { googleStatus } from '../lib/google.js';
import { fullRefresh } from '../lib/refresh.js';

/* GET → 대시보드 전체 데이터
   POST {refresh:true} → 서버가 직접 가져올 수 있는 것 지금 갱신 (아마존 SP-API · 팀 할 일 · 이상 신호)
   DELETE {memoryId} → Jarvis 기억 하나 지우기 */
async function refreshNow() {
  const out = { amazon: false, team: false };
  const brief = (await getBrief()) || {};
  try {
    const a = await fetchAmazonDaily();
    if (a && Object.keys(a.markets).length) {
      brief.live = { ...(brief.live || {}), amazon: a };
      brief.refreshedAt = new Date().toISOString();
      await setBrief(brief); out.amazon = true;
    }
  } catch (e) { out.amazonError = e.message; }
  try { out.team = !!(await getTeam({ fresh: true })); } catch (e) { out.teamError = e.message; }
  try {
    const alerts = computeAlerts(brief, []);
    await kv().set('alerts:latest', { at: new Date().toISOString(), items: alerts }, { ex: 7 * 86400 });
    out.alerts = await notifyNew(alerts);
  } catch (e) { out.alertsError = e.message; }
  return out;
}

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  if (req.method === 'DELETE') { const b = await body(req); if (b.memoryId) await delMemory(b.memoryId); return json(res, 200, { ok: true }); }
  let refreshed = null;
  const google = await googleStatus().catch(() => ({ connected: false }));
  const slack = !!process.env.SLACK_USER_TOKEN;
  if (req.method === 'POST') {
    const b = await body(req);
    if (b.refresh) {
      if (google.connected || slack) { try { refreshed = { full: true, ...(await fullRefresh()) }; } catch (e) { console.error('full refresh', e); refreshed = { full: true, ok: false, error: e.message }; } }
      else refreshed = await refreshNow();
    }
  }
  const [brief, todos, flex, team, alerts, memory, last] = await Promise.all([
    getBrief(), getTodos(), getFlex(), getTeam().catch(() => null), kv().get('alerts:latest').catch(() => null), getMemory().catch(() => []), kv().get('refresh:last').catch(() => null),
  ]);
  json(res, 200, { brief, todos, flex, team, alerts, memory, refreshed, connections: { google, slack, amazon: configuredAccounts(), lastRefresh: last && { ok: last.ok, ms: last.ms, sources: last.sources } } });
}

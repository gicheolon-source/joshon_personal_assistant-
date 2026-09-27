/* 슬랙 읽기 (사용자 토큰 SLACK_USER_TOKEN: search:read, channels:history, groups:history, im:history, mpim:history, users:read) */
const API = 'https://slack.com/api/';
const WS = 'https://neosimplixhq.slack.com';
export const JOSH_ID = 'U0A8BBC9CBC';
export const CHANNELS = [
  { id: 'C09BERTBSEQ', name: '#global-b2c-tiktok' }, { id: 'C09B8R7B41J', name: '#global-b2c-amazon' },
  { id: 'C0AT2J3665S', name: '#tiktokshop-team' }, { id: 'C0C05FHSFUL', name: '#pacvue-amz' },
];
async function call(method, params = {}) {
  const r = await fetch(API + method + '?' + new URLSearchParams(params), { headers: { authorization: 'Bearer ' + process.env.SLACK_USER_TOKEN } });
  const j = await r.json();
  if (!j.ok) throw new Error(`slack ${method} ${j.error}`);
  return j;
}
let users = null;
async function userName(id) {
  if (!id) return '';
  if (!users) users = new Map();
  if (users.has(id)) return users.get(id);
  try { const j = await call('users.info', { user: id }); const n = j.user?.profile?.display_name || j.user?.real_name || j.user?.name || id; users.set(id, n); return n; }
  catch { users.set(id, id); return id; }
}
const link = (ch, ts) => `${WS}/archives/${ch}/p${String(ts).replace('.', '')}`;
const clean = t => String(t || '').replace(/<@(\w+)>/g, '@$1').replace(/<(https?:[^|>]+)\|([^>]+)>/g, '$2').replace(/<(https?:[^>]+)>/g, '$1').slice(0, 800);

/* since: Date → [{channel, from, text, ts, date, url}] */
export async function slackRecent(since) {
  if (!process.env.SLACK_USER_TOKEN) return null;
  const oldest = String(Math.floor(since.getTime() / 1000)), after = new Date(since.getTime() - 864e5).toISOString().slice(0, 10);
  const out = [];
  for (const c of CHANNELS) {
    try {
      const j = await call('conversations.history', { channel: c.id, oldest, limit: '80' });
      for (const m of j.messages || []) out.push({ channel: c.name, from: m.user ? await userName(m.user) : (m.username || m.bot_profile?.name || 'bot'), text: clean(m.text || m.attachments?.[0]?.text || m.attachments?.[0]?.fallback), ts: m.ts, date: new Date(Number(m.ts) * 1000).toISOString(), url: link(c.id, m.ts), replies: m.reply_count || 0 });
    } catch (e) { out.push({ channel: c.name, error: e.message }); }
  }
  for (const q of [`<@${JOSH_ID}> after:${after}`, `to:me after:${after}`]) {
    try {
      const j = await call('search.messages', { query: q, count: '30', sort: 'timestamp' });
      for (const m of j.messages?.matches || []) {
        if (Number(m.ts) * 1000 < since.getTime()) continue;
        const ch = m.channel?.is_im ? 'DM' : m.channel?.is_mpim ? '그룹 DM' : '#' + (m.channel?.name || '');
        out.push({ channel: ch, from: m.username || await userName(m.user), text: clean(m.text), ts: m.ts, date: new Date(Number(m.ts) * 1000).toISOString(), url: m.permalink, mention: q.startsWith('<@') });
      }
    } catch (e) { out.push({ channel: 'search', error: e.message }); }
  }
  const seen = new Set();
  return out.filter(m => { const k = m.url || m.error; if (seen.has(k)) return false; seen.add(k); return true; });
}

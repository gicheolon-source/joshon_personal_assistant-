import { guard, json, body, getFlex, putFlexMany } from '../lib/core.js';

/* PATCH {ids:[...], done} — Flex 결재 항목 '처리함' 표시 */
export default async function handler(req, res) {
  if (!guard(req, res)) return;
  if (req.method !== 'PATCH') return json(res, 405, { error: 'method' });
  const b = await body(req);
  const ids = new Set((Array.isArray(b.ids) ? b.ids : []).map(String).slice(0, 200));
  const upd = {};
  for (const f of await getFlex()) if (ids.has(f.id)) { const { id, ...rest } = f; upd[id] = { ...rest, done: !!b.done, doneAt: b.done ? new Date().toISOString() : null }; }
  await putFlexMany(upd);
  json(res, 200, { ok: true, updated: Object.keys(upd).length });
}

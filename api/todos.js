import { guard, json, body, getTodo, putTodo, delTodo, newTodo, mkId } from '../lib/core.js';

/* POST {title,priority,due} 추가 · PATCH {id,done?,due?} 완료/날짜 · DELETE {id} 삭제 */
export default async function handler(req, res) {
  if (!guard(req, res)) return;
  const b = await body(req);
  if (req.method === 'POST') {
    const t = newTodo({ ...b, source: 'manual' });
    if (!t.title) return json(res, 400, { error: 'title_required' });
    const id = mkId(); await putTodo(id, t); return json(res, 200, { id, ...t });
  }
  const id = String(b.id || '');
  const cur = id && await getTodo(id);
  if (!cur) return json(res, 404, { error: 'not_found' });
  if (req.method === 'PATCH') {
    const t = { ...cur };
    if ('done' in b) { t.done = !!b.done; t.doneAt = b.done ? new Date().toISOString() : null; }
    if ('due' in b) { if (b.due && /^\d{4}-\d{2}-\d{2}$/.test(b.due)) t.due = b.due; else delete t.due; }
    await putTodo(id, t); return json(res, 200, { id, ...t });
  }
  if (req.method === 'DELETE') { await delTodo(id); return json(res, 200, { ok: true }); }
  json(res, 405, { error: 'method' });
}

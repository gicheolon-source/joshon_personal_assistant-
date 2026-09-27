const fs = require('fs');
const f = 'D:/josh-desk/api/chat.js';
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 60)); s = s.replace(a, b); };

rep("import { guard, json, body, getBrief, getTodos, getTodo, putTodo, newTodo, mkId } from '../lib/core.js';",
    "import { guard, json, body, getBrief, getTodos, getTodo, putTodo, newTodo, mkId, getFlex } from '../lib/core.js';");
rep("  { name: 'complete_todo',", `  { name: 'set_todo_due', description: '<data>의 openTodos에 있는 할 일의 날짜를 바꾼다(미루기 포함). due는 YYYY-MM-DD, 날짜를 없애려면 빈 문자열.', strict: true, eager_input_streaming: true,
    input_schema: { type: 'object', additionalProperties: false, required: ['id', 'due'], properties: { id: { type: 'string' }, due: { type: 'string' } } } },
  { name: 'complete_todo',`);
rep("function dataBlock(brief, todos) {", "function dataBlock(brief, todos, flex = []) {");
rep("    openTodos: todos.filter(t => !t.done).map(t => ({ id: t.id, title: t.title, priority: t.priority, due: t.due })),",
`    openTodos: todos.filter(t => !t.done).map(t => ({ id: t.id, title: t.title, priority: t.priority, due: t.due })),
    flexPendingApprovals: flex.filter(f => !f.done && !f.cancelled && !f.ref).map(f => ({ kind: f.kind, who: f.who, what: f.what, start: f.start, end: f.end, days: f.days, workDate: f.workDate, reason: f.reason, requestedAt: f.requestedAt })),
    teamLeaves: flex.filter(f => f.kind === 'leave' && !f.cancelled && f.start).map(f => ({ who: f.who, what: f.what, start: f.start, end: f.end, days: f.days, approvalPending: !f.done && !f.ref })),`);
rep("  if (name === 'complete_todo') {", `  if (name === 'set_todo_due') {
    const id = String(input?.id || ''), t = await getTodo(id);
    if (!t) throw new Error('그 id의 할 일이 없어요');
    const due = /^\\d{4}-\\d{2}-\\d{2}$/.test(input?.due || '') ? input.due : null;
    const nt = { ...t }; if (due) nt.due = due; else delete nt.due;
    await putTodo(id, nt);
    return { result: { ok: true, due }, act: \`날짜 변경: \${t.title} → \${due || '날짜 미정'}\` };
  }
  if (name === 'complete_todo') {`);
rep("  const [brief, todos] = await Promise.all([getBrief(), getTodos()]);",
    "  const [brief, todos, flex] = await Promise.all([getBrief(), getTodos(), getFlex()]);");
rep("${dataBlock(brief, todos)}", "${dataBlock(brief, todos, flex)}");
rep("할 일을 추가하거나 완료해 달라는 요청을 받았을 때만 도구를 쓰고, 처리한 뒤 짧게 확인해 준다.",
    "할 일을 추가·완료하거나 날짜를 바꿔 달라는 요청을 받았을 때만 도구를 쓰고, 처리한 뒤 짧게 확인해 준다. '내일', '금요일' 같은 말은 now 기준 날짜로 바꾼다.\nFlex 결재 대기(flexPendingApprovals)와 팀 휴가(teamLeaves)도 알고 있다. Flex 승인 자체는 직접 할 수 없으니 Flex에서 처리하시라고 안내한다.");
fs.writeFileSync(f, s);
console.log('chat patched');

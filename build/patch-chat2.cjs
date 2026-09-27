const fs = require('fs');
const f = 'D:/josh-desk/api/chat.js';
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 60)); s = s.replace(a, b); };

rep("getTodo, putTodo, newTodo, mkId, getFlex } from '../lib/core.js';",
    "getTodo, putTodo, newTodo, mkId, getFlex, getMemory, addMemory, delMemory } from '../lib/core.js';\nimport { getTeam } from '../lib/team.js';");
rep("  { name: 'complete_todo',", `  { name: 'remember', description: 'Josh가 "기억해", "앞으로는 ~하게 해줘"처럼 취향·규칙·사실을 기억하라고 할 때만 저장한다. 짧은 한 문장으로.', strict: true, eager_input_streaming: true,
    input_schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } } },
  { name: 'forget', description: '<memory>에 있는 기억을 id로 지운다. Josh가 잊으라고 할 때만.', strict: true, eager_input_streaming: true,
    input_schema: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string' } } } },
  { name: 'complete_todo',`);
rep("function dataBlock(brief, todos, flex = []) {", "function dataBlock(brief, todos, flex = [], team = null) {");
rep("    teamLeaves:", "    teamTodosToday: team?.members?.map(m => ({ name: m.name, today: m.today, weekly: m.weekly })),\n    teamLeaves:");
rep("  if (name === 'set_todo_due') {", `  if (name === 'remember') { const id = await addMemory(input?.text); return { result: { ok: true, id }, act: \`기억함: \${String(input?.text).slice(0, 60)}\` }; }
  if (name === 'forget') { await delMemory(input?.id); return { result: { ok: true }, act: '기억 삭제' }; }
  if (name === 'set_todo_due') {`);
rep("  const [brief, todos, flex] = await Promise.all([getBrief(), getTodos(), getFlex()]);",
    "  const [brief, todos, flex, team, memory] = await Promise.all([getBrief(), getTodos(), getFlex(), getTeam().catch(() => null), getMemory().catch(() => [])]);");
rep("  const system = [{ type: 'text', text: PERSONA }, ",
    "  const memText = memory.length ? memory.map(m => `- [${m.id}] ${m.text}`).join('\\n') : '(없음)';\n  const system = [{ type: 'text', text: PERSONA }, { type: 'text', text: `<memory>\\nJosh가 기억해 달라고 한 취향·규칙이다. 항상 따른다.\\n${memText}\\n</memory>` }, ");
rep("${dataBlock(brief, todos, flex)}", "${dataBlock(brief, todos, flex, team)}");
fs.writeFileSync(f, s);
console.log('chat patched');

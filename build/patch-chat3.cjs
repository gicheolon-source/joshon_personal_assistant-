const fs = require('fs');
const f = 'D:/josh-desk/api/chat.js';
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 60)); s = s.replace(a, b); };

rep("import { getTeam } from '../lib/team.js';", "import { getTeam } from '../lib/team.js';\nimport { createReplyDraft, respondEvent, loadGoogle } from '../lib/google.js';");
rep("  { name: 'complete_todo',", `  { name: 'draft_email_reply', description: 'Gmail 스레드에 답장 "초안"을 임시보관함에 만든다(보내지 않음). Josh가 답장/초안을 써 달라고 할 때 쓴다. threadId는 <data>.emails[].id(gm- 접두사 없이). body는 Josh 명의의 완성된 메일 본문(상대 언어에 맞춰, 서명은 "Josh" 또는 "온기철").', strict: true, eager_input_streaming: true,
    input_schema: { type: 'object', additionalProperties: false, required: ['threadId', 'body'], properties: { threadId: { type: 'string' }, body: { type: 'string' } } } },
  { name: 'respond_event', description: '캘린더 초대에 참석(accepted)/불참(declined)/미정(tentative)으로 응답한다. 주최자에게 알림이 가므로 Josh가 이 대화에서 명시적으로 "참석으로 해줘/불참 처리해줘"라고 지시했을 때만 쓴다. eventId는 <data>.calendar[].id.', strict: true, eager_input_streaming: true,
    input_schema: { type: 'object', additionalProperties: false, required: ['eventId', 'response'], properties: { eventId: { type: 'string' }, response: { type: 'string', enum: ['accepted', 'declined', 'tentative'] } } } },
  { name: 'complete_todo',`);
rep("    calendar: (b.calendar || []).map(e => ({ title:", "    calendar: (b.calendar || []).map(e => ({ id: e.id, title:");
rep("    emails: (b.emails || []).map(x => ({ from:", "    emails: (b.emails || []).map(x => ({ id: String(x.id || '').replace(/^gm-/, ''), from:");
rep("  if (name === 'remember')", `  if (name === 'draft_email_reply') {
    const d = await createReplyDraft(String(input?.threadId || '').replace(/^gm-/, ''), String(input?.body || ''));
    return { result: { ok: true, to: d.to, subject: d.subject }, act: \`Gmail 초안 저장: \${d.subject} → \${d.to}\` };
  }
  if (name === 'respond_event') {
    const r = await respondEvent(String(input?.eventId || ''), String(input?.response || ''));
    const w = { accepted: '참석', declined: '불참', tentative: '미정' }[r.response];
    return { result: { ok: true, ...r }, act: \`캘린더 응답: \${r.title} → \${w}\` };
  }
  if (name === 'remember')`);
rep("Flex 결재 대기(flexPendingApprovals)와 팀 휴가(teamLeaves)도 알고 있다.",
    "메일 답장 초안(draft_email_reply)은 요청받으면 만들고 '임시보관함에 저장했으니 확인 후 보내시라'고 말한다. 절대 직접 보내지 않는다. 캘린더 응답(respond_event)은 명시적 지시가 있을 때만. 슬랙 답장은 보낼 수 없으니 답장 문구를 제안만 한다.\nFlex 결재 대기(flexPendingApprovals)와 팀 휴가(teamLeaves)도 알고 있다.");
/* 구글 미연결이면 해당 도구 숨김 */
rep("      const stream = client.beta.messages.stream({\n        model: MODEL, max_tokens: 4000, system, messages, tools: TOOLS,",
    "      const stream = client.beta.messages.stream({\n        model: MODEL, max_tokens: 4000, system, messages, tools: googleOn ? TOOLS : TOOLS.filter(t => !['draft_email_reply', 'respond_event'].includes(t.name)),");
rep("  const messages = [...turns];", "  const messages = [...turns];\n  const googleOn = !!(await loadGoogle().catch(() => null));");
fs.writeFileSync(f, s);
console.log('chat patched');

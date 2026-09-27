const fs = require('fs'); const f = 'D:/josh-desk/build/jarvis.js'; let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 70)); s = s.replace(a, b); };
rep("  const MAX_INFLIGHT = 2; let inflight = 0;", "  const MAX_INFLIGHT = 2; let inflight = 0, ttsBlockedUntil = 0, ttsBlockReason = '';");
rep("  function startFetch(it){\n    if (it.p) return it.p;",
    "  function startFetch(it){\n    if (it.p) return it.p;\n    if (Date.now() < ttsBlockedUntil){ it.p = Promise.reject(new Error('blocked')); it.p.catch(() => {}); return it.p; }");
rep("      if (!ttsWarned){ ttsWarned = true; addMsg('sys', '타입캐스트 음성을 받지 못해 기본 음성으로 읽어요.'); }",
    "      if (!ttsWarned){ ttsWarned = true; addMsg('sys', Date.now() < ttsBlockedUntil ? `타입캐스트 계정이 제한돼서(${ttsBlockReason}) 당분간 기본 음성으로 읽어요. 유료 API 요금제로 바꾸면 풀려요.` : '타입캐스트 음성을 받지 못해 기본 음성으로 읽어요.'); }");
fs.writeFileSync(f, s); console.log('ok');

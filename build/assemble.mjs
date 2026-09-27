/* D:\assistant-brief\desk.html(아티팩트판) → public/index.html(Vercel판). node build/assemble.mjs */
import fs from 'node:fs';
const src = fs.readFileSync('D:/assistant-brief/desk.html', 'utf8');
const todosJs = fs.readFileSync('build/todos.js', 'utf8');
const jarvisJs = fs.readFileSync('build/jarvis.js', 'utf8');
const extrasJs = fs.readFileSync('build/extras.js', 'utf8');
let s = src;
const cut = (a, b, rep) => {
  const i = s.indexOf(a), j = s.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('marker missing: ' + (i < 0 ? a : b));
  s = s.slice(0, i) + rep + s.slice(j + b.length);
};
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 80)); s = s.replace(a, b); };

/* JS */
cut('  const pending = new Set();', "console.warn('write failed', err); }\n", todosJs);
cut('  /* ── Jarvis: voice ── */', '})();\n</script>', extrasJs + jarvisJs + '</script>');

/* 드로어: 음성 설정 · 마이크 */
cut('  <div class="vset" id="vset">', '  </div>\n  <div class="log"', `  <div class="vset" id="vset">
    <span>목소리</span><span style="color:var(--ink);font-weight:500">라이언 · 타입캐스트</span>
    <label for="vtempo">속도 <output id="vtempo-o" for="vtempo"></output></label><input type="range" id="vtempo" min="0.8" max="1.6" step="0.05">
    <label for="vpitch">톤 <output id="vpitch-o" for="vpitch"></output></label><input type="range" id="vpitch" min="-6" max="6" step="1" title="왼쪽일수록 낮고 굵게">
  </div>
  <div class="log"`);
cut('  <form class="jin" id="jform" autocomplete="off">', '  </form>', `  <form class="jin" id="jform" autocomplete="off">
    <div class="jrow">
      <button class="mic" id="mic" type="button" aria-pressed="false" aria-label="말하기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>
      <textarea id="jtext" rows="1" placeholder="말하거나 입력하세요…" aria-label="Jarvis에게 보낼 메시지"></textarea>
      <button class="send" id="jsend" type="submit" aria-label="보내기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h13M13 6l6 6-6 6"/></svg></button>
    </div>
    <label class="wakerow" id="wakerow"><input type="checkbox" id="wake"> "자비스"라고 부르면 듣기 <span class="hint">· <kbd>Ctrl</kbd>+<kbd>Space</kbd> 바로 말하기</span></label>
  </form>`);

/* 로그인 오버레이 + 로그아웃 */
rep('<button class="fab"', `<div class="login" id="login" hidden>
  <form id="loginform" autocomplete="on">
    <div class="orb" aria-hidden="true"></div>
    <h2>Josh Desk</h2>
    <p id="loginhint">로그인해 주세요</p>
    <div id="gbtn" style="min-height:44px"></div>
    <div class="orline" id="orline" hidden>또는 비밀번호</div>
    <div id="pwbox" hidden style="width:100%;display:flex;flex-direction:column;gap:10px">
      <input type="text" name="username" value="josh" autocomplete="username" hidden>
      <input type="password" id="pw" autocomplete="current-password" aria-label="비밀번호">
      <button type="submit" id="loginbtn">들어가기</button>
    </div>
    <div class="err" id="loginerr" role="alert"></div>
  </form>
</div>
<button class="fab"`);
rep('    <div class="fresh" id="fresh"></div>', '    <div class="fresh" id="fresh"></div>\n    <ul class="conns" id="conns"></ul>\n    <button class="logout" id="logout" type="button">로그아웃</button>');
rep('저장소에 연결할 수 없어요. claude.ai에 로그인한 상태로 열어 주세요.', '데이터를 불러오지 못했어요.');
rep('<p>오늘 일정·메일·매출을 물어보세요. 음성으로 대답해요.</p>', '<p>"자비스"라고 부르거나 마이크를 눌러 말해 보세요.</p>');

/* v2: 캘린더형 할 일 + Flex */
cut('  function renderTodos(){', "$('f-done').setAttribute('aria-pressed','true'); $('f-open').setAttribute('aria-pressed','false'); renderTodos(); };\n", '');
cut('        <section class="card" id="sec-todo">', '        </section>\n      </div>', `        <section class="card" id="sec-todo">
          <div class="ch"><h2>할 일</h2>
            <div class="seg" id="tview" role="group" aria-label="보기"><button type="button" data-v="day">오늘</button><button type="button" data-v="week">주간</button><button type="button" data-v="month">월간</button></div>
          </div>
          <div class="tnav">
            <button type="button" class="ib" id="tprev" aria-label="이전">‹</button>
            <b id="tlabel"></b>
            <button type="button" class="ib" id="tnext" aria-label="다음">›</button>
            <button type="button" class="mini" id="ttoday">오늘</button>
            <span class="sp"></span>
            <label class="showdone"><input type="checkbox" id="showdone"> 완료 포함</label>
            <span class="meta" id="todo-meta"></span>
          </div>
          <form class="addrow" id="addform" autocomplete="off">
            <input type="text" id="newtodo" placeholder="할 일 추가" maxlength="200" aria-label="새 할 일">
            <input type="date" id="newdue" aria-label="날짜">
            <select id="newprio" aria-label="우선순위"><option value="high">높음</option><option value="mid" selected>보통</option><option value="low">낮음</option></select>
            <button id="addbtn" type="submit">추가</button>
          </form>
          <ul class="tlist" id="todos"><li class="empty">불러오는 중…</li></ul>
        </section>
      </div>

      <div class="row r2">
        <section class="card" id="sec-flex">
          <div class="ch"><h2>Flex 결재</h2>
            <div class="seg" id="fview" role="group" aria-label="보기"><button type="button" data-v="pending" id="fl-pend">대기</button><button type="button" data-v="done">처리함</button></div>
          </div>
          <div class="note" style="margin:-4px 0 8px">Flex 알림 메일 기준이에요. Flex에서 승인한 뒤 체크하면 목록에서 빠져요. <a href="https://flex.team" target="_blank" rel="noopener">Flex 열기</a></div>
          <ul class="tlist" id="flexlist"><li class="empty">불러오는 중…</li></ul>
        </section>
        <section class="card" id="sec-leave">
          <div class="ch"><h2>다가오는 팀 휴가</h2><span class="meta">결재 대기 포함</span></div>
          <ul class="leavelist" id="leaves"><li class="empty sm">불러오는 중…</li></ul>
        </section>
      </div>`);
rep("['msg','메신저','sec-msg'],", "['msg','메신저','sec-msg'],['flex','Flex 결재','sec-flex'],");
rep("    jarvis:'", "    flex:'<path d=\"M4 4h16v16H4z\"/><path d=\"m8 12 3 3 5-6\"/>',\n    jarvis:'");

/* CSS */
rep('.scrim{', `.mic{border:0;background:var(--dark);color:#fff;width:42px;height:42px;border-radius:12px;display:grid;place-items:center;flex:none}
.mic svg{width:19px;height:19px}
.mic[aria-pressed="true"]{background:var(--high);box-shadow:0 0 0 4px var(--high-soft)}
.wakerow{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);cursor:pointer}
.wakerow[hidden]{display:none}
.wakerow input{accent-color:var(--accent)}
.orb.listening{background:radial-gradient(circle at 50% 50%,#FFF6F4 0 9%,#FFB3A8 17%,#FF5A4E 40%,#A3163A 70%,#3A0A22 100%);box-shadow:0 0 0 3px rgba(255,90,80,.2),0 0 24px rgba(255,80,80,.55)}
.login{position:fixed;inset:0;z-index:60;background:var(--ground);display:grid;place-items:center;padding:16px}
.login[hidden]{display:none}
.login form{width:min(340px,100%);background:var(--shell);border-radius:22px;padding:28px 24px;display:flex;flex-direction:column;align-items:center;gap:10px;box-shadow:var(--shadow)}
.login h2{margin:6px 0 0;font-size:20px}
.login p{margin:0 0 6px;color:var(--muted);font-size:13px}
.login input[type=password]{width:100%;border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:11px 12px}
.login button{width:100%;border:0;background:var(--accent);color:var(--accent-ink);border-radius:12px;padding:11px;font-weight:600}
.login .orline{font-size:12px;color:var(--faint);display:flex;align-items:center;gap:8px;width:100%}
.login .orline::before,.login .orline::after{content:"";flex:1;height:1px;background:var(--line)}
.login #pwbox[hidden]{display:none!important}
.login .err{min-height:18px;color:var(--high);font-size:12.5px}
.logout{margin:10px 10px 0;border:0;background:transparent;color:var(--faint);font-size:12px;text-align:left;padding:0}
.logout:hover{color:var(--high)}
.tnav{display:flex;align-items:center;gap:6px;margin:-2px 0 10px;flex-wrap:wrap}
.tnav b{font-size:14px;min-width:0}
.tnav .ib{width:28px;height:28px;font-size:17px;line-height:1}
.tnav .sp{flex:1}
.showdone{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:4px;cursor:pointer}
.showdone input{accent-color:var(--accent)}
.mini{border:1px solid var(--line);background:var(--card);color:var(--muted);border-radius:7px;padding:1px 7px;font-size:11.5px}
.mini:hover{color:var(--accent);border-color:var(--accent)}
.addrow input[type=date]{flex:0 0 132px;min-width:0;border:1px solid var(--line);background:var(--panel);border-radius:10px;padding:0 8px}
.grp-h{list-style:none;font-size:12px;font-weight:600;color:var(--muted);padding:10px 2px 4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.grp-h.over{color:var(--high)}
.grp-h.wk{border-top:1px solid var(--line);margin-top:4px}
.grp-h.wk.today .dlink{color:var(--accent)}
.grp-h .cnt{font-weight:500;color:var(--faint)}
.dlink{border:0;background:transparent;padding:0;font:inherit;color:inherit;font-weight:600}
.dlink:hover{color:var(--accent)}
.leaves{display:inline-flex;gap:4px;flex-wrap:wrap}
.leave{font-size:11px;font-weight:500;background:var(--t1);color:var(--t-ink);border-radius:999px;padding:1px 7px}
.trow.compact{padding:6px 2px}
.duechip{position:relative;display:inline-flex;align-items:center;border:1px dashed var(--line);border-radius:7px;padding:0 6px;cursor:pointer;color:var(--muted)}
.duechip.over{color:var(--high);border-color:var(--high-soft);font-weight:600}
.duechip.none{color:var(--faint)}
.duechip:hover{border-color:var(--accent);color:var(--accent)}
.duein{position:absolute;inset:0;opacity:0;width:100%;cursor:pointer}
.empty.sm{padding:8px 0;font-size:12.5px}
.tlist.month{max-height:none}
.mgrid{list-style:none;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.mh{font-size:11px;color:var(--faint);text-align:center;padding-bottom:2px}
.mc{position:relative;border:1px solid var(--line);background:var(--card);border-radius:10px;min-height:58px;padding:5px 5px 4px;text-align:left;display:flex;flex-direction:column;gap:3px}
.mc.blank{border:0;background:transparent}
.mc b{font-size:12px;font-weight:600}
.mc.past b{color:var(--faint)}
.mc.today{border-color:var(--accent);background:var(--accent-soft)}
.mc:hover:not(.blank){border-color:var(--accent)}
.mc .dots{display:flex;gap:2px}
.mc .dots i{width:6px;height:6px;border-radius:50%}
.mc .dots .d-high{background:var(--high)} .mc .dots .d-mid{background:var(--mid)} .mc .dots .d-low{background:var(--faint)}
.mc .n{position:absolute;top:4px;right:5px;font-size:10.5px;font-weight:600;color:var(--muted)}
.mc .n.hot{color:var(--high)}
.mc .lv{font-size:11px;margin-top:auto}
.frow{display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:start;padding:9px 2px;border-bottom:1px solid var(--line);list-style:none}
.frow input{width:18px;height:18px;margin:1px 0 0;accent-color:var(--accent);cursor:pointer}
.frow .fw{color:var(--muted);font-size:13px}
.frow.done,.frow.cancelled{opacity:.55}
.frow .tm{display:flex;flex-wrap:wrap;gap:4px 8px;margin-top:3px;font-size:12px;color:var(--muted)}
#flexlist{max-height:460px}
.leavelist{list-style:none;margin:0;padding:0}
.leavelist li:not(.empty){display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);flex-wrap:wrap}
.leavelist .ld{font-size:12.5px;color:var(--accent);font-weight:600;min-width:92px;font-variant-numeric:tabular-nums}
.leavelist .fw{color:var(--muted);font-size:13px}
.scrim{`);

/* v5: 아마존 전 국가 라벨 (서버가 보낸 국기·이름 사용, 날짜는 현지 기준) */
rep('<div class="n">${NAME[k]||k}<small>${md(last.date)} PT · ', '<div class="n">${mk.flag ? mk.flag + \' 아마존 \' + (mk.name || k) : (NAME[k]||k)}<small>${md(last.date)} 현지 · ');

/* v3: 알림 배너 · 팟캐스트 · 주간 리포트 · 팀 할 일 · Jarvis 기억 · 폰 알림 */
rep('      <div class="notice" id="nodb" hidden>', '      <div class="alertbar" id="alertbar" hidden></div>\n      <div class="notice" id="nodb" hidden>');
rep('<button class="darkbtn" type="button" id="readbrief">', `<button class="darkbtn pod" type="button" id="podbtn" data-state="none"><span>🎧 오늘 팟캐스트 만들기</span><i aria-hidden="true">♪</i></button>
          <div class="podnote" id="podnote"></div>
          <audio id="podaudio" controls preload="none" hidden style="width:100%;margin-top:8px"></audio>
          <button class="darkbtn" type="button" id="readbrief">`);
rep('      <section class="card" id="sec-table">', `      <div class="row r2">
        <section class="card" id="sec-team">
          <div class="ch"><h2>팀 할 일</h2><span class="meta" id="team-meta"></span></div>
          <div id="teamlist"><div class="empty sm">불러오는 중…</div></div>
        </section>
        <section class="card" id="sec-weekly">
          <div class="ch"><h2>주간 리포트</h2><button type="button" class="mini" id="weeklybtn">이번 주 리포트 쓰기</button></div>
          <div class="note" id="weekly-meta" style="margin:-4px 0 8px"></div>
          <pre class="weekly" id="weeklytext" hidden></pre>
          <button type="button" class="mini" id="weeklycopy" hidden>복사</button>
        </section>
      </div>

      <section class="card" id="sec-table">`);
rep('      <div class="avatar" aria-hidden="true">JO</div>', '      <button type="button" class="pushbtn refresh" id="refreshbtn" title="아마존 매출·팀 할 일을 지금 새로 가져와요"><i aria-hidden="true">⟳</i> 지금 업데이트</button>\n      <button type="button" class="pushbtn" id="pushbtn" hidden>🔔 폰 알림 켜기</button>\n      <div class="avatar" aria-hidden="true">JO</div>');
rep('  <div class="log" id="log" aria-live="polite"></div>', `  <details class="mem"><summary>Jarvis가 기억하는 것 <span id="memcount"></span></summary><ul id="memlist"></ul></details>
  <div class="log" id="log" aria-live="polite"></div>`);
rep('.scrim{', `.alertbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 14px;border-radius:14px;background:var(--high-soft);color:var(--ink);font-size:13px}
.alertbar b{color:var(--high);margin-right:4px}
.alertbar .al{display:inline-flex;flex-direction:column;background:var(--card);border-radius:10px;padding:6px 10px;border-left:3px solid var(--high)}
.alertbar .al-leave{border-left-color:var(--mid)}
.alertbar .al small{color:var(--muted);font-size:11.5px}
.darkbtn.pod{background:var(--accent-soft);color:var(--accent)}
.darkbtn.pod i{background:var(--accent);color:var(--accent-ink)}
.darkbtn.pod[data-state="building"]{opacity:.7;cursor:progress}
.podnote{font-size:11.5px;color:var(--faint);margin-top:4px;min-height:14px}
.pushbtn{border:1px solid var(--line);background:var(--card);border-radius:10px;padding:7px 11px;font-size:12.5px;color:var(--ink)}
.pushbtn:disabled{opacity:.6}
.conns{list-style:none;margin:12px 6px 0;padding:10px;border-radius:12px;background:var(--panel);display:flex;flex-direction:column;gap:7px;font-size:12px}
.conns li{display:flex;align-items:flex-start;gap:7px;color:var(--muted)}
.conns li i{font-style:normal;color:var(--faint);line-height:1.4}
.conns li.on i{color:var(--good)}
.conns li span{flex:1;min-width:0;color:var(--ink)}
.conns li small{display:block;color:var(--faint);font-size:11px}
.conns li a{font-weight:600;font-size:12px}
.login .gbtn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:12px;padding:11px;font-weight:600;text-decoration:none}
.login .gbtn:hover{border-color:var(--accent);text-decoration:none}
.login #gbtn{width:100%}
.pushbtn.refresh{background:var(--accent);border-color:var(--accent);color:var(--accent-ink);font-weight:600}
.pushbtn.refresh i{display:inline-block;font-style:normal}
@media (prefers-reduced-motion:no-preference){.pushbtn.spin i{animation:spin .8s linear infinite}}
@keyframes spin{to{transform:rotate(360deg)}}
.tm-mem{padding:10px 0;border-bottom:1px solid var(--line)}
.tm-mem:last-child{border-bottom:0}
.tm-h{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.tm-h .ava{width:26px;height:26px;border-radius:8px;font-size:11px}
.tm-h .meta{margin-left:auto;font-size:12px;color:var(--faint)}
.tm-mem ul{list-style:none;margin:0;padding:0 0 0 34px;display:flex;flex-direction:column;gap:3px;font-size:13px}
.tm-mem li.done{color:var(--faint);text-decoration:line-through}
.tm-mem li.none{color:var(--faint)}
.tm-w{padding-left:34px;margin-top:6px;font-size:12px;color:var(--muted)}
pre.weekly{white-space:pre-wrap;font-family:var(--sans);font-size:13px;line-height:1.6;background:var(--panel);border-radius:12px;padding:12px 14px;max-height:420px;overflow:auto;margin:0 0 8px}
.mem{border-bottom:1px solid var(--line);padding:8px 16px;font-size:12.5px;color:var(--muted)}
.mem summary{cursor:pointer}
.mem ul{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:4px}
.mem li{display:flex;justify-content:space-between;gap:8px;color:var(--ink)}
.mem li.none{color:var(--faint)}
.scrim{`);

s = `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="robots" content="noindex">\n<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%236A3CF0'/%3E%3Ctext x='16' y='22' font-size='17' font-family='Arial' font-weight='700' fill='white' text-anchor='middle'%3EJ%3C/text%3E%3C/svg%3E">\n`
  + s.replace('</style>', 'body{margin:0}\n[hidden]{display:none!important}\n</style>\n</head>\n<body>') + '\n</body>\n</html>\n';

s = s.replace('<link rel="icon"', '<link rel="manifest" href="/manifest.webmanifest">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<meta name="theme-color" content="#6A3CF0">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="Josh Desk">\n<link rel="icon"');
/* 남은 아티팩트 전용 참조 확인 */
for (const bad of ['claude.use', 'db.collection', 'db.doc', 'sample(', 'speechSynthesis.getVoices']) if (s.includes(bad)) console.warn('leftover:', bad);
fs.writeFileSync('public/index.html', s);
const js = s.slice(s.lastIndexOf('<script>') + 8, s.lastIndexOf('</script>'));
new Function(js);
console.log('public/index.html', (s.length / 1024).toFixed(0) + 'KB · syntax ok');

  /* ── API ── */
  async function api(path, opts = {}){
    const r = await fetch(path, Object.assign({}, opts, {headers: Object.assign({'content-type': 'application/json'}, opts.headers || {})}));
    if (r.status === 401){ showLogin(); throw Object.assign(new Error('login'), {code: 401}); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || String(r.status)), {code: r.status, body: j});
    return j;
  }
  async function loadData(){
    const j = await api('/api/data');
    brief = j.brief; todos = j.todos || []; flex = j.flex || []; alerts = j.alerts; team = j.team; memory = j.memory || []; conns = j.connections;
    $('nodb').hidden = true; renderBrief(); renderTodos(); renderFlex(); renderAlerts(); renderTeam(); renderMemory(); renderConns();
  }
  let toastT;
  function toast(msg){ $('nodb').textContent = msg; $('nodb').hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { $('nodb').hidden = true; }, 5000); }

  /* ── 로그인 ── */
  let loginCfg = null;
  async function showLogin(){
    $('login').hidden = false;
    if (!loginCfg){ try { loginCfg = await (await fetch('/api/login')).json(); } catch(e){ loginCfg = {password: true}; } }
    $('pwbox').hidden = !loginCfg.password;
    $('orline').hidden = !(loginCfg.password && loginCfg.google);
    $('loginhint').textContent = loginCfg.google ? '회사 구글 계정으로 로그인해 주세요' : '비밀번호를 입력해 주세요';
    const gq = new URLSearchParams(location.search).get('google');
    if (gq && gq !== 'connected') $('loginerr').textContent = {not_allowed: '허용된 계정이 아니에요.', cancelled: '구글 로그인을 취소했어요.'}[gq] || '구글 로그인을 확인하지 못했어요.';
    if (loginCfg.google) renderGoogle(); else setTimeout(() => $('pw').focus(), 50);
  }
  function renderGoogle(){
    $('gbtn').innerHTML = '<a class="gbtn" href="/api/google?action=start"><svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>회사 구글 계정으로 로그인</a>';
  }
  $('loginform').addEventListener('submit', async e => {
    e.preventDefault(); $('loginerr').textContent = ''; $('loginbtn').disabled = true;
    try {
      const r = await fetch('/api/login', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({password: $('pw').value})});
      if (!r.ok){ $('loginerr').textContent = r.status === 401 ? '비밀번호가 맞지 않아요.' : '로그인 설정을 확인해 주세요.'; return; }
      $('pw').value = ''; $('login').hidden = true; await boot();
    } catch(err){ $('loginerr').textContent = '연결에 문제가 있었어요.'; }
    finally { $('loginbtn').disabled = false; }
  });
  $('logout').onclick = async () => { await fetch('/api/login', {method: 'DELETE'}); location.reload(); };

  /* ── Jarvis: 음성 설정 ── */
  const S = {
    voice: store.get('jd_voice') || '',
    tempo: Math.min(2, Math.max(0.5, parseFloat(store.get('jd_tempo')) || 1.15)),
    pitch: Math.min(6, Math.max(-6, parseInt(store.get('jd_pitch') ?? '-1', 10) || 0)),
    on: store.get('jd_voiceon') !== '0',
    wake: store.get('jd_wake') === '1',
  };
  let voices = [];
  $('voice').setAttribute('aria-pressed', S.on);
  $('vset').hidden = !S.on;
  $('vtempo').value = S.tempo; $('vtempo-o').textContent = S.tempo.toFixed(2) + '×';
  $('vpitch').value = S.pitch; $('vpitch-o').textContent = (S.pitch > 0 ? '+' : '') + S.pitch;
  $('wake').checked = S.wake;
  async function loadVoices(){
    try {
      const r = await api('/api/voices'); voices = r.voices || [];
      if (!voices.some(v => v.id === S.voice)) S.voice = r.default || voices[0]?.id || '';
      const G = {male: '남', female: '여'};
      $('vsel').innerHTML = voices.map(v => `<option value="${esc(v.id)}"${v.id === S.voice ? ' selected' : ''}>${esc(v.name)} · ${G[v.gender] || ''}${v.uses[0] ? ' · ' + esc(v.uses[0]) : ''}</option>`).join('') || '<option value="">목소리 없음</option>';
    } catch(e){ if (e.code !== 401) $('vsel').innerHTML = '<option value="">목소리 목록을 불러오지 못했어요</option>'; }
  }
  $('vtempo').oninput = e => { S.tempo = +e.target.value; $('vtempo-o').textContent = S.tempo.toFixed(2) + '×'; store.set('jd_tempo', S.tempo); };
  $('vpitch').oninput = e => { S.pitch = +e.target.value; $('vpitch-o').textContent = (S.pitch > 0 ? '+' : '') + S.pitch; store.set('jd_pitch', S.pitch); };
  $('vtempo').onchange = $('vpitch').onchange = () => { stopSpeech(); speak('속도와 톤을 맞췄습니다.'); };
  $('voice').onclick = () => { S.on = !S.on; store.set('jd_voiceon', S.on ? '1' : '0'); $('voice').setAttribute('aria-pressed', S.on); $('vset').hidden = !S.on; if (!S.on) stopSpeech(); };

  function orbState(s){
    const o = $('jorb'); ['busy','speaking','listening'].forEach(k => o.classList.toggle(k, s === k));
    document.querySelector('#fab .orb').classList.toggle('speaking', s === 'speaking');
    document.querySelector('#fab .orb').classList.toggle('listening', s === 'listening');
    $('jstat').textContent = {busy: '생각 중…', speaking: '말하는 중', listening: '듣고 있어요…'}[s] || (S.wake && rec ? '"자비스"라고 불러 주세요' : '대기 중');
  }

  /* ── Jarvis: 타입캐스트 음성 큐 (문장마다 미리 받아 순서대로 재생) ── */
  const audioQ = []; let playing = null, speakGen = 0, ttsWarned = false;
  const cleanTxt = t => t.replace(/[*#`_>|•]/g, '').replace(/https?:\/\/\S+/g, '').replace(/₩/g, '').replace(/\s+/g, ' ').trim();
  function stopSpeech(){ speakGen++; audioQ.length = 0; if (playing){ try { playing.pause(); } catch(e){} playing = null; } try { window.speechSynthesis && speechSynthesis.cancel(); } catch(e){} if (!busy && !listening) orbState('idle'); }
  /* 타입캐스트는 동시 요청이 많으면 429로 막는다 → 동시에 최대 2개 (재생 중인 문장 + 다음 문장) */
  const MAX_INFLIGHT = 2; let inflight = 0, ttsBlockedUntil = 0, ttsBlockReason = '';
  function startFetch(it){
    if (it.p) return it.p;
    if (Date.now() < ttsBlockedUntil){ it.p = Promise.reject(new Error('blocked')); it.p.catch(() => {}); return it.p; }
    inflight++;
    it.p = fetch('/api/tts', {method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({text: it.t, tempo: S.tempo, pitch: S.pitch, prev: it.prev})})
      .then(async r => {
        if (!r.ok){
          const j = await r.json().catch(() => ({})); console.warn('tts failed', r.status, j);
          if (r.status === 403 || j.error === 'typecast_blocked'){ ttsBlockedUntil = Date.now() + 15 * 60e3; ttsBlockReason = j.code || String(j.status || r.status); }
          throw new Error('tts ' + r.status);
        }
        return URL.createObjectURL(await r.blob());
      })
      .finally(() => { inflight--; prefetch(); });
    it.p.catch(() => {});
    return it.p;
  }
  function prefetch(){ for (const it of audioQ){ if (inflight >= MAX_INFLIGHT) break; if (!it.p && it.gen === speakGen) startFetch(it); } }
  function say(sentence, prev){
    const t = cleanTxt(sentence); if (!t || !S.on) return;
    audioQ.push({t, prev: cleanTxt(prev || '').slice(-300), gen: speakGen, p: null});
    prefetch();
    if (!playing) pump();
  }
  function browserSay(t, done){
    try { const u = new SpeechSynthesisUtterance(t); u.lang = 'ko-KR'; u.rate = S.tempo; u.onend = u.onerror = done; speechSynthesis.speak(u); } catch(e){ done(); }
  }
  async function pump(){
    const it = audioQ.shift();
    if (!it){ playing = null; if (!busy && !listening) orbState('idle'); return; }
    if (it.gen !== speakGen) return pump();
    playing = {pause(){}};
    let url;
    try { url = await startFetch(it); }
    catch(e){
      if (it.gen !== speakGen) return;
      if (!ttsWarned){ ttsWarned = true; addMsg('sys', Date.now() < ttsBlockedUntil ? `타입캐스트 계정이 제한돼서(${ttsBlockReason}) 당분간 기본 음성으로 읽어요. 유료 API 요금제로 바꾸면 풀려요.` : '타입캐스트 음성을 받지 못해 기본 음성으로 읽어요.'); }
      orbState('speaking'); return browserSay(it.t, () => { playing = null; pump(); });
    }
    if (it.gen !== speakGen){ URL.revokeObjectURL(url); return; }
    const a = new Audio(url); playing = a; orbState('speaking');
    a.onended = a.onerror = () => { URL.revokeObjectURL(url); if (playing === a) playing = null; pump(); };
    a.play().catch(() => { if (playing === a) playing = null; pump(); });
  }
  /* 문장 끝 = 공백/끝이 뒤따르는 . ! ? 또는 줄바꿈. "9.97억" 같은 소수점은 끝으로 보지 않는다 */
  const SENT = /(?:[^.!?。\n]|[.!?。](?!\s|$))*(?:[.!?。](?=\s|$)|\n)/g;
  function splitDone(text){
    let m, last = 0; const out = []; SENT.lastIndex = 0;
    while ((m = SENT.exec(text))){ if (!m[0]){ SENT.lastIndex++; continue; } out.push(text.slice(last, SENT.lastIndex)); last = SENT.lastIndex; }
    return [out, text.slice(last)];
  }
  /* 요청 수를 줄이려고 문장을 ~220자 단위로 묶어서 보낸다 */
  function speak(text){
    const [ss, tail] = splitDone(text + '\n'); let prev = '', buf = '';
    for (const x of [...ss, tail]){ if (buf && (buf + x).length > 220){ say(buf, prev); prev += buf; buf = ''; } buf += x; }
    if (buf) say(buf, prev);
  }
  function streamer(){
    let spoken = 0;
    return {
      push(text){
        const body = /[.!?。]$/.test(text) ? text.slice(0, -1) : text; const [ss] = splitDone(body.slice(spoken));
        const ready = ss.join(''), min = spoken ? 90 : 30;     /* 첫 조각은 빨리, 이후는 묶어서 */
        if (ready.length >= min){ say(ready, text.slice(0, spoken)); spoken += ready.length; }
      },
      end(text){ say(text.slice(spoken), text.slice(0, spoken)); }
    };
  }

  /* ── Jarvis: 창 ── */
  function openJarvis(){
    $('drawer').classList.add('open'); $('drawer').setAttribute('aria-hidden', 'false'); $('scrim').hidden = false; $('fab').hidden = true;
    if (!$('log').children.length) addMsg('j', greeting());
  }
  function closeJarvis(){ $('drawer').classList.remove('open'); $('drawer').setAttribute('aria-hidden', 'true'); $('scrim').hidden = true; $('fab').hidden = false; }
  document.querySelectorAll('[data-open-jarvis]').forEach(b => b.addEventListener('click', openJarvis));
  $('jclose').onclick = closeJarvis; $('scrim').onclick = closeJarvis;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('drawer').classList.contains('open')) closeJarvis(); });
  function greeting(){ const h = hourKST(); return `${h < 11 ? '좋은 아침입니다' : h < 18 ? '안녕하세요' : '좋은 저녁입니다'}, Josh님. 마이크 버튼을 누르고 말씀하시거나, "자비스"라고 부르셔도 됩니다.`; }
  function addMsg(who, text){ const d = document.createElement('div'); d.className = 'msg ' + who; d.textContent = text; $('log').appendChild(d); $('log').scrollTop = $('log').scrollHeight; return d; }

  function localBrief(){
    const h = hourKST(), s = brief?.sales, open = openTodos(), hiT = open.filter(t => t.priority === 'high');
    const now = Date.now(), nx = upcoming().find(e => !e.allDay && Date.parse(e.start) > now);
    let t = `${h < 11 ? '좋은 아침입니다' : '안녕하세요'}, Josh님. ${brief?.headline || ''}\n`;
    if (nx){ const mins = Math.round((Date.parse(nx.start) - now) / 6e4), day = ymdKST(new Date(nx.start)); t += `\n다음 일정은 ${mins < 60 ? mins + '분 후' : (relDay(day) || shortDate(day)) + ' ' + hm(new Date(nx.start))}, ${nx.title.replace(/\[[^\]]+\]\s*/g, '')}입니다.`; }
    if (hiT.length) t += `\n급한 할 일이 ${hiT.length}건 있어요. 먼저 ${hiT.slice(0, 2).map(x => x.title).join(', 그리고 ')}.`;
    if (s){ const tg = s.channels.filter(c => c.target), lag = [...tg].sort((a,b) => a.pct - b.pct)[0], best = [...tg].sort((a,b) => b.pct - a.pct)[0];
      if (lag && best) t += `\n이번 달 매출은 ${krwSpoken(s.total)}으로 목표의 ${Math.round(s.pct)}퍼센트입니다. ${best.platform} ${best.name}이 ${Math.round(best.pct)}퍼센트로 가장 좋고, ${lag.platform} ${lag.name}은 ${Math.round(lag.pct)}퍼센트로 가장 뒤처져 있어요.`; }
    return t;
  }
  function runLocalBrief(){ stopSpeech(); const t = localBrief(); addMsg('me', '오늘 브리핑 읽어줘'); addMsg('j', t); speak(t); }
  $('readbrief').onclick = () => { openJarvis(); runLocalBrief(); };

  /* ── Jarvis: 대화 ── */
  let turns = [], ctl = null, busy = false;
  async function ask(q){
    if (q === '__brief'){ runLocalBrief(); return; }
    if (busy && ctl) ctl.abort();
    stopSpeech();
    addMsg('me', q); turns.push({role: 'user', content: q});
    busy = true; orbState('busy');
    const bubble = addMsg('j', '…'), st = streamer(), acts = [];
    let text = '';
    ctl = new AbortController();
    try {
      const r = await fetch('/api/chat', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({messages: turns.slice(-12)}), signal: ctl.signal});
      if (r.status === 401){ showLogin(); throw new Error('login'); }
      if (!r.ok || !r.body){ const j = await r.json().catch(() => ({})); throw Object.assign(new Error('chat ' + r.status), {friendly: j.error === 'anthropic_not_configured' ? '서버에 Claude API 키가 아직 설정되지 않았어요.' : null}); }
      const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '';
      for (;;){
        const {value, done} = await reader.read(); if (done) break;
        buf += dec.decode(value, {stream: true}); let i;
        while ((i = buf.indexOf('\n')) >= 0){
          const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue;
          let ev; try { ev = JSON.parse(line); } catch(e){ continue; }
          if (ev.t === 'text'){ text += ev.d; bubble.textContent = text.trim() || '…'; $('log').scrollTop = $('log').scrollHeight; st.push(text); }
          else if (ev.t === 'act') acts.push(ev.d);
          else if (ev.t === 'error') addMsg('sys', ev.d);
        }
      }
      st.end(text);
      if (!text.trim()) bubble.remove();
      if (acts.length){ const a = document.createElement('span'); a.className = 'act'; a.textContent = '✓ ' + acts.join(' · '); bubble.appendChild(a); loadData().catch(() => {}); }
      if (text.trim()) turns.push({role: 'assistant', content: text.trim()}); else turns.pop();
    } catch(e){
      if (!text.trim()){ bubble.remove(); turns.pop(); }
      else turns.push({role: 'assistant', content: text.trim()});
      if (e.name !== 'AbortError' && e.message !== 'login') addMsg('sys', e.friendly || '연결에 문제가 있었어요. 다시 말씀해 주세요.');
    } finally { busy = false; if (!playing && !audioQ.length && !listening) orbState('idle'); }
  }
  $('jform').addEventListener('submit', e => { e.preventDefault(); const v = $('jtext').value.trim(); if (!v) return; $('jtext').value = ''; autoH(); ask(v); });
  $('jtext').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); $('jform').requestSubmit(); } });
  function autoH(){ const t = $('jtext'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }
  $('jtext').addEventListener('input', autoH);
  $('quick').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) ask(b.dataset.q); });

  /* ── Jarvis: 마이크 (Web Speech API) ── */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, listening = false, recMode = null;
  const WAKE = /(자비스|쟈비스|자비쓰|jarvis)[\s,.!?]*/i;
  if (!SR){ $('mic').title = '이 브라우저는 음성 인식을 지원하지 않아요 (Chrome·Edge 권장)'; $('wakerow').hidden = true; }
  function stopRec(){ recMode = null; if (rec){ try { rec.abort(); } catch(e){} rec = null; } listening = false; $('mic').setAttribute('aria-pressed', 'false'); }
  function startRec(mode){
    if (!SR){ addMsg('sys', '이 브라우저는 음성 인식을 지원하지 않아요. Chrome이나 Edge로 열어 주세요.'); return; }
    stopRec();
    const r = new SR(); rec = r; recMode = mode;
    r.lang = 'ko-KR'; r.interimResults = true; r.continuous = mode === 'wake'; r.maxAlternatives = 1;
    let armed = false, heard = '';
    r.onresult = e => {
      let fin = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++){ const x = e.results[i]; if (x.isFinal) fin += x[0].transcript; else interim += x[0].transcript; }
      if (mode === 'ptt'){ heard += fin; $('jtext').value = (heard + interim).trim(); autoH(); return; }
      const now = (fin || interim);
      if (!armed && WAKE.test(now)){ armed = true; stopSpeech(); listening = true; orbState('listening'); openJarvis(); }
      if (armed && fin){
        const cmd = fin.split(WAKE).pop().trim();
        if (cmd.length > 1){ armed = false; listening = false; ask(cmd); }
      }
    };
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed'){ addMsg('sys', '마이크 권한이 필요해요. 주소창 왼쪽 자물쇠에서 마이크를 허용해 주세요.'); S.wake = false; $('wake').checked = false; store.set('jd_wake', '0'); recMode = null; }
    };
    r.onend = () => {
      if (rec !== r) return;
      const m = recMode; rec = null; listening = false; $('mic').setAttribute('aria-pressed', 'false');
      if (m === 'ptt'){ const v = $('jtext').value.trim(); if (v){ $('jtext').value = ''; autoH(); ask(v); } else if (!busy) orbState('idle'); if (S.wake) setTimeout(() => startRec('wake'), 400); }
      else if (m === 'wake' && S.wake) setTimeout(() => { if (S.wake && !rec) startRec('wake'); }, 300);
    };
    try { r.start(); } catch(e){ return; }
    if (mode === 'ptt'){ listening = true; stopSpeech(); orbState('listening'); $('mic').setAttribute('aria-pressed', 'true'); }
    else orbState(busy ? 'busy' : 'idle');
  }
  $('mic').onclick = () => { if (recMode === 'ptt'){ try { rec.stop(); } catch(e){} return; } startRec('ptt'); };
  $('wake').onchange = e => { S.wake = e.target.checked; store.set('jd_wake', S.wake ? '1' : '0'); if (S.wake) startRec('wake'); else if (recMode === 'wake') stopRec(); orbState(busy ? 'busy' : 'idle'); };
  document.addEventListener('keydown', e => { /* Ctrl+Space: 바로 말하기 */ if (e.code === 'Space' && e.ctrlKey){ e.preventDefault(); openJarvis(); $('mic').click(); } });

  /* ── boot ── */
  tick(); setInterval(tick, 30000);
  async function boot(){
    await loadData();
    podStatus(); loadWeekly();
    if (S.wake) startRec('wake');
  }
  boot().catch(e => { if (e.code !== 401) toast('데이터를 불러오지 못했어요. 새로고침해 주세요.'); });
  setInterval(() => { if (!document.hidden && $('login').hidden) loadData().catch(() => {}); }, 5 * 60e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && $('login').hidden) loadData().catch(() => {}); });
})();

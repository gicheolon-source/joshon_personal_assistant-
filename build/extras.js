  /* ── 이상 신호 배너 ── */
  let alerts = null, team = null, memory = [];
  function renderAlerts(){
    const items = alerts?.items || [];
    $('alertbar').hidden = !items.length;
    $('alertbar').innerHTML = items.length ? `<b>확인할 것 ${items.length}</b>` + items.slice(0, 6).map(a => `<span class="al al-${esc(a.kind)}">${esc(a.title)}<small>${esc(a.body || '')}</small></span>`).join('') : '';
  }

  /* ── 팀 할 일 (틱톡샵 대시보드에서 읽기 전용) ── */
  function renderTeam(){
    if (!team?.members){ $('teamlist').innerHTML = '<div class="empty sm">팀 할 일을 불러오지 못했어요</div>'; return; }
    $('team-meta').textContent = `틱톡샵 대시보드 · ${md(team.date)}`;
    $('teamlist').innerHTML = team.members.filter(m => m.code !== 'okc').map(m => {
      const d = m.today || [], done = d.filter(x => x.done).length;
      const w = (m.weekly || []).filter(x => !x.done).slice(0, 3);
      return `<div class="tm-mem"><div class="tm-h"><span class="ava" style="background:${hashColor(m.name)}">${esc(m.name.slice(-2))}</span><b>${esc(m.name)}</b><span class="meta">오늘 ${done}/${d.length}</span></div>
        <ul>${d.length ? d.map(x => `<li class="${x.done ? 'done' : ''}">${x.done ? '✓' : '○'} ${esc(x.text)}</li>`).join('') : '<li class="none">오늘 할 일 없음</li>'}</ul>
        ${w.length ? `<div class="tm-w">주간: ${w.map(x => esc(x.text)).join(' · ')}</div>` : ''}</div>`;
    }).join('');
  }

  /* ── Jarvis 기억 ── */
  function renderMemory(){
    $('memcount').textContent = memory.length ? `(${memory.length})` : '';
    $('memlist').innerHTML = memory.length ? memory.map(m => `<li data-mid="${esc(m.id)}">${esc(m.text)} <button type="button" class="x" aria-label="잊기" title="잊기">×</button></li>`).join('') : '<li class="none">"UK는 GMV 기준으로 말해줘, 기억해"처럼 말하면 여기에 저장돼요.</li>';
  }
  $('memlist').addEventListener('click', async e => {
    const b = e.target.closest('.x'); if (!b) return;
    const id = b.closest('li').dataset.mid;
    try { await api('/api/data', {method: 'DELETE', body: JSON.stringify({memoryId: id})}); memory = memory.filter(m => m.id !== id); renderMemory(); } catch(err){ onWriteErr(err); }
  });

  /* ── 아침 팟캐스트 ── */
  let podPoll = null, podScript = '';
  function readWithBrowser(text){
    try { speechSynthesis.cancel(); for (const s of (text.match(/[^.!?\n]+[.!?]?/g) || [text])){ const u = new SpeechSynthesisUtterance(s.trim()); u.lang = 'ko-KR'; u.rate = S.tempo; speechSynthesis.speak(u); } } catch(e){ toast('이 기기에서는 음성 읽기를 쓸 수 없어요.'); }
  }
  async function podStatus(){
    try {
      const m = await api('/api/podcast?meta=1');
      const btn = $('podbtn');
      clearTimeout(podPoll);
      if (m.status === 'ready'){ btn.dataset.state = 'ready'; btn.querySelector('span').textContent = '🎧 아침 팟캐스트 듣기'; $('podnote').textContent = `${Math.round((m.bytes || 0) / 16000 / 60 * 10) / 10 || ''}분 · ${when(m.createdAt)} 생성`; }
      else if (m.status === 'building'){ btn.dataset.state = 'building'; btn.querySelector('span').textContent = '🎧 팟캐스트 만드는 중…'; $('podnote').textContent = '30초~1분 걸려요'; podPoll = setTimeout(podStatus, 5000); }
      else if (m.status === 'script_only'){ btn.dataset.state = 'script'; podScript = m.script || ''; btn.querySelector('span').textContent = '🎧 아침 브리핑 듣기 (기본 음성)'; $('podnote').textContent = '타입캐스트가 제한돼 기기 음성으로 읽어요'; }
      else if (m.status === 'error'){ btn.dataset.state = 'error'; btn.querySelector('span').textContent = '🎧 팟캐스트 다시 만들기'; $('podnote').textContent = '실패: ' + (m.error || ''); }
      else { btn.dataset.state = 'none'; btn.querySelector('span').textContent = '🎧 오늘 팟캐스트 만들기'; $('podnote').textContent = '타입캐스트 라이언 목소리 · 하루 1번'; }
    } catch(e){}
  }
  $('podbtn').onclick = async () => {
    const st = $('podbtn').dataset.state;
    if (st === 'building') return;
    if (st === 'script'){ stopSpeech(); if (window.speechSynthesis?.speaking){ speechSynthesis.cancel(); return; } readWithBrowser(podScript); return; }
    if (st === 'ready'){ stopSpeech(); const a = $('podaudio'); a.hidden = false; if (!a.src) a.src = '/api/podcast?t=' + Date.now(); a.play().catch(() => {}); return; }
    $('podbtn').dataset.state = 'building'; $('podbtn').querySelector('span').textContent = '🎧 팟캐스트 만드는 중…'; $('podnote').textContent = '30초~1분 걸려요';
    try { await api('/api/podcast' + (st === 'error' ? '?force=1' : ''), {method: 'POST'}); } catch(e){}
    podStatus();
  };

  /* ── 주간 리포트 ── */
  async function loadWeekly(){ try { const w = await api('/api/weekly'); showWeekly(w); } catch(e){} }
  function showWeekly(w){
    if (w?.status === 'ready'){ $('weeklytext').textContent = w.text; $('weeklytext').hidden = false; $('weeklycopy').hidden = false; $('weekly-meta').textContent = `${md(w.week)} 주 · ${when(w.createdAt)} 작성`; $('weeklybtn').textContent = '다시 쓰기'; }
    else { $('weekly-meta').textContent = '금요일에 만들면 가장 정확해요'; }
  }
  $('weeklybtn').onclick = async () => {
    const b = $('weeklybtn'); b.disabled = true; const old = b.textContent; b.textContent = '작성 중… (30초쯤)';
    try { showWeekly(await api('/api/weekly', {method: 'POST'})); } catch(e){ toast('리포트를 만들지 못했어요.'); b.textContent = old; }
    finally { b.disabled = false; }
  };
  $('weeklycopy').onclick = async () => {
    try { await navigator.clipboard.writeText($('weeklytext').textContent); $('weeklycopy').textContent = '복사됨 ✓'; setTimeout(() => { $('weeklycopy').textContent = '복사'; }, 1500); }
    catch(e){ const r = document.createRange(); r.selectNodeContents($('weeklytext')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  };

  /* ── 폰 앱(PWA) + 알림 ── */
  let swReg = null;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').then(r => { swReg = r; pushState(); }).catch(() => {});
  const b64u = s => { const p = '='.repeat((4 - s.length % 4) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
  async function pushState(){
    const btn = $('pushbtn'); if (!btn) return;
    if (!swReg || !('PushManager' in window)){ btn.hidden = !/iPhone|iPad/.test(navigator.userAgent); btn.textContent = '🔔 알림: 홈 화면에 추가 후 사용'; btn.disabled = true; return; }
    const sub = await swReg.pushManager.getSubscription();
    btn.hidden = false; btn.disabled = false;
    btn.textContent = sub ? '🔔 알림 켜짐 · 테스트' : '🔔 폰 알림 켜기';
    btn.dataset.on = sub ? '1' : '';
  }
  $('pushbtn').onclick = async () => {
    const btn = $('pushbtn');
    try {
      if (btn.dataset.on){ const r = await api('/api/push', {method: 'POST', body: JSON.stringify({test: true})}); toast(r.sent ? '테스트 알림을 보냈어요.' : '알림을 보내지 못했어요.'); return; }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted'){ toast('알림 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요.'); return; }
      const {publicKey} = await api('/api/push');
      const sub = await swReg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: b64u(publicKey)});
      await api('/api/push', {method: 'POST', body: JSON.stringify({subscription: sub.toJSON()})});
      toast('알림을 켰어요. 급한 일이 생기면 여기로 알려드릴게요.');
      pushState();
    } catch(e){ toast('알림을 켜지 못했어요.'); console.warn(e); }
  };

  /* ── 연결 상태 (구글 · 슬랙 · 아마존 유럽) ── */
  let conns = null;
  function renderConns(){
    const c = conns || {}, g = c.google || {};
    const row = (ok, name, detail, action) => `<li class="${ok ? 'on' : ''}"><i>${ok ? '●' : '○'}</i><span>${name}<small>${detail}</small></span>${action || ''}</li>`;
    $('conns').innerHTML =
      row(g.connected, '구글', g.connected ? 'Gmail·캘린더·드라이브' : '연결하면 메일·일정·매출시트를 직접 읽어요', g.connected ? '' : '<a href="/api/google?action=start">연결</a>') +
      row(c.slack, '슬랙', c.slack ? '채널·DM·멘션' : '사용자 토큰 필요') +
      row((c.amazon || []).length > 1, '아마존', (c.amazon || []).map(k => ({NA: '북미', EU: '유럽·중동', JP: '일본', AU: '호주'})[k] || k).join('·') || '미연결');
    const full = g.connected || c.slack;
    $('refreshbtn').title = full ? '메일·슬랙·캘린더·매출까지 전부 새로 가져와요 (1분쯤)' : '아마존 매출·팀 할 일을 지금 새로 가져와요';
  }
  (() => { const gq = new URLSearchParams(location.search).get('google'); if (gq === 'connected'){ setTimeout(() => toast('구글을 연결했어요. 이제 "지금 업데이트"로 메일·일정까지 새로 가져와요.'), 800); history.replaceState(null, '', '/'); } })();

  /* ── 지금 업데이트: 구글·슬랙이 연결돼 있으면 전체(메일·슬랙·캘린더·매출·Flex), 아니면 아마존·팀 할 일만 ── */
  $('refreshbtn').onclick = async () => {
    const b = $('refreshbtn'); if (b.disabled) return;
    const full = conns?.google?.connected || conns?.slack;
    b.disabled = true; b.classList.add('spin'); const label = b.lastChild; const old = label.textContent; label.textContent = full ? ' 업데이트 중… (1분쯤)' : ' 업데이트 중…';
    try {
      const j = await api('/api/data', {method: 'POST', body: JSON.stringify({refresh: true})});
      brief = j.brief; todos = j.todos || []; flex = j.flex || []; alerts = j.alerts; team = j.team; memory = j.memory || []; conns = j.connections;
      renderBrief(); renderTodos(); renderFlex(); renderAlerts(); renderTeam(); renderMemory(); renderConns(); podStatus();
      const r = j.refreshed || {};
      if (r.full){
        if (r.busy) toast('이미 업데이트 중이에요. 잠시 후 다시 확인해 주세요.');
        else if (r.ok === false) toast('업데이트 중 문제가 있었어요: ' + (r.error || ''));
        else { const c = r.counts || {}; const fails = Object.entries(r.sources || {}).filter(([, v]) => String(v).startsWith('실패')).map(([k]) => k); toast(`전부 새로 가져왔어요 · 메일 ${c.emails} · 메시지 ${c.messages} · 일정 ${c.calendar} · 새 할 일 ${r.ingest?.added ?? 0}${fails.length ? ' · 실패: ' + fails.join(', ') : ''}`); }
      } else {
        const got = [r.amazon && '아마존 매출', r.team && '팀 할 일'].filter(Boolean);
        toast((got.length ? got.join('·') + '을 새로 가져왔어요. ' : '') + (brief?.generatedAt ? `메일·슬랙 요약은 ${when(brief.generatedAt)} 기준이에요.` : ''));
      }
    } catch(e){ if (e.code !== 401) toast('업데이트하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { b.disabled = false; b.classList.remove('spin'); label.textContent = old; }
  };

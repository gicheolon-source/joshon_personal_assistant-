  let flex = [];
  /* ── 할 일: 캘린더형 (오늘 / 주간 / 월간) ── */
  let tView = store.get('jd_tview') || 'day', sel = ymdKST(new Date()), showDone = false;
  const WDS = ['월','화','수','목','금','토','일'];
  const dow = ymd => (new Date(ymd + 'T00:00:00Z').getUTCDay() + 6) % 7;           // 월=0
  const weekStart = ymd => addDays(ymd, -dow(ymd));
  const monthStart = ymd => ymd.slice(0, 8) + '01';
  const dim = ymd => new Date(+ymd.slice(0, 4), +ymd.slice(5, 7), 0).getDate();
  const addMonths = (ymd, n) => { const d = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1 + n, 1)); return d.toISOString().slice(0, 10); };
  const todayY = () => ymdKST(new Date());
  function leavesOn(ymd){ return (flex || []).filter(f => f.kind === 'leave' && !f.cancelled && f.start && f.start <= ymd && (f.end || f.start) >= ymd); }
  const byPrio = (a, b) => (PRANK[a.priority]??3) - (PRANK[b.priority]??3) || String(a.createdAt).localeCompare(String(b.createdAt));
  const visible = t => (showDone || !t.done) && match(t.title, t.note);

  function todoRow(t, opts = {}){
    const u = safeUrl(t.sourceUrl), today = todayY(), over = t.due && !t.done && t.due < today;
    return `<li class="trow${t.done?' done':''}${opts.compact?' compact':''}" data-id="${esc(t.id)}">
      <input type="checkbox" id="cb-${esc(t.id)}" ${t.done?'checked':''} aria-label="완료 표시">
      <div style="min-width:0"><label class="tt" for="cb-${esc(t.id)}">${esc(t.title)}</label>
        <div class="tm"><span class="pill p-${t.priority||'mid'}">${PRIO[t.priority]||'보통'}</span>
          <label class="duechip${over?' over':''}${t.due?'':' none'}" title="날짜 바꾸기">${t.due ? esc((relDay(t.due) || shortDate(t.due))) + (over ? ' · 지남' : '') : '날짜 정하기'}<input type="date" class="duein" value="${esc(t.due||'')}" aria-label="날짜"></label>
          ${!t.done ? `<button type="button" class="mini" data-act="tmr" title="내일로 미루기">내일로</button>` : ''}
          ${opts.compact ? '' : `<span>${esc(SRC[t.source]||t.source||'')}</span>${t.note ? `<span>${esc(t.note)}</span>` : ''}`}
          ${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">원문</a>` : ''}</div></div>
      <button class="x" type="button" aria-label="삭제" title="삭제">×</button></li>`;
  }
  const leaveChips = ymd => leavesOn(ymd).map(f => `<span class="leave" title="${esc(f.what || '휴가')}${f.done ? '' : ' · 결재 대기'}">🌴 ${esc(f.who)}${f.done ? '' : ' (대기)'}</span>`).join('');

  function renderTodos(){
    const today = todayY(), open = openTodos();
    const hi = open.filter(t => t.priority === 'high').length;
    setChip('k-todo', hi, hi > 0); badge('todo', hi);
    document.querySelectorAll('#tview button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === tView));
    $('showdone').checked = showDone;
    let label = '', html = '';
    if (tView === 'day'){
      const r = relDay(sel);
      label = `${+sel.slice(5,7)}월 ${+sel.slice(8,10)}일 (${WD[new Date(sel + 'T00:00:00Z').getUTCDay()]})${r ? ' · ' + r : ''}`;
      const dayItems = todos.filter(t => t.due === sel && visible(t)).sort(byPrio);
      const overdue = sel === today ? todos.filter(t => !t.done && t.due && t.due < today && match(t.title, t.note)).sort((a,b) => a.due.localeCompare(b.due)) : [];
      const undated = sel === today ? todos.filter(t => !t.due && visible(t)).sort(byPrio) : [];
      const lv = leaveChips(sel);
      if (lv) html += `<li class="grp-h">팀 휴가 <span class="leaves">${lv}</span></li>`;
      if (overdue.length) html += `<li class="grp-h over">밀린 할 일 ${overdue.length}</li>` + overdue.map(t => todoRow(t)).join('');
      html += `<li class="grp-h">${r || shortDate(sel)} ${dayItems.length}건</li>` + (dayItems.length ? dayItems.map(t => todoRow(t)).join('') : '<li class="empty sm">이 날 할 일이 없어요</li>');
      if (undated.length) html += `<li class="grp-h">날짜 미정 ${undated.length}</li>` + undated.map(t => todoRow(t)).join('');
      $('todos').className = 'tlist';
    } else if (tView === 'week'){
      const ws = weekStart(sel), we = addDays(ws, 6);
      label = `${md(ws)} – ${md(we)}${ws <= today && today <= we ? ' · 이번 주' : ''}`;
      for (let i = 0; i < 7; i++){
        const d = addDays(ws, i), items = todos.filter(t => t.due === d && visible(t)).sort(byPrio), lv = leaveChips(d);
        html += `<li class="grp-h wk${d === today ? ' today' : ''}"><button type="button" class="dlink" data-day="${d}">${WDS[i]} ${md(d)}${d === today ? ' · 오늘' : ''}</button> <span class="cnt">${items.length || ''}</span> <span class="leaves">${lv}</span></li>`
          + items.map(t => todoRow(t, {compact: true})).join('');
      }
      const und = todos.filter(t => !t.due && visible(t));
      if (und.length) html += `<li class="grp-h">날짜 미정 ${und.length}</li>` + und.sort(byPrio).map(t => todoRow(t, {compact: true})).join('');
      $('todos').className = 'tlist';
    } else {
      const ms = monthStart(sel), n = dim(ms), lead = dow(ms);
      label = `${ms.slice(0,4)}년 ${+ms.slice(5,7)}월`;
      let cells = WDS.map(w => `<div class="mh">${w}</div>`).join('') + '<div class="mc blank"></div>'.repeat(lead);
      for (let i = 0; i < n; i++){
        const d = addDays(ms, i), items = todos.filter(t => t.due === d && visible(t)), lv = leavesOn(d);
        const openN = items.filter(t => !t.done), hiN = openN.filter(t => t.priority === 'high').length;
        const dots = openN.slice(0, 4).map(t => `<i class="d-${t.priority||'mid'}"></i>`).join('');
        cells += `<button type="button" class="mc${d === today ? ' today' : ''}${d < today ? ' past' : ''}" data-day="${d}" aria-label="${md(d)} 할 일 ${items.length}건">
          <b>${i + 1}</b><span class="dots">${dots}</span>${openN.length ? `<span class="n${hiN ? ' hot' : ''}">${openN.length}</span>` : ''}${lv.length ? `<span class="lv" title="${esc(lv.map(f => f.who).join(', '))} 휴가">🌴${lv.length > 1 ? lv.length : ''}</span>` : ''}</button>`;
      }
      html = `<li class="mgrid">${cells}</li>`;
      $('todos').className = 'tlist month';
    }
    $('tlabel').textContent = label;
    $('todos').innerHTML = html;
    if (tView === 'day') $('newdue').value = sel;
    else if (!$('newdue').dataset.touched) $('newdue').value = '';
    $('todo-meta').textContent = `진행 중 ${open.length}`;
  }
  $('tview').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; tView = b.dataset.v; store.set('jd_tview', tView); renderTodos(); });
  $('tprev').onclick = () => { sel = tView === 'day' ? addDays(sel, -1) : tView === 'week' ? addDays(sel, -7) : addMonths(monthStart(sel), -1); renderTodos(); };
  $('tnext').onclick = () => { sel = tView === 'day' ? addDays(sel, 1) : tView === 'week' ? addDays(sel, 7) : addMonths(monthStart(sel), 1); renderTodos(); };
  $('ttoday').onclick = () => { sel = todayY(); renderTodos(); };
  $('showdone').onchange = e => { showDone = e.target.checked; renderTodos(); };
  $('newdue').addEventListener('input', e => { e.target.dataset.touched = '1'; });

  const pending = new Set();
  async function patchTodo(id, patch){
    const t = todos.find(x => x.id === id); const prev = t && {...t};
    if (t){ Object.assign(t, patch); if ('done' in patch) t.doneAt = patch.done ? new Date().toISOString() : null; renderTodos(); }
    try { await api('/api/todos', {method: 'PATCH', body: JSON.stringify({id, ...patch})}); }
    catch(err){ if (t && prev) Object.assign(t, prev); renderTodos(); onWriteErr(err); }
  }
  async function addTodo(title, priority, due){
    const t = await api('/api/todos', {method: 'POST', body: JSON.stringify({title, priority, due})});
    todos.push(t); renderTodos(); return t.id;
  }
  $('todos').addEventListener('change', async e => {
    const row = e.target.closest('.trow'); if (!row) return;
    const id = row.dataset.id;
    if (e.target.type === 'checkbox'){ if (pending.has(id)) return; pending.add(id); await patchTodo(id, {done: e.target.checked}); pending.delete(id); }
    else if (e.target.classList.contains('duein')) patchTodo(id, {due: e.target.value || ''});
  });
  $('todos').addEventListener('click', async e => {
    const day = e.target.closest('[data-day]');
    if (day){ sel = day.dataset.day; tView = 'day'; store.set('jd_tview', tView); renderTodos(); return; }
    const mini = e.target.closest('[data-act="tmr"]');
    if (mini){ const id = mini.closest('.trow').dataset.id, t = todos.find(x => x.id === id); const base = t && t.due && t.due >= todayY() ? t.due : todayY(); patchTodo(id, {due: addDays(base, 1)}); return; }
    const b = e.target.closest('.x'); if (!b) return;
    const id = b.closest('.trow').dataset.id;
    if (b.dataset.armed !== '1'){ b.dataset.armed = '1'; b.textContent = '삭제?'; b.style.fontSize = '12px'; setTimeout(() => { if (b.isConnected){ b.dataset.armed = ''; b.textContent = '×'; b.style.fontSize = ''; } }, 3000); return; }
    try { await api('/api/todos', {method: 'DELETE', body: JSON.stringify({id})}); todos = todos.filter(t => t.id !== id); renderTodos(); } catch(err){ onWriteErr(err); }
  });
  $('addform').addEventListener('submit', async e => {
    e.preventDefault(); const title = $('newtodo').value.trim(); if (!title) return;
    $('addbtn').disabled = true;
    try { await addTodo(title, $('newprio').value, $('newdue').value); $('newtodo').value = ''; delete $('newdue').dataset.touched; } catch(err){ onWriteErr(err); } finally { $('addbtn').disabled = false; }
  });
  function onWriteErr(err){ if (err && err.code !== 401) toast('저장하지 못했어요. 잠시 후 다시 시도해 주세요.'); console.warn('write failed', err); }

  /* ── Flex 결재 ── */
  let fView = 'pending';
  const FK = {leave: '휴가', work: '근무', doc: '문서'};
  function flexLine(f){
    let what = '', when = '';
    if (f.kind === 'leave'){ what = f.what || '휴가'; when = f.start ? (f.end && f.end !== f.start ? `${md(f.start)}~${md(f.end)}` : shortDate(f.start)) + (f.days ? ` · ${f.days}` : '') : ''; }
    else if (f.kind === 'work'){ what = f.what || '근무'; when = f.workDate ? md(f.workDate) + ' 근무' : ''; }
    else what = f.what || '문서';
    return `<li class="frow${f.done ? ' done' : ''}${f.cancelled ? ' cancelled' : ''}" data-fid="${esc(f.id)}">
      <input type="checkbox" ${f.done ? 'checked' : ''} aria-label="처리함 표시" title="Flex에서 처리했으면 체크">
      <div style="min-width:0"><div><b>${esc(f.who)}</b> <span class="fw">${esc(what)}</span>${f.cancelled ? ' <span class="pill p-low">취소됨</span>' : ''}${f.ref ? ' <span class="pill p-low">참조</span>' : ''}</div>
        <div class="tm">${when ? `<span>${esc(when)}</span>` : ''}${f.reason && f.reason !== '-' ? `<span>${esc(f.reason)}</span>` : ''}<span>요청 ${esc(when2(f.requestedAt))}</span>${safeUrl(f.url) ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">메일</a>` : ''}</div></div></li>`;
  }
  const when2 = iso => iso ? md(ymdKST(new Date(iso))) : '';
  function renderFlex(){
    const all = (flex || []).filter(f => match(f.who, f.what, f.reason));
    const pend = all.filter(f => !f.done && !f.cancelled && !f.ref);
    badge('flex', pend.length);
    $('fl-pend').textContent = `대기 ${pend.length}`;
    document.querySelectorAll('#fview button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === fView));
    const list = fView === 'pending' ? pend : all.filter(f => f.done || f.cancelled || f.ref).slice(0, 60);
    let html = '';
    for (const k of ['leave', 'doc', 'work']){
      const items = list.filter(f => f.kind === k).sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)));
      if (!items.length) continue;
      html += `<li class="grp-h">${FK[k]} ${items.length}${fView === 'pending' && items.length > 1 ? ` <button type="button" class="mini" data-bulk="${k}">모두 처리함</button>` : ''}</li>` + items.map(flexLine).join('');
    }
    $('flexlist').innerHTML = html || `<li class="empty">${fView === 'pending' ? '대기 중인 결재가 없어요' : '처리한 항목이 없어요'}</li>`;
    const today = todayY();
    const up = (flex || []).filter(f => f.kind === 'leave' && !f.cancelled && f.start && (f.end || f.start) >= today).sort((a, b) => a.start.localeCompare(b.start));
    $('leaves').innerHTML = up.length ? up.map(f => `<li><span class="ld">${esc(f.end && f.end !== f.start ? `${md(f.start)}~${md(f.end)}` : shortDate(f.start))}</span><b>${esc(f.who)}</b><span class="fw">${esc(f.what || '휴가')}${f.days ? ' ' + esc(f.days) : ''}</span>${f.done || f.ref ? '' : '<span class="pill p-mid">결재 대기</span>'}</li>`).join('') : '<li class="empty sm">예정된 팀 휴가가 없어요</li>';
  }
  $('fview').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; fView = b.dataset.v; renderFlex(); });
  async function setFlexDone(ids, done){
    for (const f of flex) if (ids.includes(f.id)) f.done = done;
    renderFlex(); renderTodos();
    try { await api('/api/flex', {method: 'PATCH', body: JSON.stringify({ids, done})}); } catch(err){ onWriteErr(err); loadData().catch(() => {}); }
  }
  $('flexlist').addEventListener('change', e => { const r = e.target.closest('.frow'); if (r && e.target.type === 'checkbox') setFlexDone([r.dataset.fid], e.target.checked); });
  $('flexlist').addEventListener('click', e => {
    const b = e.target.closest('[data-bulk]'); if (!b) return;
    if (b.dataset.armed !== '1'){ b.dataset.armed = '1'; b.textContent = '정말 모두?'; setTimeout(() => { if (b.isConnected){ b.dataset.armed = ''; b.textContent = '모두 처리함'; } }, 3000); return; }
    setFlexDone(flex.filter(f => f.kind === b.dataset.bulk && !f.done && !f.cancelled && !f.ref).map(f => f.id), true);
  });

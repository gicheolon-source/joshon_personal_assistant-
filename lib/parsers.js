/* 서버 측 파서: 클라우드 루틴이 보낸 원본을 해석한다.
   - parseSalesCsv: "Global MD 26년 매출 시트" CSV → 이번 달 채널·국가별 매출(₩)
   - parseFlexMessages: Flex 알림 메일 목록 → {items, cancels} */

function parseCSV(t) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const num = s => { const v = Number(String(s || '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(v) ? v : 0; };
const has = s => String(s || '').trim() !== '';
const FLAG = { US: '🇺🇸', CA: '🇨🇦', UK: '🇬🇧', AU: '🇦🇺', AE: '🇦🇪', 'EU (DE 제외)': '🇪🇺',
  '틱톡샵 US': '🇺🇸', '틱톡샵 UK': '🇬🇧', '쇼피 싱가포르': '🇸🇬', '쇼피 말레이시아': '🇲🇾', '쇼피 대만': '🇹🇼',
  '쇼피 필리핀': '🇵🇭', '쇼피 베트남': '🇻🇳', '쇼피 브라질': '🇧🇷', '쇼피 맥시코': '🇲🇽' };

/* Josh 담당: 아마존 + 틱톡샵 + 퍼포먼스 마케팅팀만. 쇼피는 제외 (2026-09-28) */
const EXCLUDE = /쇼피|shopee/i;

export function parseSalesCsv(csv, now = new Date()) {
  const blocks = []; let cur = null, group = '';
  for (const r of parseCSV(String(csv || ''))) {
    const m = /^(\d{4})년 (\d+)월/.exec(r[1] || '');
    if (m) { cur = { month: `${m[1]}-${String(m[2]).padStart(2, '0')}`, lines: [] }; blocks.push(cur); group = ''; continue; }
    if (!cur || !has(r[2])) continue;
    if (has(r[1])) group = r[1].trim();
    const name = r[2].trim();
    cur.lines.push({ group, name, subtotal: /소계/.test(name), total: num(r[3]), target: num(r[5]), daily: r.slice(9).map(v => (has(v) ? num(v) : null)) });
  }
  const ym = new Date(now.getTime() + 9 * 36e5).toISOString().slice(0, 7);
  const bi = blocks.findIndex(b => b.month === ym);
  if (bi < 0) throw new Error('매출 시트에 이번 달(' + ym + ') 블록이 없어요');
  const thisM = blocks[bi], prevM = blocks[bi - 1];
  const dim = new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate();
  let lastDay = 0; const channels = [];
  for (const l of thisM.lines) {
    if (l.subtotal || EXCLUDE.test(l.group) || EXCLUDE.test(l.name)) continue;
    let ld = 0; l.daily.forEach((v, i) => { if (v) ld = i + 1; });
    lastDay = Math.max(lastDay, ld);
    const daily = l.daily.slice(0, ld).map(v => v || 0);
    const total = l.total || daily.reduce((a, b) => a + b, 0);
    if (!total && !l.target) continue;
    const prev = prevM?.lines.find(p => p.group === l.group && p.name === l.name);
    channels.push({
      platform: l.group, name: l.name.replace(/^(틱톡샵|쇼피) /, ''), flag: FLAG[l.name] || '',
      total, target: l.target, pct: l.target ? Math.round(total / l.target * 1000) / 10 : null,
      through: ld ? `${ym}-${String(ld).padStart(2, '0')}` : null,
      last: daily[ld - 1] || 0, prevDay: daily[ld - 2] || 0,
      pace: ld ? Math.round(total / ld * dim) : 0, daily: daily.slice(-14), prevMonthTotal: prev?.total || null,
    });
  }
  if (!channels.length) throw new Error('매출 시트에서 채널을 찾지 못했어요');
  const total = channels.reduce((a, c) => a + c.total, 0), target = channels.reduce((a, c) => a + (c.target || 0), 0);
  return { month: ym, currency: 'KRW', source: 'Global MD 26년 매출 시트', dataThrough: `${ym}-${String(lastDay).padStart(2, '0')}`,
    daysInMonth: dim, total, target, pct: target ? Math.round(total / target * 1000) / 10 : null,
    pace: lastDay ? Math.round(total / lastDay * dim) : 0, channels };
}

/* ── Flex ── */
const decode = s => String(s || '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const d8 = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dates = s => [...String(s).matchAll(/(\d{4})년 (\d{1,2})월 (\d{1,2})일/g)].map(m => d8(m[1], m[2], m[3]));
const gmailUrl = id => { try { return `https://mail.google.com/mail/?authuser=gicheol.on@neosimplix.com#all/thread-f:${BigInt('0x' + id)}`; } catch { return null; } };

/* messages: [{id, date, subject, snippet, sender?, viewUrl?}] */
export function parseFlexMessages(messages) {
  const items = [], cancels = [], seen = new Set();
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || !m.id || seen.has(m.id)) continue;
    if (m.sender && !/flex\.team/i.test(m.sender)) continue;
    seen.add(m.id);
    const subj = decode(m.subject), snip = decode(m.snippet);
    const base = { id: String(m.id).replace(/[^\w-]/g, ''), requestedAt: m.date || null, url: (/^https:\/\//.test(m.viewUrl || '') ? m.viewUrl : gmailUrl(m.id)), ref: /^\(참조\)/.test(subj) };
    let r;
    if ((r = /^(?:\(참조\)\s*)?(.+?)님이 휴가\((.+?)\) 사용을 취소했어요/.exec(subj))) { for (const d of dates(snip)) cancels.push({ who: r[1], date: d }); continue; }
    if ((r = /^(?:\(참조\)\s*)?(.+?)님(?:이|의) 휴가\((.+?)\)/.exec(subj)) && !/승인되었어요/.test(subj)) {
      const ds = dates(/사용 기간 (.+?) 사용 시간/.exec(snip)?.[1] || snip);
      items.push({ ...base, kind: 'leave', who: r[1], what: r[2], start: ds[0] || null, end: ds[1] || ds[0] || null,
        days: /사용 시간 ([\d.]+일)/.exec(snip)?.[1] || '', reason: (/사유 (.*?) 확인하기/.exec(snip)?.[1] || '').slice(0, 200) });
      continue;
    }
    if (/^문서 승인 요청/.test(snip) && (r = /^(.+?)님이 [‘'](.+?)[’'] 승인을 요청했어요/.exec(subj))) { items.push({ ...base, kind: 'doc', who: r[1], what: r[2] }); continue; }
    if (/^근무 승인 요청/.test(snip) && (r = /^(.+?)님이 (.+?) 승인을 요청했어요/.exec(subj))) {
      items.push({ ...base, kind: 'work', who: r[1], what: /내용 (.+?) 근무일/.exec(snip)?.[1] || r[2],
        workDate: dates(/근무일 (.+?)(?: 메모|$)/.exec(snip)?.[1] || '')[0] || null, reason: (/메모 (.*?) 확인하기/.exec(snip)?.[1] || '').slice(0, 200) });
    }
  }
  return { items, cancels };
}

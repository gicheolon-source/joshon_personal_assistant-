/* Amazon SP-API Sales orderMetrics — 계정별(북미·유럽/중동·일본·호주) 일별 매출. 리포트 대기 없는 동기 호출.
   계정마다 LWA 앱 키와 셀러센트럴 승인 토큰이 다를 수 있다:
     북미  SP_CLIENT_ID / SP_CLIENT_SECRET / SP_REFRESH_TOKEN          (US·CA·MX·BR)
     유럽  SP_EU_CLIENT_ID / SP_EU_CLIENT_SECRET / SP_EU_REFRESH_TOKEN (UK·EU·IE·AE·SA …)
     일본  SP_JP_*  ·  호주  SP_AU_*                                    (극동 서버)
   _CLIENT_ID/_SECRET 이 없으면 북미 앱 키를 쓴다. 각 계정은 marketplaceParticipations로 실제 입점한 마켓만 조회. */
const ACCOUNTS = [
  { key: 'NA', region: 'NA', endpoint: 'https://sellingpartnerapi-na.amazon.com', prefix: 'SP_' },
  { key: 'EU', region: 'EU', endpoint: 'https://sellingpartnerapi-eu.amazon.com', prefix: 'SP_EU_' },
  { key: 'JP', region: 'FE', endpoint: 'https://sellingpartnerapi-fe.amazon.com', prefix: 'SP_JP_' },
  { key: 'AU', region: 'FE', endpoint: 'https://sellingpartnerapi-fe.amazon.com', prefix: 'SP_AU_' },
];
const cred = a => ({ id: process.env[a.prefix + 'CLIENT_ID'] || process.env.SP_CLIENT_ID, secret: process.env[a.prefix + 'CLIENT_SECRET'] || process.env.SP_CLIENT_SECRET, refresh: process.env[a.prefix + 'REFRESH_TOKEN'] });
export const configuredAccounts = () => ACCOUNTS.filter(a => cred(a).refresh).map(a => a.key);
export const MARKETS = {
  US: { id: 'ATVPDKIKX0DER', region: 'NA', symbol: '$', iso: 'USD', tz: 'America/Los_Angeles', name: '미국', flag: '🇺🇸' },
  CA: { id: 'A2EUQ1WTGCTBG2', region: 'NA', symbol: 'C$', iso: 'CAD', tz: 'America/Los_Angeles', name: '캐나다', flag: '🇨🇦' },
  MX: { id: 'A1AM78C64UM0Y8', region: 'NA', symbol: 'MX$', iso: 'MXN', tz: 'America/Los_Angeles', name: '멕시코', flag: '🇲🇽' },
  BR: { id: 'A2Q3Y263D00KWC', region: 'NA', symbol: 'R$', iso: 'BRL', tz: 'America/Sao_Paulo', name: '브라질', flag: '🇧🇷' },
  UK: { id: 'A1F83G8C2ARO7P', region: 'EU', symbol: '£', iso: 'GBP', tz: 'Europe/London', name: '영국', flag: '🇬🇧' },
  DE: { id: 'A1PA6795UKMFR9', region: 'EU', symbol: '€', iso: 'EUR', tz: 'Europe/Berlin', name: '독일', flag: '🇩🇪' },
  FR: { id: 'A13V1IB3VIYZZH', region: 'EU', symbol: '€', iso: 'EUR', tz: 'Europe/Paris', name: '프랑스', flag: '🇫🇷' },
  IT: { id: 'APJ6JRA9NG5V4', region: 'EU', symbol: '€', iso: 'EUR', tz: 'Europe/Rome', name: '이탈리아', flag: '🇮🇹' },
  ES: { id: 'A1RKKUPIHCS9HS', region: 'EU', symbol: '€', iso: 'EUR', tz: 'Europe/Madrid', name: '스페인', flag: '🇪🇸' },
  NL: { id: 'A1805IZSGTT6HS', region: 'EU', symbol: '€', iso: 'EUR', tz: 'Europe/Amsterdam', name: '네덜란드', flag: '🇳🇱' },
  SE: { id: 'A2NODRKZP88ZB9', region: 'EU', symbol: 'kr', iso: 'SEK', tz: 'Europe/Stockholm', name: '스웨덴', flag: '🇸🇪' },
  PL: { id: 'A1C3SOZRARQ6R3', region: 'EU', symbol: 'zł', iso: 'PLN', tz: 'Europe/Warsaw', name: '폴란드', flag: '🇵🇱' },
  IE: { id: 'A28R8C7NBKEWEA', region: 'EU', symbol: '€', iso: 'EUR', tz: 'Europe/Dublin', name: '아일랜드', flag: '🇮🇪' },
  BE: { id: 'AMEN7PMS3EDWL', region: 'EU', symbol: '€', iso: 'EUR', tz: 'Europe/Brussels', name: '벨기에', flag: '🇧🇪' },
  AE: { id: 'A2VIGQ35RCS4UG', region: 'EU', symbol: 'AED ', iso: 'AED', tz: 'Asia/Dubai', name: 'UAE', flag: '🇦🇪' },
  SA: { id: 'A17E79C6D8DWNP', region: 'EU', symbol: 'SAR ', iso: 'SAR', tz: 'Asia/Riyadh', name: '사우디', flag: '🇸🇦' },
  TR: { id: 'A33AVAJ2PDY3EV', region: 'EU', symbol: '₺', iso: 'TRY', tz: 'Europe/Istanbul', name: '튀르키예', flag: '🇹🇷' },
  EG: { id: 'ARBP9OOSHTCHU', region: 'EU', symbol: 'EGP ', iso: 'EGP', tz: 'Africa/Cairo', name: '이집트', flag: '🇪🇬' },
  AU: { id: 'A39IBJ37TRP1C6', region: 'FE', symbol: 'A$', iso: 'AUD', tz: 'Australia/Sydney', name: '호주', flag: '🇦🇺' },
  JP: { id: 'A1VC38T7YXB528', region: 'FE', symbol: '¥', iso: 'JPY', tz: 'Asia/Tokyo', name: '일본', flag: '🇯🇵' },
  SG: { id: 'A19VAU5U5O7RUS', region: 'FE', symbol: 'S$', iso: 'SGD', tz: 'Asia/Singapore', name: '싱가포르', flag: '🇸🇬' },
};

async function token({ id, secret, refresh }) {
  const r = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: id, client_secret: secret }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`LWA ${r.status} ${j.error || ''}`);
  return j.access_token;
}
/* 그 시간대의 UTC 오프셋 "+01:00" (orderMetrics는 interval 오프셋과 granularityTimeZone이 맞아야 함) */
function offset(tz, at) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(at).find(x => x.type === 'timeZoneName')?.value || 'GMT';
  const m = /GMT([+-]\d{2}):?(\d{2})?/.exec(p); return m ? `${m[1]}:${m[2] || '00'}` : '+00:00';
}
const localYmd = (tz, at) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(at);
const addDays = (ymd, n) => { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function marketDays(ep, tok, code, days) {
  const m = MARKETS[code], now = new Date(), today = localYmd(m.tz, now), start = addDays(today, -days), off = offset(m.tz, now);
  const q = new URLSearchParams({ marketplaceIds: m.id, interval: `${start}T00:00:00${off}--${today}T23:59:59${off}`, granularity: 'Day', granularityTimeZone: m.tz });
  const r = await fetch(ep + '/sales/v1/orderMetrics?' + q, { headers: { 'x-amz-access-token': tok } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${code} ${r.status} ${j.errors?.[0]?.code || ''}`);
  return (j.payload || []).map(x => ({ date: x.interval.slice(0, 10), sales: Number(x.totalSales?.amount || 0), orders: x.orderCount, units: x.unitCount }));
}

export async function fetchAmazonDaily(days = 15) {
  const markets = {}, errors = [], regions = {};
  await Promise.all(ACCOUNTS.map(async A => {
    const c = cred(A); if (!c.refresh || !c.id) return;
    try {
      const tok = await token(c);
      const pr = await fetch(A.endpoint + '/sellers/v1/marketplaceParticipations', { headers: { 'x-amz-access-token': tok } });
      const pj = await pr.json().catch(() => ({}));
      if (!pr.ok) throw new Error(`participations ${pr.status} ${pj.errors?.[0]?.code || ''}`);
      const ids = new Set((pj.payload || []).filter(x => x.participation?.isParticipating).map(x => x.marketplace.id));
      const codes = Object.keys(MARKETS).filter(k => MARKETS[k].region === A.region && ids.has(MARKETS[k].id) && !(k in markets));
      regions[A.key] = codes;
      for (const k of codes) {   // orderMetrics 는 초당 0.5건 → 계정 안에서는 순서대로
        try {
          const d = await marketDays(A.endpoint, tok, k, days);
          if (d.some(x => x.sales > 0)) markets[k] = { currency: MARKETS[k].iso, symbol: MARKETS[k].symbol, name: MARKETS[k].name, flag: MARKETS[k].flag, account: A.key, days: d.slice(-15, -1) };  // 오늘(진행중) 제외
        } catch (e) { errors.push(e.message); }
      }
    } catch (e) { errors.push(`${A.key}: ${e.message}`); }
  }));
  if (errors.length) console.error('amazon', errors.join(' | '));
  return { asOf: new Date().toISOString(), markets, regions, errors };
}

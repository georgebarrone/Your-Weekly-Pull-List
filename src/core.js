import crypto from 'node:crypto';

export function idFor(...parts) { return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24); }
export function safeHttpUrl(input, allowedHosts = []) {
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowedHosts.includes(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch { return null; }
}
export function normalizeSeriesUrl(input) {
  const url = safeHttpUrl(input, ['batcave.biz', 'www.batcave.biz']);
  if (!url) return null;
  const u = new URL(url);
  if (!/^\/[a-z\d-]+\.html$/i.test(u.pathname) || u.pathname.includes('new-comics')) return null;
  return `https://batcave.biz${u.pathname.toLowerCase()}`;
}
export function isoDate(year, month, day) {
  const s = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  return Number.isFinite(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().slice(0,10) === s ? s : null;
}
export function laDate(input = new Date()) {
  const tokens = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(input);
  const part = name => tokens.find(t=>t.type===name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function weekBounds(dateString) {
  // Plain yyyy-mm-dd dates are intentional: avoid accidental timezone-day shifting.
  const utc = new Date(`${dateString}T12:00:00Z`);
  if (Number.isNaN(utc.getTime()) || utc.toISOString().slice(0, 10) !== dateString) throw new Error('Invalid date');
  const daysBack = (utc.getUTCDay() + 4) % 7; // Sun->4, Wed->0
  utc.setUTCDate(utc.getUTCDate() - daysBack);
  const start = utc.toISOString().slice(0, 10);
  utc.setUTCDate(utc.getUTCDate() + 6);
  return {start, end:utc.toISOString().slice(0, 10)};
}
export function isWednesdayAfter135Pacific(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false});
  const p = f.formatToParts(date);
  const get = k => p.find(v=>v.type===k)?.value;
  return get('weekday') === 'Wed' && (Number(get('hour')) > 13 || (Number(get('hour')) === 13 && Number(get('minute')) >= 35));
}
export function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function matchingSeries(a,b) {
  const normal = x => String(x||'').toLowerCase().replace(/\s*\(\d{4}[^)]*\)/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  return normal(a) === normal(b);
}

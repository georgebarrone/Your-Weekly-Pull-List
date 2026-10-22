import crypto from 'node:crypto';
const DAYS = 7;
const COOKIE = 'weekly_pull_session';

export function hashPin(pin, salt = crypto.randomBytes(20).toString('hex')) {
  if (!/^\d{4,12}$/.test(String(pin))) throw new Error('PIN must contain 4 to 12 digits');
  return `${salt}:${crypto.scryptSync(String(pin),salt,64).toString('hex')}`;
}
export function verifyPin(pin, encoded) {
  if (!encoded || typeof pin !== 'string' || !/^\d{4,12}$/.test(pin)) return false;
  const [salt, stored] = encoded.split(':');
  if (!salt || !/^[a-f0-9]{128}$/i.test(stored||'')) return false;
  const result = crypto.scryptSync(pin,salt,64);
  return crypto.timingSafeEqual(result,Buffer.from(stored,'hex'));
}
function hmac(payload,secret) {return crypto.createHmac('sha256',secret).update(payload).digest('base64url');}
export function issueSession(secret) {
  if (!secret || secret.length<32) throw new Error('SESSION_SECRET must be at least 32 characters');
  const payload = `${Math.floor(Date.now()/1000)+DAYS*86400}.${crypto.randomBytes(12).toString('base64url')}`;
  return `${payload}.${hmac(payload,secret)}`;
}
export function verifySession(token,secret) {
  if (!token || !secret || secret.length<32) return false;
  const seg = token.split('.'); if (seg.length!==3) return false;
  const payload = `${seg[0]}.${seg[1]}`; const sig = hmac(payload,secret);
  if (sig.length!==seg[2].length || !crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(seg[2]))) return false;
  return Number(seg[0])>Math.floor(Date.now()/1000);
}
export function parseCookie(header='') {
  const value = header.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`));
  return value ? value.slice(COOKIE.length+1) : '';
}
export function setSessionCookie(res,token) {
  const prod=process.env.NODE_ENV==='production';
  res.cookie(COOKIE,token,{httpOnly:true,secure:prod,sameSite:'strict',path:'/',maxAge:DAYS*86400*1000});
}
export function clearSession(res) {res.clearCookie(COOKIE,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/'});}

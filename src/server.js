import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import {join} from 'node:path';
import {initDb,subscriptions,catalog,createSubscription,removeSubscription,upsertCatalog,deliveryHistory,pendingIssues,recentForSeries,markDelivered,db} from './db.js';
import {fetchSeriesMeta} from './batcave.js';
import {refresh} from './runner.js';
import {hashPin,verifyPin,issueSession,verifySession,parseCookie,setSessionCookie,clearSession} from './auth.js';
import {idFor,normalizeSeriesUrl,laDate,weekBounds,safeHttpUrl} from './core.js';
import {sendIssues} from './mailer.js';

const secret=process.env.SESSION_SECRET || '';
const pinHash=process.env.PIN_HASH || '';
if (secret.length<32 || !pinHash.includes(':')) {
  console.error('Configure SESSION_SECRET (32+ characters) and PIN_HASH (npm run pin -- 123456) in .env');
  process.exit(1);
}
const app=express();
app.set('trust proxy',1);
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],styleSrc:["'self'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],scriptSrc:["'self'"],imgSrc:["'self'",'https:','data:'],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"]}}}));
app.use(express.json({limit:'20kb'}));
app.use(express.static(join(process.cwd(),'public'),{index:'index.html'}));
app.get('/health',(_,res)=>res.json({status:'ok'}));
const auth = (req,res,next)=>verifySession(parseCookie(req.headers.cookie),secret) ? next() : res.status(401).json({error:'PIN login required'});
const limiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many PIN attempts. Try again in 15 minutes.'}});
app.post('/api/login',limiter,(req,res)=>{
  if (!verifyPin(req.body?.pin,pinHash)) return res.status(401).json({error:'Incorrect PIN'});
  setSessionCookie(res,issueSession(secret));res.json({ok:true});
});
app.post('/api/logout',auth,(_,res)=>{clearSession(res);res.json({ok:true});});
app.get('/api/auth',(_,res)=>res.json({authenticated:verifySession(parseCookie(_.headers.cookie),secret)}));
// Browser writes must come from same origin, even though the session cookie is SameSite=Strict.
app.use('/api',(req,res,next)=>{
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  const origin=req.get('origin');
  if (!origin) return res.status(403).json({error:'Missing Origin header'});
  try {
    const originUrl=new URL(origin);
    const host=req.get('x-forwarded-host') || req.get('host');
    if (originUrl.host !== host) return res.status(403).json({error:'Cross-site request blocked'});
  } catch {return res.status(403).json({error:'Invalid Origin'});}
  next();
});
app.use('/api',auth);
function fail(res,e) { console.error(e);res.status(400).json({error:e.message||'Request failed'}); }
async function overview() {
  const [subs,entries,history]=await Promise.all([subscriptions(),catalog(),deliveryHistory()]);
  const bySeries=new Map();
  for (const entry of entries) if (!bySeries.has(entry.series_url)) bySeries.set(entry.series_url,entry);
  const today=laDate();const week=weekBounds(today);
  const upcoming=entries.filter(e=>e.release_date>=week.start && e.release_date<=week.end);
  const pending=await pendingIssues(week.start,today);
  return {subscriptions:subs.map(s=>({...s,latest:bySeries.get(s.series_url)||null})),catalog:entries,
    upcoming,history, pending,week,today};
}
app.get('/api/overview',async(_,res)=>{try{res.json(await overview());}catch(e){fail(res,e);}});
app.post('/api/catalog/refresh',async(_,res)=>{
  try{const count=await refresh();res.json({ok:true,imported:count,overview:await overview()});}catch(e){fail(res,e);}
});
app.post('/api/subscriptions',async(req,res)=>{
  try {
    const url=normalizeSeriesUrl(req.body?.url);
    if (!url) throw new Error('Enter a valid BatCave series URL');
    // Metadata from public series page, not from user-provided HTML/credentials.
    let meta;
    try {meta=await fetchSeriesMeta(url);}
    catch(e) {
      const matching=(await catalog()).find(x=>x.series_url===url);
      if (!matching) throw new Error(`Cannot verify series page: ${e.message}. Try again after checking the link.`);
      meta={title:matching.series_title,publisher:matching.publisher,kind:'ongoing',url};
    }
    const sub=await createSubscription(meta);
    const latest=await recentForSeries(url);
    let immediate='no-latest-issue-in-catalog';
    if (latest) {
      try {
        const range=weekBounds(latest.release_date);
        await sendIssues([latest],{weekStart:range.start,weekEnd:range.end,mode:'immediate'});
        await markDelivered([latest],'immediate');immediate='emailed';
      } catch(e) { immediate=`not emailed: ${e.message}`; }
    }
    res.json({ok:true,subscription:sub,immediate,overview:await overview()});
  } catch(e){fail(res,e);}
});
app.delete('/api/subscriptions/:id',async(req,res)=>{
  try {const removed=await removeSubscription(req.params.id);res.json({ok:true,removed,overview:await overview()});}catch(e){fail(res,e);}
});
app.post('/api/issues/manual',async(req,res)=>{
  try {
    const {seriesUrl,issueNumber,releaseDate,issueUrl,sendNow}=req.body||{};
    const url=normalizeSeriesUrl(seriesUrl);
    if (!url || !/^#?[a-z\d .:_-]{1,42}$/i.test(issueNumber||'')) throw new Error('Choose a subscribed series and enter an issue number');
    if (!/^\d{4}-\d\d-\d\d$/.test(releaseDate||'') || Number.isNaN(Date.parse(releaseDate))) throw new Error('Enter an issue release date');
    const validIssue=safeHttpUrl(issueUrl,['batcave.biz','www.batcave.biz']);
    if (!validIssue || !/^\/reader\/\d+\/\d+\/?$/.test(new URL(validIssue).pathname)) throw new Error('Enter a BatCave issue reader URL');
    const sub=(await subscriptions()).find(s=>s.series_url===url);
    if (!sub) throw new Error('Subscribe to this series first');
    const issue={id:idFor(url,issueNumber,releaseDate),series_url:url,series_title:sub.title,
      issue_number:issueNumber,release_date:releaseDate,issue_url:validIssue,publisher:sub.publisher,
      cover_url:null,date_source:'Manually entered; official date not independently verified'};
    await upsertCatalog([issue]);
    let delivery='not-requested';
    if (sendNow) {
      const latest=await recentForSeries(url);
      if (latest && latest.id===issue.id) {
        try {const range=weekBounds(releaseDate);await sendIssues([latest],{weekStart:range.start,weekEnd:range.end,mode:'immediate'});await markDelivered([latest],'immediate');delivery='emailed';}
        catch(e){delivery=`not emailed: ${e.message}`;}
      } else delivery='already-delivered';
    }
    res.json({ok:true,delivery,overview:await overview()});
  }catch(e){fail(res,e);}
});
app.post('/api/issues/:id/authorized-pdf',async(req,res)=>{
  try {
    const hosts=(process.env.AUTHORIZED_PDF_HOSTS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    const url = req.body?.url ? safeHttpUrl(req.body.url,hosts) : null;
    if (req.body?.url && !url) throw new Error('PDF host must be explicitly authorized in AUTHORIZED_PDF_HOSTS');
    const result=await db.execute({sql:'UPDATE catalog SET authorized_pdf_url=? WHERE id=?',args:[url,req.params.id]});
    if (!result.rowsAffected) throw new Error('Issue not found');
    res.json({ok:true,overview:await overview()});
  } catch(e){fail(res,e);}
});
app.post('/api/issues/:id/send',async(req,res)=>{
  try {
    const entry=(await db.execute({sql:`SELECT c.*,s.id AS subscription_id,s.title AS subscribed_title FROM catalog c JOIN subscriptions s ON s.series_url=c.series_url LEFT JOIN deliveries d ON d.issue_id=c.id WHERE c.id=? AND d.issue_id IS NULL`,args:[req.params.id]})).rows[0];
    if (!entry) throw new Error('Issue not found, not subscribed, or already delivered');
    const week=weekBounds(entry.release_date);
    await sendIssues([entry],{weekStart:week.start,weekEnd:week.end,mode:'immediate'});
    await markDelivered([entry],'immediate');
    res.json({ok:true,overview:await overview()});
  }catch(e){fail(res,e);}
});
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'Unexpected server error'});});
try {await initDb();app.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Weekly Pull List running on port',process.env.PORT||3000));}
catch(e){console.error(e);process.exit(1);}

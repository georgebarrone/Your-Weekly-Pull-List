import {createReadStream, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {readdir, open, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import nodemailer from 'nodemailer';

export const MAX_PDF_BYTES=17_000_000;
export const DEFAULT_INBOX=join(homedir(),'Downloads','WeeklyPullList');
export const DEFAULT_LEDGER=join(process.cwd(),'data','local-pdf-sent.json');

export function loadLedger(file=DEFAULT_LEDGER){
  if(!existsSync(file))return {sent:{}};
  const json=JSON.parse(readFileSync(file,'utf8'));
  if(!json || typeof json!=='object'||!json.sent||typeof json.sent!=='object')throw Error('Invalid PDF delivery ledger');
  return json;
}
function saveLedger(file,ledger){
  mkdirSync(dirname(file),{recursive:true});
  const tmp=file+'.tmp';
  writeFileSync(tmp,JSON.stringify(ledger,null,2)+'\n',{mode:0o600});
  renameSync(tmp,file);
}
export function emailConfig(env=process.env){
  const {SMTP_USER,SMTP_APP_PASSWORD,EMAIL_TO}=env;
  if(!SMTP_USER||!SMTP_APP_PASSWORD||!EMAIL_TO)throw Error('Set SMTP_USER, SMTP_APP_PASSWORD, and EMAIL_TO locally in .env');
  if(EMAIL_TO.includes(',')||EMAIL_TO.includes(';')||/[\r\n]/.test(EMAIL_TO))throw Error('Set EMAIL_TO to a single address for local PDF delivery');
  return {user:SMTP_USER,pass:SMTP_APP_PASSWORD,to:EMAIL_TO};
}
export async function sendLocalPdf(file,filename,{user,pass,to},transport){
  const mailer=transport || nodemailer.createTransport({service:'gmail',auth:{user,pass}});
  const cleanName=filename.replace(/[\r\n<>]/g,'').slice(0,160);
  const fromName=(process.env.EMAIL_FROM||'Your Weekly Pull List').replace(/["<>\r\n]/g,'');
  return mailer.sendMail({
    from:`"${fromName}" <${user}>`,
    to,subject:`Your Weekly Pull List — ${cleanName}`,
    text:`PDF attached: ${cleanName}\nSent from your private PDF inbox.`,
    attachments:[{filename:cleanName,path:file,contentType:'application/pdf'}]
  });
}
async function digestFile(file){
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(file))hash.update(chunk);
  return hash.digest('hex');
}
async function isPdf(file){
  const f=await open(file,'r');
  try{const header=Buffer.alloc(5);const {bytesRead}=await f.read(header,0,5,0);return bytesRead===5&&header.toString()==='%PDF-';}
  finally{await f.close();}
}
// Only files in a dedicated directory are considered. Directories, shortcuts,
// symlinks, partial downloads and non-PDFs are ignored.
export async function processPdfInbox({inbox=DEFAULT_INBOX,ledgerFile=DEFAULT_LEDGER,send,now=Date.now(),logger=console}={}){
  const folder=resolve(inbox),ledger=loadLedger(ledgerFile);
  mkdirSync(folder,{recursive:true});
  let sent=0,skipped=0,tooLarge=0;
  const entries=(await readdir(folder,{withFileTypes:true})).filter(e=>e.isFile()&&/\.pdf$/i.test(e.name)).sort((a,b)=>a.name.localeCompare(b.name));
  for(const entry of entries){
    const file=join(folder,entry.name);
    const info=await stat(file);
    // Avoid sending files while the browser is still writing them.
    if(!info.isFile()||info.size<5||now-info.mtimeMs<5000){skipped++;continue;}
    if(info.size>MAX_PDF_BYTES){tooLarge++;logger.warn(`PDF too large for Gmail attachment: ${entry.name}`);continue;}
    if(!await isPdf(file)){skipped++;continue;}
    const fingerprint=await digestFile(file);
    if(ledger.sent[fingerprint]){skipped++;continue;}
    // Re-check that the file has not changed since hashing.
    const after=await stat(file);
    if(after.size!==info.size||after.mtimeMs!==info.mtimeMs){skipped++;continue;}
    if(!send)throw Error('Missing mail sender callback');
    const mail=await send(file,entry.name);
    ledger.sent[fingerprint]={filename:entry.name,at:new Date(now).toISOString(),messageId:mail?.messageId||null};
    saveLedger(ledgerFile,ledger);
    sent++;
    logger.log(`PDF delivered: ${entry.name}`);
  }
  return {sent,skipped,tooLarge,scanned:entries.length,folder};
}

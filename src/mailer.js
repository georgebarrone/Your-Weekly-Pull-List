import nodemailer from 'nodemailer';
import {escapeHtml, safeHttpUrl} from './core.js';

function smtpConfig() {
  const {SMTP_USER,SMTP_APP_PASSWORD,EMAIL_TO} = process.env;
  if (!SMTP_USER || !SMTP_APP_PASSWORD || !EMAIL_TO) throw new Error('Email not configured yet (SMTP_USER, SMTP_APP_PASSWORD, EMAIL_TO)');
  return {user:SMTP_USER,password:SMTP_APP_PASSWORD,to:EMAIL_TO};
}
function approvedPdfUrl(url) {
  const hosts=(process.env.AUTHORIZED_PDF_HOSTS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  return hosts.length && safeHttpUrl(url,hosts);
}
function issueLink(item) {
  try {const u=new URL(item.issue_url); return u.protocol==='https:' ? u.toString() : '#';} catch {return '#';}
}
export function digestHtml(issues,{weekStart,weekEnd,mode='weekly',attachments=[]}) {
  const attachmentSet = new Set(attachments.map(x=>x.issueId));
  const lines = issues.map(item => {
    const cover = item.cover_url && /^https:\/\//.test(item.cover_url) ? `<img src="${escapeHtml(item.cover_url)}" alt="" width="74" style="border-radius:6px;max-height:110px;object-fit:cover"/>` : '<div style="width:74px;height:100px;border-radius:6px;background:#242634;color:#e2bd75;text-align:center;line-height:100px;font-size:28px">✦</div>';
    const status=attachmentSet.has(item.id)?'PDF attached':'View issue';
    return `<tr><td style="padding:20px 8px 20px 0;vertical-align:top;width:80px">${cover}</td><td style="padding:20px 0;vertical-align:top;border-bottom:1px solid #ddd9d0"><div style="font-size:10px;color:#887c70;letter-spacing:2px;text-transform:uppercase">${escapeHtml(item.publisher||'Comic release')} · ${escapeHtml(item.release_date)}</div><div style="font:700 22px Georgia,serif;color:#202024;margin:6px 0">${escapeHtml(item.series_title)} <span style="color:#a34e40">${escapeHtml(item.issue_number)}</span></div><a href="${escapeHtml(issueLink(item))}" style="display:inline-block;margin-top:9px;color:#9b3934;text-decoration:none;font-size:13px;font-weight:700">${status} →</a></td></tr>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;padding:22px;background:#edeae4;font-family:Arial,sans-serif;color:#232327"><table role="presentation" align="center" width="100%" style="max-width:620px;border-collapse:collapse;background:#fffdf8"><tr><td style="padding:35px 32px 24px;border-top:7px solid #a9443d;text-align:center"><div style="font-size:10px;color:#906c56;letter-spacing:4px">NEW COMIC BOOK DAY</div><h1 style="font:700 38px Georgia,serif;line-height:1.05;margin:12px 0 8px;letter-spacing:-1.5px">YOUR WEEKLY<br>PULL LIST</h1><div style="height:1px;background:#302f31;margin:18px 0"></div><p style="color:#756d65;font-size:12px;letter-spacing:2px">${escapeHtml(weekStart)} — ${escapeHtml(weekEnd)}</p><p style="font-size:14px;color:#726c65">${mode==='immediate'?'Just added to your pull list':'The issues on your pull list this week'} · ${issues.length} ${issues.length===1?'issue':'issues'}</p></td></tr><tr><td style="padding:5px 32px 28px"><table role="presentation" width="100%" style="border-collapse:collapse">${lines}</table></td></tr><tr><td style="background:#22242a;color:#dad7cf;padding:25px 32px;text-align:center;font-size:12px">Curated for your personal pull list. Cover art and linked content belong to their owners.<br><span style="color:#a8a6a2">PDF attachments appear only when an authorized source is configured and the file fits email limits.</span></td></tr></table></body></html>`;
}

async function attachmentsFor(items) {
  const attachments=[];
  let totalBytes=0;
  for (const issue of items) {
    const url=approvedPdfUrl(issue.authorized_pdf_url);
    if (!url) continue;
    try {
      const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)});
      const bytes=Number(response.headers.get('content-length')||0);
      if (!response.ok || bytes>18_000_000-totalBytes) continue;
      const array=new Uint8Array(await response.arrayBuffer());
      if (array.byteLength+totalBytes>18_000_000 || new TextDecoder().decode(array.subarray(0,5))!=='%PDF-') continue;
      attachments.push({filename:`${issue.series_title.replace(/[^a-z0-9 -]/gi,'').slice(0,55)} ${issue.issue_number.replace(/[^a-z0-9-]/gi,'')}.pdf`,content:Buffer.from(array),contentType:'application/pdf',issueId:issue.id});
      totalBytes+=array.byteLength;
    } catch(e) {console.warn('Authorized PDF unavailable:',issue.id,e.message);}
  }
  return attachments;
}
export async function sendIssues(items,{weekStart,weekEnd,mode='weekly'}) {
  if (!items.length) return {sent:false,count:0};
  const smtp=smtpConfig();
  const attachments=await attachmentsFor(items);
  const html=digestHtml(items,{weekStart,weekEnd,mode,attachments});
  const text=items.map(i=>`${i.series_title} ${i.issue_number} (${i.release_date})\n${issueLink(i)}`).join('\n\n');
  const transport=nodemailer.createTransport({service:'gmail',auth:{user:smtp.user,pass:smtp.password}});
  const subject = mode==='immediate' ? `Added to Your Pull List: ${items[0].series_title} ${items[0].issue_number}` : `Your Weekly Pull List — ${weekStart} (${items.length} new)`;
  const result=await transport.sendMail({from:`"${(process.env.EMAIL_FROM||'Your Weekly Pull List').replace(/["<>\r\n]/g,'')}" <${smtp.user}>`,to:smtp.to,subject,text,html,attachments:attachments.map(({issueId,...rest})=>rest)});
  console.log(`Mail accepted: ${result.messageId}`);
  return {sent:true,count:items.length,attachments:attachments.length};
}

import {existsSync} from 'node:fs';
import {laDate,weekBounds} from './core.js';
import {refresh} from './runner.js';
import {initDb,pendingIssues,markDelivered,markRun} from './db.js';
import {emailConfig,sendLocalPdf} from './local-pdf-inbox.js';
import {downloadNewestPdf,isEligiblePdfIssue,openDownloadBrowser,validateLocalPdf,WEEKLY_PDF_DIR} from './browser-download.js';
import {join} from 'node:path';

const clean=value=>String(value||'').replace(/[^a-z0-9 #()._-]/gi,'').slice(0,72).trim();
export function planWeekly(issues){return issues.filter(isEligiblePdfIssue);}
export async function runAutomatedWeekly({
  dryRun=false,one=false,now=new Date(),load=initDb,
  update=refresh,pending=pendingIssues,record=markDelivered,
  complete=markRun,openBrowser=openDownloadBrowser,download=downloadNewestPdf,
  email=null,pdfDir=WEEKLY_PDF_DIR,logger=console
}={}){
  await load();
  const today=laDate(now),{start,end}=weekBounds(today);
  let imported=0,refreshFailure=null;
  try{imported=await update();}
  catch(e){refreshFailure=e.message;logger.warn('Catalog refresh unavailable:',e.message);}
  const all=await pending(start,today);
  const eligible=planWeekly(all);
  const unsupported=all.filter(i=>!isEligiblePdfIssue(i)).map(i=>({id:i.id,title:i.series_title,reason:'Unsupported or restricted issue URL'}));
  const work=one?eligible.slice(0,1):eligible;
  const report={weekStart:start,weekEnd:end,imported,planned:work.length,delivered:0,errors:unsupported,refreshFailure};
  if(dryRun){report.status='preview';report.issues=work.map(({id,series_title,issue_number})=>({id,title:series_title,issue:issue_number}));return report;}
  if(refreshFailure && !all.length)throw Error('Metadata refresh failed, and no locally indexed issues are available');
  if(!work.length){
    if(!refreshFailure && !unsupported.length && !one)await complete(start,0);
    report.status=unsupported.length?'pending-errors':'nothing-new';return report;
  }
  const smtp=email?null:emailConfig();
  let context;
  try{
    for(const issue of work){
      try{
        const path=join(pdfDir,issue.id+'.pdf');
        if(existsSync(path)){
          try{await validateLocalPdf(path);}
          catch{throw Error('An invalid cached PDF exists for this issue; remove it before retrying');}
        }else{
          if(!context)context=await openBrowser();
          await download(context,issue,{outputDir:pdfDir});
          await validateLocalPdf(path);
        }
        const filename=(clean(issue.series_title)+' '+clean(issue.issue_number)+'.pdf').slice(0,150);
        const sender=email||((file,name)=>sendLocalPdf(file,name,smtp));
        await sender(path,filename,issue);
        // Only Gmail-accepted PDFs are recorded as delivered.
        await record([issue],'auto-pdf');
        report.delivered++;
        logger.log('PDF email accepted:',issue.series_title,issue.issue_number);
      }catch(error){
        report.errors.push({id:issue.id,title:issue.series_title,reason:error.message});
        logger.warn('PDF not delivered:',issue.series_title,error.message);
      }
    }
  }finally{if(context)await context.close();}
  if(report.errors.length===0 && !refreshFailure && !one)await complete(start,report.delivered);
  report.status=report.errors.length||refreshFailure?'incomplete':'sent';
  return report;
}

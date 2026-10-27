import 'dotenv/config';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {openDownloadBrowser} from '../src/browser-download.js';
import {collectNavigationResponse,classifyNavigationReport} from '../src/navigation-diagnostics.js';

const browser=(process.env.PDF_BROWSER||'firefox').trim().toLowerCase();
const saved=process.argv.includes('--saved');
const durationMs=12000;
let temp=null,context;
const events=[],failures=[];
try{
  if(!saved)temp=await mkdtemp(join(tmpdir(),'weekly-pull-list-browser-test-'));
  console.log('Diagnosing browser:',browser);
  console.log('Profile:',saved?'existing private automation profile':'temporary empty profile');
  console.log('Only HTTP status codes, URL paths and query parameter names will be collected.');
  context=await openDownloadBrowser({browser,...(temp?{profileDir:temp}:{})});
  const page=context.pages()[0]||await context.newPage();
  page.on('response',res=>{
    try{
      const item=collectNavigationResponse(res);
      if(!item||!['batcave.biz','www.batcave.biz'].includes(new URL(res.url()).hostname))return;
      if(events.length<80)events.push(item);
    }catch{}
  });
  page.on('requestfailed',req=>{
    try{
      if(req.resourceType()!=='document')return;
      if(!['batcave.biz','www.batcave.biz'].includes(new URL(req.url()).hostname))return;
      if(failures.length<15)failures.push(req.failure()?.errorText||'Unknown document error');
    }catch{}
  });
  try{
    await page.goto('https://batcave.biz/',{waitUntil:'commit',timeout:15000});
  }catch(err){
    console.warn('Initial navigation did not commit:',err.name);
  }
  await new Promise(resolve=>setTimeout(resolve,durationMs));
  const report={
    browser,profile:saved?'saved':'fresh',
    summary:classifyNavigationReport(events),
    navigations:events,
    failedDocumentReasons:failures,
    testedAt:new Date().toISOString(),
  };
  await mkdir('data',{recursive:true});
  const file=resolve('data','browser-diagnostic-'+browser+'-'+(saved?'saved':'fresh')+'.json');
  await writeFile(file,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log('Result:',report.summary.diagnosis);
  console.log('Documents:',report.summary.documents,'Redirects:',report.summary.redirects,'_ct HTTP failures:',report.summary.checkFailures);
  console.log('Sanitized report:',file);
  if(report.summary.likelyRedirect404Loop)process.exitCode=2;
}catch(error){
  console.error('Browser diagnostic could not start:',error.message);
  process.exitCode=1;
}finally{
  if(context)await context.close().catch(()=>{});
  if(temp)await rm(temp,{recursive:true,force:true,maxRetries:3,retryDelay:250}).catch(()=>{});
}

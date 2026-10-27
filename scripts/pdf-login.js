import 'dotenv/config';
import {createInterface} from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {openDownloadBrowser} from '../src/browser-download.js';
import {classifyNavigationReport,collectNavigationResponse} from '../src/navigation-diagnostics.js';

let context,rl;
try{
  context=await openDownloadBrowser();
  const page=context.pages()[0]||await context.newPage();
  const history=[];
  let endLoop;
  const looping=new Promise(resolve=>{endLoop=resolve;});
  let stopped=false;
  page.on('response',response=>{
    try{
      const item=collectNavigationResponse(response);
      if(!item||!['https://batcave.biz','https://www.batcave.biz'].includes(item.url.origin))return;
      if(history.length>=40)history.shift();
      history.push(item);
      if(!stopped && classifyNavigationReport(history).likelyRedirect404Loop){
        stopped=true;
        endLoop(false);
      }
    }catch{}
  });
  // This is our only automatic navigation. Site-generated navigation may
  // repeat afterward; if it does, report the server redirect/404 cycle.
  try{await page.goto('https://batcave.biz/',{waitUntil:'commit',timeout:20000});}
  catch(error){console.warn('Homepage navigation interrupted:',error.name);}
  console.log('A private '+(process.env.PDF_BROWSER==='chrome'?'Chrome':'Firefox')+' profile is open.');
  console.log('Sign in through the website; never enter credentials into the terminal or GitHub.');
  console.log('Press Enter ONLY after sign-in succeeds, not while the page is still loading.');
  rl=createInterface({input,output});
  const entered=rl.question('Press Enter when signed in to retain this private browser profile... ')
    .then(()=>true).catch(()=>false);
  const success=await Promise.race([entered,looping]);
  if(!success){
    console.error('Login stopped: the website is repeatedly redirecting to an HTTP error endpoint.');
    console.error('The script does not reload the page. Run npm run pdf-diagnose to compare a fresh browser profile.');
    process.exitCode=1;
  }else{
    console.log('Browser profile retained. Next: npm run pdf-weekly -- --dry-run');
  }
}catch(error){
  console.error('Could not open login browser:',error.message);
  process.exitCode=1;
}finally{
  if(rl)rl.close();
  if(context)await context.close().catch(()=>{});
}

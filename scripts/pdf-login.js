import 'dotenv/config';
import {createInterface} from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {openDownloadBrowser} from '../src/browser-download.js';

let context;
try{
  context=await openDownloadBrowser();
  const page=context.pages()[0]||await context.newPage();
  let navigations=0;
  let warned=false;
  page.on('framenavigated',frame=>{
    if(frame!==page.mainFrame())return;
    navigations++;
    if(navigations>=3&&!warned){
      warned=true;
      console.warn('The website has navigated repeatedly in this browser. The login script only navigates once.');
      console.warn('If sign-in never appears, close this browser and try PDF_BROWSER=chrome for a standard-browser compatibility check.');
      console.warn('Do not continue if the website requires verification or disallows automated access.');
    }
  });
  await page.goto('https://batcave.biz/',{waitUntil:'domcontentloaded'});
  console.log('A private '+(process.env.PDF_BROWSER==='chrome'?'Chrome':'Firefox')+' profile is open. Sign in through the WEBSITE itself.');
  console.log('Do not enter your password, cookies, or one-time codes into this terminal or GitHub.');
  console.log('Keep the site signed in. When finished, return to this terminal.');
  const rl=createInterface({input,output});
  await rl.question('Press Enter ONLY after sign-in succeeds to close the browser and retain its local profile... ');
  rl.close();
  console.log('Browser profile preserved locally. Run npm run pdf-weekly -- --dry-run next.');
}catch(e){console.error('Could not open login browser:',e.message);process.exitCode=1;}
finally{if(context)await context.close();}

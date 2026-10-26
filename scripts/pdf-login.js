import 'dotenv/config';
import {createInterface} from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {openDownloadBrowser} from '../src/browser-download.js';

let context;
try{
  context=await openDownloadBrowser();
  const page=context.pages()[0]||await context.newPage();
  await page.goto('https://batcave.biz/',{waitUntil:'domcontentloaded'});
  console.log('A private Firefox profile is open. Sign in through the WEBSITE itself.');
  console.log('Do not enter your password, cookies, or one-time codes into this terminal or GitHub.');
  console.log('Keep the site signed in. When finished, return to this terminal.');
  const rl=createInterface({input,output});
  await rl.question('Press Enter after sign-in to save the browser profile and close Firefox... ');
  rl.close();
  console.log('Browser profile preserved locally. Run npm run pdf-weekly -- --dry-run next.');
}catch(e){console.error('Could not open login browser:',e.message);process.exitCode=1;}
finally{if(context)await context.close();}

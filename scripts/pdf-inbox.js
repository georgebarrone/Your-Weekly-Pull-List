import 'dotenv/config';
import {processPdfInbox,emailConfig,sendLocalPdf,DEFAULT_INBOX} from '../src/local-pdf-inbox.js';

const watch=process.argv.includes('--watch');
const interval=Number(process.env.PDF_WATCH_SECONDS||30);
if(watch&&(!Number.isFinite(interval)||interval<15))throw Error('PDF_WATCH_SECONDS must be at least 15');

const smtp=emailConfig(); // Validate before starting the watcher.
const inbox=process.env.PDF_INBOX_DIR||DEFAULT_INBOX;
let busy=false;
async function run(){
  if(busy)return;
  busy=true;
  try{
    const report=await processPdfInbox({
      inbox,
      send:(path,filename)=>sendLocalPdf(path,filename,smtp)
    });
    if(!watch||report.sent||report.tooLarge)console.log(`PDF inbox: ${report.sent} sent, ${report.skipped} skipped, ${report.tooLarge} oversized (${report.folder})`);
  }catch(e){
    console.error('PDF inbox error:',e.message);
    if(!watch)process.exitCode=1;
  }finally{busy=false;}
}
console.log(`Watching dedicated PDF inbox: ${inbox}`);
await run();
if(watch){
  console.log(`Checking every ${interval}s. Leave this window open while receiving PDFs.`);
  setInterval(run,interval*1000);
}

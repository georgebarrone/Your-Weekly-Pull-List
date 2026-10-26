import 'dotenv/config';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {runAutomatedWeekly} from '../src/weekly-auto.js';

const dryRun=process.argv.includes('--dry-run');
const one=process.argv.includes('--test-one');
const reportPath=join(process.cwd(),'data','weekly-last-run.json');
try {
  const result=await runAutomatedWeekly({dryRun,one});
  console.log(JSON.stringify(result,null,2));
  if(!dryRun){
    await mkdir(join(process.cwd(),'data'),{recursive:true});
    await writeFile(reportPath,JSON.stringify({finishedAt:new Date().toISOString(),...result},null,2)+'\n');
  }
  if(result.status==='incomplete'||result.status==='pending-errors')process.exitCode=1;
}catch(e){
  const report={finishedAt:new Date().toISOString(),status:'failed',error:e.message};
  console.error('Automated Wednesday delivery failed:',e.message);
  if(!dryRun){
    await mkdir(join(process.cwd(),'data'),{recursive:true});
    await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  }
  process.exitCode=1;
}

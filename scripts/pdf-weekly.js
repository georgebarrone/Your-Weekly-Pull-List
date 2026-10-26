import 'dotenv/config';
import {runAutomatedWeekly} from '../src/weekly-auto.js';

const dryRun=process.argv.includes('--dry-run');
const one=process.argv.includes('--test-one');
try {
  const result=await runAutomatedWeekly({dryRun,one});
  console.log(JSON.stringify(result,null,2));
  if(result.status==='incomplete'||result.status==='pending-errors')process.exitCode=1;
}catch(e){console.error('Automated Wednesday delivery failed:',e.message);process.exitCode=1;}

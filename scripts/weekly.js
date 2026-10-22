import 'dotenv/config';
import {initDb} from '../src/db.js';
import {weekly} from '../src/runner.js';
import {isWednesdayAfter135Pacific} from '../src/core.js';
const manual = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' || process.argv.includes('--force');
if (!manual && !isWednesdayAfter135Pacific()) {
  console.log('Not Wednesday after 13:35 America/Los_Angeles, skipping (DST-aware).');
  process.exit(0);
}
try {
  await initDb();
  const result=await weekly({dryRun:process.argv.includes('--dry-run'),force:manual && process.argv.includes('--force')});
  console.log(JSON.stringify(result,null,2));
} catch(e) {console.error('Weekly run failed:',e);process.exitCode=1;}

import {laDate,weekBounds} from './core.js';
import {fetchWeeklyReleases} from './batcave.js';
import {upsertCatalog,pendingIssues,markDelivered,markRun,hasRun} from './db.js';
import {sendIssues} from './mailer.js';

export async function refresh() {
  const issues=await fetchWeeklyReleases();
  await upsertCatalog(issues);
  return issues.length;
}
export async function weekly({dryRun=false,force=false}={}) {
  const today=laDate();
  const {start,end}=weekBounds(today);
  if (!force && await hasRun(start)) return {status:'already-sent',start,end};
  const imported=await refresh();
  // Only items *already released* by the time this job runs. Future-dated issues
  // stay in the preview, but do not get included in Wednesday's email.
  const items=await pendingIssues(start,today);
  if (dryRun) return {status:'preview',start,end,imported,issues:items};
  if (!items.length) {
    await markRun(start,0);
    return {status:'nothing-new',start,end,imported};
  }
  const result=await sendIssues(items,{weekStart:start,weekEnd:end});
  await markDelivered(items,'weekly');
  await markRun(start,items.length);
  return {status:'sent',start,end,imported,...result};
}

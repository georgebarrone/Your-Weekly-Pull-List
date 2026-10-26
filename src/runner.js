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

  // Catalog access is controlled by the provider. If it is blocked or temporarily
  // unavailable, report that explicitly without erasing previously indexed issues.
  let imported=0;
  let refreshError=null;
  try {
    imported=await refresh();
  } catch (error) {
    refreshError=error;
    console.warn('Catalog refresh unavailable:',error.message);
  }

  // Only include issues already dated as released by the time this job runs.
  // Previously indexed or manually entered entries can still be delivered if
  // the catalog source becomes unavailable.
  const items=await pendingIssues(start,today);
  if (dryRun) return {
    status:refreshError?'preview-source-unavailable':'preview',
    start,end,imported,issues:items,
    ...(refreshError?{warning:`Catalog refresh failed: ${refreshError.message}. Only saved issues are shown; no email was sent.`}:{})
  };

  if (refreshError && !items.length) {
    // Crucially do not mark the week complete: there is no evidence that no
    // issues were released. This is an actionable workflow failure, not success.
    throw new Error(`Cannot complete digest: comic catalog unavailable (${refreshError.message}), and there are no saved eligible issues. Nothing was emailed or marked delivered. Add releases manually or use an authorized metadata provider, then rerun.`);
  }
  if (!items.length) {
    await markRun(start,0);
    return {status:'nothing-new',start,end,imported};
  }

  const result=await sendIssues(items,{weekStart:start,weekEnd:end});
  await markDelivered(items,'weekly');

  // Do not mark a partially sourced week as complete: if the source recovers,
  // a manual retry can still deliver any newly imported, undelivered issues.
  if (!refreshError) await markRun(start,items.length);
  return {
    status:refreshError?'partial-sent-source-unavailable':'sent',
    start,end,imported,...result,
    ...(refreshError?{warning:`Catalog refresh failed: ${refreshError.message}. Emailed only saved eligible issues; this week is not marked complete.`}:{})
  };
}

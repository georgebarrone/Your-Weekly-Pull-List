// Only paths, status codes, and query PARAMETER NAMES are retained.
// Never capture account credentials, cookies, response bodies, URL query
// values, request headers, or any downloaded content in a diagnostics report.
export function redactNavigationUrl(value){
  try{
    const url=new URL(value);
    return {
      origin:url.origin,
      path:url.pathname,
      params:[...new Set(url.searchParams.keys())].sort()
    };
  }catch{
    return {origin:'unknown',path:'unparseable',params:[]};
  }
}

// Match failing document responses to the actual redirect destination.
// Comparing sanitized URL shapes avoids retaining query values/session tokens
// while recognizing both /?_ct=... and /_c?t=...&u=... patterns.
function urlShape(part){
  if(!part||!part.origin||!part.path)return null;
  return [part.origin,part.path,...(part.params||[]).slice().sort()].join('|');
}

export function classifyNavigationReport(events){
  const redirects=events.filter(x=>x.status>=300&&x.status<400&&x.location);
  const redirectedShapes=new Set(redirects.map(x=>urlShape(x.location)).filter(Boolean));
  const failedTargets=events.filter(x=>x.status>=400&&urlShape(x.url)&&redirectedShapes.has(urlShape(x.url)));
  const failedShapeCount=new Map();
  for(const event of failedTargets){
    const key=urlShape(event.url);
    failedShapeCount.set(key,(failedShapeCount.get(key)||0)+1);
  }
  const repeatedFailingTargets=[...failedShapeCount].filter(([,count])=>count>=2);
  const loop=repeatedFailingTargets.some(([key])=>redirects.filter(x=>urlShape(x.location)===key).length>=2);
  const firstFailure=failedTargets[0]?.url?.path||null;
  return {
    documents:events.length,
    redirects:redirects.length,
    redirectTargetFailures:failedTargets.length,
    // Kept as a compatibility alias for older diagnostic report consumers.
    checkFailures:failedTargets.length,
    failedRedirectPath:firstFailure,
    likelyRedirect404Loop:loop,
    diagnosis:loop
      ? 'Confirmed repeating HTTP redirect to a failing document URL ('+firstFailure+'). The website or its access-verification flow is returning these responses; the script does not call reload().'
      : failedTargets.length
      ? 'A redirect destination returned an HTTP error, but repeated cycles were not confirmed.'
      : redirects.length
      ? 'Redirects occurred, but no HTTP errors at their destinations were observed.'
      : 'No HTTP redirect cycle was observed during the test.'
  };
}

export function collectNavigationResponse(response){
  const request=response.request();
  if(request.resourceType()!=='document')return null;
  const location=response.headers()['location'];
  return {
    status:response.status(),
    url:redactNavigationUrl(response.url()),
    ...(location?{location:redactNavigationUrl(new URL(location,response.url()).toString())}:{})
  };
}

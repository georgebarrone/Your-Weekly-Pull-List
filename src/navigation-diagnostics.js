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

export function classifyNavigationReport(events){
  const redirects=events.filter(x=>x.status>=300&&x.status<400);
  const failedChecks=events.filter(x=>x.status>=400&&x.url?.params?.includes('_ct'));
  const siteRedirects=redirects.filter(x=>x.location?.params?.includes('_ct'));
  const loop=(siteRedirects.length>=2&&failedChecks.length>=2);
  return {
    documents:events.length,
    redirects:redirects.length,
    checkFailures:failedChecks.length,
    likelyRedirect404Loop:loop,
    diagnosis:loop
      ? 'Repeated server redirects to _ct URLs that return HTTP errors. The browser is receiving the cycle from the website; page.reload() is not being called by this test.'
      : failedChecks.length
      ? 'At least one _ct request returned an HTTP error; no repeated redirect/404 cycle confirmed.'
      : redirects.length
      ? 'Redirects occurred, but the known redirect/404 loop was not observed.'
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

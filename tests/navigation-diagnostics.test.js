import test from 'node:test';
import assert from 'node:assert/strict';
import {redactNavigationUrl, classifyNavigationReport,collectNavigationResponse} from '../src/navigation-diagnostics.js';

test('diagnostic never includes redirect query token values',()=>{
 const safe=redactNavigationUrl('https://batcave.biz/?_ct=THIS_IS_PRIVATE&u=ANOTHER_SECRET');
 assert.equal(safe.origin,'https://batcave.biz');
 assert.equal(safe.path,'/');
 assert.deepEqual(safe.params,['_ct','u']);
 assert.ok(!JSON.stringify(safe).includes('THIS_IS_PRIVATE'));
 assert.ok(!JSON.stringify(safe).includes('ANOTHER_SECRET'));
});
test('detects repeated 302 redirect to an _ct URL followed by 404',()=>{
 const home={origin:'https://batcave.biz',path:'/',params:[]};
 const check={origin:'https://batcave.biz',path:'/',params:['_ct']};
 const events=[
  {status:302,url:home,location:check},
  {status:404,url:check},
  {status:302,url:home,location:check},
  {status:404,url:check}
 ];
 const summary=classifyNavigationReport(events);
 assert.equal(summary.likelyRedirect404Loop,true);
 assert.equal(summary.redirects,2);
 assert.equal(summary.checkFailures,2);
});
test('single redirect and missing resource is not declared a loop',()=>{
 const events=[
  {status:302,url:{params:[]},location:{params:['_ct']}},
  {status:404,url:{params:['_ct']}}
 ];
 assert.equal(classifyNavigationReport(events).likelyRedirect404Loop,false);
});
test('only document responses are captured',()=>{
 const xhr={request:()=>({resourceType:()=> 'xhr'})};
 assert.equal(collectNavigationResponse(xhr),null);
 const doc={
  request:()=>({resourceType:()=> 'document'}),
  status:()=>302,
  url:()=> 'https://batcave.biz/',
  headers:()=>({location:'/?_ct=PRIVATE'})
 };
 const result=collectNavigationResponse(doc);
 assert.equal(result.status,302);
 assert.deepEqual(result.location.params,['_ct']);
 assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});

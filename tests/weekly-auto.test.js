import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {isEligiblePdfIssue,matchesNewestChapter,validateLocalPdf} from '../src/browser-download.js';
import {runAutomatedWeekly} from '../src/weekly-auto.js';

const issue=(number='3',id='issue-3')=>({
  id,series_url:'https://batcave.biz/33390-absolute-flash-2025.html',
  issue_url:'https://batcave.biz/reader/33390/46696',
  series_title:'Sample Flash',issue_number:'#'+number,
  subscription_id:'s1',release_date:'2026-10-21'
});
const muted={log(){},warn(){}};
test('only supported non-adult reader URLs are considered',()=>{
  assert.equal(isEligiblePdfIssue(issue()),true);
  assert.equal(isEligiblePdfIssue({...issue(),series_title:'18+ Sample'}),false);
  assert.equal(isEligiblePdfIssue({...issue(),issue_url:'https://another.example/reader/1/2'}),false);
  assert.equal(isEligiblePdfIssue({...issue(),issue_url:'https://batcave.biz/new-comics.html'}),false);
});
test('newest chapter must match the intended reader URL',()=>{
  assert.ok(matchesNewestChapter('https://batcave.biz/reader/33390/46696',['/reader/33390/46696','/reader/33390/111']));
  assert.ok(!matchesNewestChapter('https://batcave.biz/reader/33390/46696',['/reader/33390/111','/reader/33390/46696']));
});
test('a valid attachment is mailed and only then marked delivered',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wpl-auto-'));
 try {
  const events=[],i=issue(),pdf=Buffer.from('%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF');
  const result=await runAutomatedWeekly({
    now:new Date('2026-10-21T21:00:00Z'),pdfDir:dir,
    load:async()=>events.push('init'),
    update:async()=>1,
    pending:async()=>[i],
    openBrowser:async()=>({close:async()=>events.push('close')}),
    download:async(_,item,{outputDir})=>{
      events.push('download');writeFileSync(join(outputDir,item.id+'.pdf'),pdf);
    },
    email:async()=>{events.push('email');return {messageId:'demo'};},
    record:async()=>events.push('delivered'),
    complete:async()=>events.push('week-complete'),
    logger:muted
  });
  assert.equal(result.status,'sent');
  assert.equal(result.delivered,1);
  assert.deepEqual(events,['init','download','email','delivered','close','week-complete']);
  await validateLocalPdf(join(dir,i.id+'.pdf'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('SMTP failure prevents marking an issue as delivered',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wpl-auto-'));
 try {
  const events=[],i=issue();
  mkdirSync(dir,{recursive:true});
  writeFileSync(join(dir,i.id+'.pdf'),'%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF');
  const result=await runAutomatedWeekly({
    now:new Date('2026-10-21T21:00:00Z'),pdfDir:dir,
    load:async()=>{},update:async()=>1,pending:async()=>[i],
    email:async()=>{throw Error('SMTP unavailable');},
    record:async()=>events.push('delivered'),
    complete:async()=>events.push('complete'),logger:muted
  });
  assert.equal(result.status,'incomplete');
  assert.equal(result.delivered,0);
  assert.deepEqual(events,[]);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('dry runs never start the browser or send mail',async()=>{
 const result=await runAutomatedWeekly({
  now:new Date('2026-10-21T21:00:00Z'),dryRun:true,
  load:async()=>{},update:async()=>1,pending:async()=>[issue()],
  openBrowser:async()=>{throw Error('launched browser in dry run')},
  email:async()=>{throw Error('emailed in dry run')},
  logger:muted
 });
 assert.equal(result.status,'preview');assert.equal(result.issues.length,1);
});

test('accepted mail receipt prevents duplicate email after database write fails',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wpl-receipt-'));
 try{
  const i=issue('5','receipt-case');
  const file=join(dir,i.id+'.pdf');
  writeFileSync(file,'%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF');
  let mailed=0,recorded=0;
  const args={
   now:new Date('2026-10-21T21:00:00Z'),pdfDir:dir,
   load:async()=>{},update:async()=>1,pending:async()=>[i],
   email:async()=>{mailed++;return {messageId:'mail-1'};},
   complete:async()=>{},logger:muted
  };
  const first=await runAutomatedWeekly({...args,record:async()=>{throw Error('Turso unavailable');}});
  assert.equal(first.status,'incomplete');
  assert.equal(mailed,1);
  const second=await runAutomatedWeekly({...args,record:async()=>{recorded++;}});
  assert.equal(second.status,'sent');
  assert.equal(mailed,1);
  assert.equal(recorded,1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

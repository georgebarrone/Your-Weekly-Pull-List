import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {processPdfInbox,loadLedger,emailConfig,MAX_PDF_BYTES} from '../src/local-pdf-inbox.js';

test('local PDF inbox sends approved folder PDFs only once and ignores other files',async()=>{
  const root=mkdtempSync(join(tmpdir(),'wpl-pdf-'));
  try{
    const inbox=join(root,'inbox'),ledgerFile=join(root,'ledger.json');
    mkdirSync(inbox);
    writeFileSync(join(inbox,'Sample #3.pdf'),'%PDF-1.7\nExample small file\n%%EOF');
    writeFileSync(join(inbox,'not-a-pdf.pdf'),'this is not a PDF');
    writeFileSync(join(inbox,'notes.txt'),'%PDF-1.7\nnot an attachment');
    const calls=[];
    const sender=async (path,name)=>{calls.push(name);return {messageId:'test-message'};};
    const opts={inbox,ledgerFile,send:sender,now:Date.now()+60_000,logger:{log(){},warn(){}}};
    assert.equal((await processPdfInbox(opts)).sent,1);
    assert.deepEqual(calls,['Sample #3.pdf']);
    assert.equal((await processPdfInbox(opts)).sent,0);
    assert.equal(Object.keys(loadLedger(ledgerFile).sent).length,1);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('oversized PDFs are not sent',async()=>{
  const root=mkdtempSync(join(tmpdir(),'wpl-big-'));
  try{
    const fs=await import('node:fs');
    const file=join(root,'too-large.pdf');
    writeFileSync(file,'%PDF-');
    fs.truncateSync(file,MAX_PDF_BYTES+1);
    const opts={inbox:root,ledgerFile:join(root,'ledger.json'),send:()=>{throw Error('should not send')},now:Date.now()+60_000,logger:{log(){},warn(){}}};
    const report=await processPdfInbox(opts);
    assert.equal(report.tooLarge,1);
    assert.equal(report.sent,0);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('requires a single configured recipient',()=>{
  const base={SMTP_USER:'sender@gmail.com',SMTP_APP_PASSWORD:'app-password',EMAIL_TO:'inbox@gmail.com'};
  assert.equal(emailConfig(base).to,'inbox@gmail.com');
  assert.throws(()=>emailConfig({...base,EMAIL_TO:'a@example.com,b@example.com'}),/single address/);
  assert.throws(()=>emailConfig({...base,SMTP_APP_PASSWORD:''}),/Set SMTP/);
});

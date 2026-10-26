import {mkdir,open,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {MAX_PDF_BYTES} from './local-pdf-inbox.js';
import {normalizeSeriesUrl} from './core.js';

export const PROFILE_DIR=resolve('data','browser-profile');
export const WEEKLY_PDF_DIR=resolve('data','weekly-pdfs');

// Playwright's persistent Firefox profile stays solely on the user's PC.
// Firefox uses the normal browser download flow instead of Chromium's
// File System Access directory picker. We never extract reader page images.
export async function openDownloadBrowser({profileDir=PROFILE_DIR,headless=false}={}){
  const {firefox}=await import('playwright');
  await mkdir(profileDir,{recursive:true});
  const context=await firefox.launchPersistentContext(profileDir,{
    headless,acceptDownloads:true,viewport:{width:1280,height:900},
  });
  context.setDefaultTimeout(15000);
  return context;
}
export function isEligiblePdfIssue(item){
  if(!item||!normalizeSeriesUrl(item.series_url))return false;
  try {
    const url=new URL(item.issue_url);
    if(url.protocol!=='https:'||url.hostname!=='batcave.biz')return false;
    if(!/^\\/reader\\/\\d+\\/\\d+\\/?$/.test(url.pathname))return false;
  }catch{return false;}
  // Do not automate any titles explicitly marked adult.
  if(/18\\+|adult only|erotica|hentai|pornograph/i.test(String(item.series_title||'')))return false;
  return true;
}
function readerKey(input){
  try{return new URL(input,'https://batcave.biz').pathname.replace(/\\/$/,'');}
  catch{return null;}
}
export function matchesNewestChapter(target,readerUrls){
  const expected=readerKey(target);
  return !!expected&&readerUrls.length>0&&readerKey(readerUrls[0])===expected;
}
async function readValidatedPdf(path){
  const size=(await stat(path)).size;
  if(size<20||size>MAX_PDF_BYTES)throw Error('Downloaded PDF is empty or exceeds the email size limit');
  const f=await open(path,'r');
  try{
    const buf=Buffer.alloc(5);await f.read(buf,0,5,0);
    if(buf.toString()!=='%PDF-')throw Error('Download was not a PDF');
  }finally{await f.close();}
  return size;
}
export async function validateLocalPdf(path){return readValidatedPdf(path);}

// Use only the site's visible, account-authorized controls. No hidden API,
// cookie injection, rate-limit evasion, challenge solving, or image scraping.
// Downloading exactly the newest issue is permitted only if it matches the
// catalog issue's reader URL. On any uncertainty stop instead of emailing
// the wrong issue or a whole series.
export async function downloadNewestPdf(context,issue,{outputDir=WEEKLY_PDF_DIR}={}){
  if(!isEligiblePdfIssue(issue))throw Error('Issue URL is unsupported or restricted');
  await mkdir(outputDir,{recursive:true});
  const page=await context.newPage();
  try {
    const response=await page.goto(issue.series_url,{waitUntil:'domcontentloaded',timeout:30000});
    if(!response?.ok())throw Error('Series page did not load');
    const links=page.locator('a[href*="/reader/"]');
    await links.first().waitFor({state:'attached',timeout:20000});
    const hrefs=await links.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')).filter(Boolean));
    if(!matchesNewestChapter(issue.issue_url,hrefs)){
      throw Error('Cannot verify that this issue is the newest chapter. Skipping to avoid downloading a different issue.');
    }
    const openButton=page.getByRole('button',{name:/download all/i}).first();
    if(await openButton.count())await openButton.click();
    else await page.getByText(/download all/i).first().click();
    const dialog=page.locator('[role="dialog"], .download-modal, .download-dialog, .modal').filter({hasText:/Download chapters/i}).last();
    await dialog.waitFor({state:'visible',timeout:10000});
    await dialog.getByText('Latest',{exact:true}).first().click();
    await dialog.getByText('PDF',{exact:true}).first().click();
    // The operator must accept the site's ordinary storage disclosure.
    const consent=dialog.locator('input[type="checkbox"]').last();
    await consent.waitFor({state:'visible',timeout:5000});
    await consent.check();
    const button=dialog.getByRole('button',{name:/start download/i});
    if(!(await button.isEnabled()))throw Error('Download not permitted for this account or issue');
    // The site may use a native folder picker rather than a browser download.
    // If so this times out safely and requires a supported integration, not a bypass.
    const wait=page.waitForEvent('download',{timeout:120000});
    await button.click();
    const download=await wait;
    const failure=await download.failure();
    if(failure)throw Error('The browser reported a failed download');
    const output=join(resolve(outputDir),issue.id+'.pdf');
    await download.saveAs(output);
    await readValidatedPdf(output);
    return output;
  }finally{await page.close();}
}

import * as cheerio from 'cheerio';
import {normalizeSeriesUrl} from './core.js';

const HOME = 'https://batcave.biz/';
let snapshot={items:[],expires:0};
let inFlight=null;

// Extract title metadata only. No issue pages, reader assets, or downloads.
export function parseSeriesIndex(html,baseUrl=HOME) {
  const $=cheerio.load(html);
  const seen=new Map();
  $('a[href]').each((_,a)=>{
    const href=$(a).attr('href');
    let url;
    try {url=normalizeSeriesUrl(new URL(href,baseUrl).toString());} catch {return;}
    if(!url) return;
    const title=$(a).text().replace(/\s+/g,' ').replace(/^\d(?:\.\d)?\s*/,'').trim();
    if(title.length<2||title.length>180||/^\d+$/.test(title))return;
    // Exclude listings explicitly tagged for adults.
    if(/\b18\+\b/.test($(a).text())||/^18\+/.test($(a).parent().text().trim()))return;
    const old=seen.get(url);
    if(!old||title.length<old.title.length)seen.set(url,{title,url});
  });
  return [...seen.values()];
}

async function getPublicIndex(fetchFn=fetch) {
  if(Date.now()<snapshot.expires)return snapshot.items;
  if(inFlight)return inFlight;
  inFlight=(async()=>{
    try{
      const response=await fetchFn(HOME,{redirect:'error',headers:{Accept:'text/html','User-Agent':'YourWeeklyPullList/0.2 (personal metadata tracker)'},signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw Error('Public series directory unavailable');
      const html=await response.text();
      if(html.length>5_000_000)throw Error('Index too large');
      snapshot={items:parseSeriesIndex(html),expires:Date.now()+5*60_000};
      return snapshot.items;
    }catch(error){
      if(snapshot.items.length)return snapshot.items;
      console.warn('Public title index unavailable:',error.message);
      return [];
    }finally{inFlight=null;}
  })();
  return inFlight;
}

export function filterSeries(items,rawQuery,limit=12){
  const q=String(rawQuery||'').trim().toLowerCase().replace(/\s+/g,' ');
  if(q.length<2||q.length>80)return [];
  const unique=new Map();
  for(const item of items){
    const title=String(item.title||'').trim();
    if(!title.toLowerCase().includes(q)||!normalizeSeriesUrl(item.url))continue;
    if(!unique.has(item.url))unique.set(item.url,{title,url:item.url,publisher:item.publisher||''});
  }
  return [...unique.values()].sort((a,b)=>{
    const rank=x=>x.title.toLowerCase()===q?0:x.title.toLowerCase().startsWith(q)?1:2;
    return rank(a)-rank(b)||a.title.localeCompare(b.title);
  }).slice(0,limit);
}

export async function searchPublicSeries(query,local=[],fetchFn=fetch){
  const external=await getPublicIndex(fetchFn);
  return filterSeries([...local,...external],query);
}

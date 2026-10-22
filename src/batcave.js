import * as cheerio from 'cheerio';
import {idFor, isoDate, normalizeSeriesUrl} from './core.js';

const MONTHS = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const YEAR_RE = /New Comics This Week:\s*[A-Z][a-z]+\s+\d{1,2},\s*(\d{4})/i;

// Catalog only: never obtains comic image pages, chapters, or PDFs.
export function parseWeeklyHtml(html, baseUrl = 'https://batcave.biz/new-comics.html') {
  const $ = cheerio.load(html);
  const year = Number($('h1').first().text().match(YEAR_RE)?.[1]) || new Date().getUTCFullYear();
  const records = [];
  $('h2').each((_, heading) => {
    const label = $(heading).text().trim();
    const publisher = label.split('—')[0].trim();
    let sibling = $(heading).next();
    while (sibling.length && !sibling.is('h2')) {
      const issueLinks = sibling.find('a[href]').addBack('a[href]').filter((_, a)=>/\/reader\/\d+\/\d+/.test($(a).attr('href')||''));
      issueLinks.each((__, a) => {
        const issueAnchor = $(a);
        let row = issueAnchor.parent();
        let seriesAnchor = $();
        let dateMatch;
        // Real pages may use <li>, <article>, or div-based rows.
        // Find the smallest container containing one reader link, its series link and a date.
        for (let depth=0; depth<7 && row.length; depth++) {
          const otherIssues = row.find('a[href]').filter((_, x)=>/\/reader\/\d+\/\d+/.test($(x).attr('href')||''));
          if (otherIssues.length>1) break;
          const links = row.find('a[href]');
          const candidate = links.filter((_, x)=>{
            try {return !!normalizeSeriesUrl(new URL($(x).attr('href'), baseUrl).toString());}
            catch {return false;}
          }).last();
          const date = row.text().replace(/\s+/g,' ').match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\b/i);
          if (candidate.length && date) {seriesAnchor=candidate;dateMatch=date;break;}
          if (row[0]===sibling[0]) break;
          row=row.parent();
        }
        if (!seriesAnchor.length || !dateMatch) return;
        const seriesUrl = normalizeSeriesUrl(new URL(seriesAnchor.attr('href'), baseUrl).toString());
        const issueUrl = new URL(issueAnchor.attr('href'),baseUrl);
        if (issueUrl.hostname !== 'batcave.biz' && issueUrl.hostname !== 'www.batcave.biz') return;
        let issueYear = year;
        const month = MONTHS[dateMatch[1].toLowerCase()];
        if (year && month === 12 && /January/i.test($('h1').first().text())) issueYear--;
        if (year && month === 1 && /December/i.test($('h1').first().text())) issueYear++;
        const releaseDate = isoDate(issueYear,month,Number(dateMatch[2]));
        if (!releaseDate || !seriesUrl) return;
        const number = issueAnchor.text().replace(/\s+/g,' ').trim();
        const title = seriesAnchor.text().replace(/\s+/g,' ').trim();
        if (!title || !number) return;
        const img = row.find('img').first();
        const rawCover = img.attr('data-src') || img.attr('src') || null;
        let coverUrl = null;
        if (rawCover) {
          try { const u = new URL(rawCover,baseUrl); if (u.protocol==='https:' && (u.hostname==='batcave.biz' || u.hostname.endsWith('.batcave.biz'))) coverUrl=u.toString(); } catch {}
        }
        records.push({id:idFor(seriesUrl,number,releaseDate),series_url:seriesUrl,series_title:title,
          issue_number:number,release_date:releaseDate,issue_url:issueUrl.toString(),
          publisher:publisher.replace(/\s*—.*/,''),cover_url:coverUrl,
          date_source:'BatCave weekly listing (not independently verified)'});
      });
      sibling = sibling.next();
    }
  });
  return [...new Map(records.map(r=>[r.id,r])).values()];
}

export async function fetchWeeklyReleases(fetchFn = fetch) {
  const response = await fetchFn('https://batcave.biz/new-comics.html', {headers:{'User-Agent':'YourWeeklyPullList/0.1 (+personal comic metadata tracker)','Accept':'text/html'},signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`Comic catalog HTTP ${response.status}`);
  const html = await response.text();
  const releases = parseWeeklyHtml(html);
  if (!releases.length) throw new Error('No issue metadata detected; site may have changed its page structure');
  return releases;
}

export async function fetchSeriesMeta(url, fetchFn = fetch) {
  const safe = normalizeSeriesUrl(url);
  if (!safe) throw new Error('Paste a BatCave series link ending in .html');
  const response = await fetchFn(safe, {headers:{'User-Agent':'YourWeeklyPullList/0.1','Accept':'text/html'},signal:AbortSignal.timeout(12000),redirect:'error'});
  if (!response.ok) throw new Error(`Series page HTTP ${response.status}`);
  const $ = cheerio.load(await response.text());
  const title = $('h1').first().text().trim();
  if (!title || title.length > 180) throw new Error('Could not read series title');
  const body = $('body').text().replace(/\s+/g,' ');
  const publisher = body.match(/Publisher:\s*(.{2,60}?)\s*(?:Release type:|Writer:|Artist:)/i)?.[1]?.trim() || '';
  const kind = /Release type:\s*Completed/i.test(body) ? 'limited' : 'ongoing';
  return {title, publisher, kind, url:safe};
}

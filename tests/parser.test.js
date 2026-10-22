import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWeeklyHtml} from '../src/batcave.js';
const fixture=`<h1>New Comics This Week: October 21, 2026</h1><h2>DC — 2 new issues</h2><ul><li><a href="/reader/33390/277097">#20</a><a href="/33390-absolute-flash-2025.html">Absolute Flash</a>Oct 21</li><li><a href="/reader/123/456">#8</a><a href="/123-batwoman-2026.html">Batwoman</a>Oct 22</li></ul><h2>Marvel — 1 new issue</h2><ul><li><a href="/reader/555/666">#1</a><a href="/555-iron-man-2026.html">Iron Man</a>Oct 21</li></ul>`;
test('weekly HTML extracts issues, publisher, URLs and dates',()=>{
 const issues=parseWeeklyHtml(fixture);
 assert.equal(issues.length,3);
 assert.equal(issues[0].series_title,'Absolute Flash');
 assert.equal(issues[0].issue_number,'#20');
 assert.equal(issues[0].release_date,'2026-10-21');
 assert.equal(issues[1].release_date,'2026-10-22');
 assert.equal(issues[2].publisher,'Marvel');
 assert.match(issues[0].issue_url,/\/reader\/33390\/277097/);
});
test('ignore malformed content',()=>assert.deepEqual(parseWeeklyHtml('<h1>Test</h1><h2>Test</h2>'),[]));

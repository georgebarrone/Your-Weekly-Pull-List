import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSeriesIndex,filterSeries} from '../src/search.js';

const example=`<!doctype html><html><body>
<a href="/33390-absolute-flash-2025.html">Absolute Flash (2025-)</a>
<a href="/22555-absolute-batman-2024.html">Absolute Batman (2024-)</a>
<a href="/33390-absolute-flash-2025.html">Absolute Flash (2025-)</a>
<a href="https://evil.example/1234-bad.html">Malicious title</a>
<a href="/reader/99/5/">Issue #4</a>
</body></html>`;

test('series index extracts only supported, deduplicated series metadata',()=>{
 const list=parseSeriesIndex(example);
 assert.equal(list.length,2);
 assert.ok(list.some(x=>x.title==='Absolute Flash (2025-)' && x.url==='https://batcave.biz/33390-absolute-flash-2025.html'));
 assert.ok(!list.some(x=>x.title==='Malicious title'));
});
test('autocomplete ranks exact matches and rejects overly short queries',()=>{
 const list=[{title:'The Flash',url:'https://batcave.biz/444-the-flash.html'},...parseSeriesIndex(example)];
 assert.deepEqual(filterSeries(list,'f'),[]);
 assert.equal(filterSeries(list,'Absolute Fla')[0].title,'Absolute Flash (2025-)');
 assert.equal(filterSeries(list,'flash').length,2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {weekBounds,normalizeSeriesUrl,matchingSeries,idFor,isWednesdayAfter135Pacific,escapeHtml} from '../src/core.js';
import {hashPin,verifyPin,issueSession,verifySession} from '../src/auth.js';

test('weeks run Wednesday–Tuesday including New Year',()=>{
  assert.deepEqual(weekBounds('2026-10-21'),{start:'2026-10-21',end:'2026-10-27'});
  assert.deepEqual(weekBounds('2026-10-27'),{start:'2026-10-21',end:'2026-10-27'});
  assert.deepEqual(weekBounds('2027-01-01'),{start:'2026-12-30',end:'2027-01-05'});
});
test('Pacific time handles daylight-saving switches',()=>{
  assert.ok(isWednesdayAfter135Pacific(new Date('2026-10-21T20:35:00Z')));
  assert.ok(isWednesdayAfter135Pacific(new Date('2026-12-02T21:35:00Z')));
  assert.equal(isWednesdayAfter135Pacific(new Date('2026-10-21T19:35:00Z')),false);
  assert.ok(isWednesdayAfter135Pacific(new Date('2026-10-21T21:35:00Z')));
});
test('normalize safe series URL',()=>{
  assert.equal(normalizeSeriesUrl('https://batcave.biz/33390-absolute-flash-2025.html?foo=bar'),'https://batcave.biz/33390-absolute-flash-2025.html');
  assert.equal(normalizeSeriesUrl('https://evil.test/33390-absolute-flash-2025.html'),null);
  assert.equal(normalizeSeriesUrl('http://batcave.biz/33390-absolute-flash-2025.html'),null);
});
test('series name normalization and IDs',()=>{
  assert.ok(matchingSeries('Absolute Flash (2025-)','Absolute Flash'));
  assert.equal(idFor('a','b'),idFor('a','b'));
  assert.notEqual(idFor('a','b'),idFor('b','a'));
  assert.equal(escapeHtml('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');
});
test('PIN and tamper-resistant session',()=>{
  const pinHash=hashPin('123456');assert.ok(verifyPin('123456',pinHash));
  assert.equal(verifyPin('654321',pinHash),false);
  const secret='this-is-a-very-very-long-unique-test-secret-1234';const session=issueSession(secret);
  assert.ok(verifySession(session,secret));assert.equal(verifySession(session+'x',secret),false);
});

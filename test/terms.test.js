import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTerms, upsertTerms } from '../src/core/terms.js';
import { assess, contractFromPage } from '../src/core/contracts.js';

const terms = { counterparty: 'Helio Couriers', startDate: '1 March 2026', initialTerm: '12 months', renewal: 'Automatic, 12 months', noticePeriod: '45 days', annualValue: 'USD 28,800' };

test('terms are checked before they are written', () => {
  const ok = checkTerms(terms);
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.terms.startDate, '2026-03-01');
  const bad = checkTerms({ startDate: '03/01/2026', initialTerm: 'a while', renewal: 'Renews for 1 year', noticePeriod: '' });
  assert.deepEqual(bad.problems, [
    'Notice period is missing.',
    'Start date "03/01/2026" is not a date; use YYYY-MM-DD.',
    'Initial term "a while" is not a length of time.',
    'Renewal "Renews for 1 year" should start with Automatic or Manual.',
  ]);
});

test('a page without a table gets one at the top, and the dates follow', () => {
  const page = '<p>This Agreement commences on 1 March 2026 ...</p>';
  const out = upsertTerms(page, checkTerms(terms).terms);
  assert.match(out, /^<ac:structured-macro ac:name="details"/);
  assert.ok(out.endsWith(page));
  const c = assess(contractFromPage({ id: 9, title: 'Helio', body: out }), '2026-10-28');
  assert.equal(c.termEnds, '2027-02-28');
  assert.equal(c.noticeBy, '2027-01-14');
  assert.equal(c.state, 'soon');
});

test('an existing table keeps its other rows and takes the new values', () => {
  const page = '<ac:structured-macro ac:name="details" ac:schema-version="1"><ac:rich-text-body><table><tbody>'
    + '<tr><th><p>Owner</p></th><td><p><ac:link><ri:user ri:account-id="u7" /></ac:link></p></td></tr>'
    + '<tr><th><p>Notice period</p></th><td><p>30 days</p></td></tr>'
    + '<tr><th><p>Cost centre</p></th><td><p>CC-12</p></td></tr>'
    + '</tbody></table></ac:rich-text-body></ac:structured-macro><p>text</p>';
  const out = upsertTerms(page, checkTerms(terms).terms);
  assert.equal((out.match(/ac:name="details"/g) || []).length, 1);
  assert.match(out, /ri:account-id="u7"/);
  assert.ok(out.indexOf('Owner') < out.indexOf('Start date') && out.indexOf('Counterparty') < out.indexOf('Owner'));
  assert.match(out, /<td><p>45 days<\/p><\/td>/);
  assert.match(out, /Cost centre/);
  assert.ok(out.endsWith('<p>text</p>'));
});

test('the plain-text sample has no table, so it is not read as a contract until its terms are filled in', async () => {
  const { RAW_SAMPLE, rawSampleBody } = await import('../src/core/sample.js');
  assert.equal(contractFromPage({ id: 10, title: RAW_SAMPLE.title, body: rawSampleBody() }), null);
  assert.match(rawSampleBody(), /forty-five \(45\) days/);
});

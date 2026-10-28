import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageProperties } from '../src/core/properties.js';
import { assess, assessAll, contractFromPage, parseMoney, parseRenewal, valueAtStake } from '../src/core/contracts.js';
import { planTasks, descriptionAdf, taskLabel } from '../src/core/tasks.js';
import { SAMPLE, sampleBody } from '../src/core/sample.js';

const details = (rows) => `<p>x</p><ac:structured-macro ac:name="details" ac:schema-version="1"><ac:rich-text-body><table><tbody>${
  rows.map(([k, v]) => `<tr><th><p>${k}</p></th><td><p>${v}</p></td></tr>`).join('')}</tbody></table></ac:rich-text-body></ac:structured-macro>`;

test('page properties: text, date picker values and mentioned users', () => {
  const p = pageProperties(details([
    ['Counterparty', 'Acme &amp; Sons'],
    ['Owner', '<ac:link><ri:user ri:account-id="abc-123" /></ac:link>'],
    ['Start date', '<time datetime="2025-02-01" />'],
    ['Notice period:', '60&nbsp;days'],
  ]));
  assert.equal(p.get('counterparty').text, 'Acme & Sons');
  assert.deepEqual(p.get('owner').accountIds, ['abc-123']);
  assert.equal(p.get('start date').date, '2025-02-01');
  assert.equal(p.get('notice period').text, '60 days');
  const plain = pageProperties('<table><tr><td>Notice period</td><td>30 days</td></tr></table>');
  assert.equal(plain.get('notice period').text, '30 days');
  assert.equal(pageProperties('<table><tr><td>Colour</td><td>red</td></tr></table>').size, 0);
});

test('renewal and money wording', () => {
  assert.deepEqual(parseRenewal('Automatic, 12 months'), { auto: true, term: { months: 12, days: 0 } });
  assert.deepEqual(parseRenewal('Manual'), { auto: false, term: null });
  assert.equal(parseRenewal('Renews for 1 year').auto, null);
  assert.deepEqual(parseMoney('USD 48,000'), { amount: 48000, currency: 'USD' });
  assert.deepEqual(parseMoney('€36,000.50 per year'), { amount: 36000.5, currency: 'EUR' });
  assert.deepEqual(parseMoney('12 000 GBP'), { amount: 12000, currency: 'GBP' });
});

const page = (id, rows) => ({ id, title: `Contract ${id}`, url: `https://x/wiki/${id}`, body: details(rows) });
const base = [['Counterparty', 'Acme'], ['Owner', '<ac:link><ri:user ri:account-id="u1" /></ac:link>']];

test('an automatic renewal rolls forward to the current term and gives the last notice day', () => {
  const c = assess(contractFromPage(page(1, [...base, ['Start date', '<time datetime="2024-02-01" />'],
    ['Initial term', '12 months'], ['Renewal', 'Automatic, 12 months'], ['Notice period', '60 days']])), '2026-10-28');
  assert.equal(c.renewals, 2);
  assert.equal(c.termEnds, '2027-01-31');
  assert.equal(c.renewsOn, '2027-02-01');
  assert.equal(c.noticeBy, '2026-12-02');
  assert.equal(c.daysLeft, 35);
  assert.equal(c.state, 'soon');
  assert.deepEqual(c.findings, []);
});

test('states: act, closed with the next chance, fixed term, incomplete', () => {
  const today = '2026-10-28';
  const act = assess(contractFromPage(page(2, [...base, ['Start date', '2025-12-31'], ['Initial term', '12 months'],
    ['Renewal', 'Automatic'], ['Notice period', '2 months']])), today);
  assert.equal(act.termEnds, '2026-12-30');
  assert.equal(act.noticeBy, '2026-10-30');
  assert.equal(act.state, 'act');
  const closed = assess(contractFromPage(page(3, [...base, ['Start date', '2025-12-01'], ['Initial term', '1 year'],
    ['Renewal', 'Automatic, 1 year'], ['Notice period', '90 days']])), today);
  assert.equal(closed.state, 'closed');
  assert.equal(closed.renewsOn, '2026-12-01');
  assert.equal(closed.nextNoticeBy, '2027-09-01');
  const fixed = assess(contractFromPage(page(4, [...base, ['Start date', '2026-05-01'], ['Initial term', '6 months'],
    ['Renewal', 'Manual'], ['Notice period', '30 days']])), today);
  assert.equal(fixed.state, 'act');
  assert.equal(fixed.termEnds, '2026-10-31');
  assert.equal(fixed.renewsOn, null);
  const over = assess(contractFromPage(page(5, [...base, ['End date', '2026-09-30'], ['Renewal', 'None'], ['Notice period', '30 days']])), today);
  assert.equal(over.state, 'ended');
  const missing = assess(contractFromPage(page(6, [['Counterparty', 'Acme'], ['Start date', '2026-01-01'],
    ['Initial term', '12 months'], ['Renewal', 'Automatic, 12 months']])), today);
  assert.equal(missing.state, 'incomplete');
  assert.deepEqual(missing.findings, ['No notice period.', 'No owner.']);
  const business = assess(contractFromPage(page(8, [...base, ['Start date', '2026-01-01'], ['Initial term', '12 months'],
    ['Renewal', 'Automatic, 12 months'], ['Notice period', '30 business days']])), today);
  assert.equal(business.state, 'incomplete');
  assert.match(business.findings[0], /business days/);
  assert.equal(contractFromPage({ id: 7, title: 'Minutes', body: '<p>no table</p>' }), null);
});

test('the sample shows every state, and tasks are planned once per notice day', () => {
  const today = '2026-10-28';
  const pages = SAMPLE.map((s, i) => ({ id: 100 + i, title: s.title, url: `https://x/${i}`, body: sampleBody(s, today, 'u1') }));
  const all = assessAll(pages, today);
  const by = Object.fromEntries(all.map((c) => [c.counterparty, c]));
  assert.equal(by['Orbitline Analytics Ltd'].state, 'act');
  assert.equal(by['Orbitline Analytics Ltd'].daysLeft, 12);
  assert.equal(by['Bluefin Payroll Services'].state, 'closed');
  assert.equal(by['Harborview Facilities'].state, 'soon');
  assert.equal(by['Lumen & Pike Design Studio'].state, 'act');
  assert.equal(by['Quarrystone Cloud Storage'].state, 'later');
  assert.equal(by['Pinecrest Travel Desk'].state, 'incomplete');
  assert.deepEqual(all.map((c) => c.state), ['act', 'act', 'closed', 'soon', 'later', 'later', 'incomplete']);
  assert.deepEqual(valueAtStake(all, 30), { USD: 66000 });
  const tasks = planTasks(all, 30);
  assert.deepEqual(tasks.map((t) => t.pageId), ['100', '103']);
  assert.equal(tasks[0].label, taskLabel(by['Orbitline Analytics Ltd']));
  assert.match(tasks[0].summary, /^Give notice to Orbitline Analytics Ltd by 9 Nov 2026, or the contract renews on /);
  assert.equal(tasks[0].assignee, 'u1');
  assert.match(tasks[1].summary, /^Decide on Lumen & Pike Design Studio by 22 Nov 2026/);
  const adf = descriptionAdf(tasks[0]);
  assert.equal(adf.content.at(-1).content[1].marks[0].attrs.href, 'https://x/0');
});

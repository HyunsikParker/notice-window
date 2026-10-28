// A fictional set of vendor contracts, dated relative to today so that every state shows up whenever it is loaded.
import { addDays, shift } from './dates.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// noticeIn: days from today to the last notice day (negative = already passed). Start dates are derived from it.
export const SAMPLE = [
  { title: 'Orbitline Analytics: data platform subscription', counterparty: 'Orbitline Analytics Ltd', term: 12, renewal: 'Automatic, 12 months', notice: '60 days', noticeDays: 60, noticeIn: 12, value: 'USD 48,000', summary: 'Subscription to the Orbitline data platform for the analytics team: 40 seats, standard support.' },
  { title: 'Bluefin Payroll: payroll service', counterparty: 'Bluefin Payroll Services', term: 12, renewal: 'Automatic, 12 months', notice: '90 days', noticeDays: 90, noticeIn: -5, value: 'EUR 36,000', summary: 'Monthly payroll processing for the EU entities.' },
  { title: 'Harborview Facilities: office cleaning', counterparty: 'Harborview Facilities', term: 24, renewal: 'Automatic, 24 months', notice: '3 months', noticeMonths: 3, noticeIn: 41, value: 'USD 120,000', summary: 'Cleaning and waste services for the main office.' },
  { title: 'Lumen & Pike: design retainer', counterparty: 'Lumen & Pike Design Studio', term: 6, renewal: 'Manual', notice: '30 days', noticeDays: 30, noticeIn: 25, value: 'USD 18,000', summary: 'Design retainer for marketing campaigns; renews only if both sides sign an extension.' },
  { title: 'Quarrystone: cloud storage', counterparty: 'Quarrystone Cloud Storage', term: 12, renewal: 'Automatic, 12 months', notice: '30 days', noticeDays: 30, noticeIn: 160, value: 'USD 9,600', summary: 'Object storage for backups, 40 TB committed.' },
  { title: 'Atlas Lane: legal research database', counterparty: 'Atlas Lane Legal Research', term: 36, renewal: 'Automatic, 36 months', notice: '6 months', noticeMonths: 6, noticeIn: 300, value: 'USD 54,000', summary: 'Research database licence for the legal team, 12 users.' },
  { title: 'Pinecrest Travel: corporate travel desk', counterparty: 'Pinecrest Travel Desk', term: 12, renewal: 'Automatic, 12 months', notice: '', noticeIn: 70, value: 'USD 15,000', summary: 'Corporate travel booking. The notice period was never copied from the signed contract.' },
];

// A contract pasted as text with no properties table yet, for trying "Fill in the contract terms from this page" in Rovo.
export const RAW_SAMPLE = {
  title: 'Helio Couriers: same-day delivery agreement',
  paragraphs: [
    'Fictional sample contract created by Notice Window, pasted as plain text so that Rovo can fill in its terms table.',
    'This Delivery Services Agreement is made between Helio Couriers Ltd ("Supplier") and the Customer.',
    '2.1 This Agreement commences on 1 March 2026 and continues for an initial term of twelve (12) months.',
    '2.2 Thereafter it renews automatically for successive periods of twelve (12) months unless either party gives the other written notice of non-renewal at least forty-five (45) days before the end of the then-current term.',
    '5.1 The Customer shall pay an annual fee of USD 28,800, invoiced monthly in arrears.',
  ],
};

export const rawSampleBody = () => RAW_SAMPLE.paragraphs.map((t, i) => (i === 0 ? `<p><em>${esc(t)}</em></p>` : `<p>${esc(t)}</p>`)).join('');

// The start date that puts the last notice day `noticeIn` days from today, for the sample's term and notice.
export function sampleStart(s, today) {
  const noticeBy = addDays(today, s.noticeIn);
  const notice = s.noticeMonths ? { months: s.noticeMonths, days: 0 } : { months: 0, days: s.noticeDays || 60 };
  const termEnds = shift(noticeBy, notice);
  return shift(addDays(termEnds, 1), { months: s.term, days: 0 }, -1);
}

export function sampleBody(s, today, ownerAccountId) {
  const row = (k, v) => `<tr><th><p>${k}</p></th><td><p>${v}</p></td></tr>`;
  const owner = ownerAccountId ? `<ac:link><ri:user ri:account-id="${esc(ownerAccountId)}" /></ac:link>` : '';
  return [
    '<p><em>Fictional sample contract created by Notice Window.</em></p>',
    '<ac:structured-macro ac:name="details" ac:schema-version="1"><ac:rich-text-body><table><tbody>',
    row('Counterparty', esc(s.counterparty)),
    row('Owner', owner),
    row('Start date', `<time datetime="${sampleStart(s, today)}" />`),
    row('Initial term', `${s.term} months`),
    row('Renewal', esc(s.renewal)),
    row('Notice period', esc(s.notice)),
    row('Annual value', esc(s.value)),
    '</tbody></table></ac:rich-text-body></ac:structured-macro>',
    `<h2>Summary</h2><p>${esc(s.summary)}</p>`,
  ].join('');
}

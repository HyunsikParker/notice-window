// Writes contract terms into a page's page-properties table (the "details" macro). Rows the app does not manage, such
// as Owner, keep their original markup; a page without the macro gets one at the top.
import { parseDate, parseDuration } from './dates.js';
import { parseRenewal } from './contracts.js';

export const TERM_ROWS = [
  ['counterparty', 'Counterparty'],
  ['startDate', 'Start date'],
  ['initialTerm', 'Initial term'],
  ['renewal', 'Renewal'],
  ['noticePeriod', 'Notice period'],
  ['annualValue', 'Annual value'],
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textOf = (html) => String(html).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// Checks the values before anything is written; returns the cleaned terms and a list of problems.
export function checkTerms(input) {
  const terms = {};
  const problems = [];
  for (const [field, label] of TERM_ROWS) {
    const v = String(input[field] ?? '').trim();
    if (v) terms[field] = v;
    else if (field !== 'counterparty' && field !== 'annualValue') problems.push(`${label} is missing.`);
  }
  if (terms.startDate) {
    const d = parseDate(terms.startDate);
    if (d) terms.startDate = d;
    else problems.push(`Start date "${terms.startDate}" is not a date; use YYYY-MM-DD.`);
  }
  if (terms.initialTerm && !parseDuration(terms.initialTerm)) problems.push(`Initial term "${terms.initialTerm}" is not a length of time.`);
  if (terms.noticePeriod && !parseDuration(terms.noticePeriod)) problems.push(`Notice period "${terms.noticePeriod}" is not a number of days, weeks, months or years.`);
  if (terms.renewal && parseRenewal(terms.renewal)?.auto === null) problems.push(`Renewal "${terms.renewal}" should start with Automatic or Manual.`);
  return { terms, problems };
}

function cellHtml(field, value) {
  return field === 'startDate' ? `<time datetime="${value}" />` : esc(value);
}

function rowsOf(table) {
  return [...table.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((m) => {
    const cells = [...m[0].matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((c) => c[2]);
    return { key: textOf(cells[0] || '').replace(/[:*]+$/, '').toLowerCase(), label: textOf(cells[0] || ''), value: cells[1] ?? '' };
  }).filter((r) => r.key);
}

const row = (label, value) => `<tr><th><p>${esc(label)}</p></th><td><p>${value}</p></td></tr>`;

export function upsertTerms(storage, terms) {
  const body = String(storage || '');
  const macro = /<ac:structured-macro\b[^>]*ac:name="details"[\s\S]*?<\/ac:structured-macro>/.exec(body);
  const existing = macro ? rowsOf((/<table\b[\s\S]*?<\/table>/i.exec(macro[0]) || [''])[0]) : [];
  const managed = new Set(TERM_ROWS.map(([, label]) => label.toLowerCase()));
  const keep = (r) => `<tr><th><p>${esc(r.label)}</p></th><td>${r.value}</td></tr>`;
  const owner = existing.find((r) => r.key === 'owner');
  const rows = [];
  for (const [field, label] of TERM_ROWS) {
    const old = existing.find((r) => r.key === label.toLowerCase());
    if (terms[field]) rows.push(row(label, cellHtml(field, terms[field])));
    else if (old) rows.push(keep(old));
    if (field === 'counterparty' && owner) rows.push(keep(owner));  // the owner stays second, as in the template
  }
  for (const r of existing) {
    if (!managed.has(r.key) && r.key !== 'owner') rows.push(keep(r));
  }
  const table = `<ac:structured-macro ac:name="details" ac:schema-version="1"><ac:rich-text-body><table><tbody>${rows.join('')}</tbody></table></ac:rich-text-body></ac:structured-macro>`;
  return macro ? body.replace(macro[0], table) : table + body;
}

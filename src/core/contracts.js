// Turns page properties into contract terms and works out, for today, when the current term ends and the last day
// on which notice can still be given. The rule is the common one: notice must be given at least the notice period
// before the last day of the term. Contracts word this differently, so every result says which rule it applied.
import { pageProperties } from './properties.js';
import { addDays, approxDays, daysBetween, formatDuration, parseDate, parseDuration, shift } from './dates.js';

const ALIASES = {
  counterparty: ['counterparty', 'supplier', 'vendor', 'customer', 'other party'],
  owner: ['owner', 'contract owner', 'business owner'],
  start: ['start date', 'effective date', 'commencement date', 'start'],
  term: ['initial term', 'term', 'contract term'],
  renewal: ['renewal', 'auto-renewal', 'automatic renewal', 'renewal term'],
  notice: ['notice period', 'notice', 'termination notice', 'non-renewal notice'],
  value: ['annual value', 'annual cost', 'annual fee', 'contract value', 'value'],
  end: ['end date', 'expiry date', 'expiration date'],
};

export const WINDOW = { act: 30, soon: 90 };

function pick(props, field) {
  for (const key of ALIASES[field]) if (props.has(key)) return props.get(key);
  return null;
}

export function parseRenewal(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return null;
  if (/\b(no|none|manual|does not|doesn't|not automatic)\b/.test(t)) return { auto: false, term: null };
  if (/\b(auto|automatic|automatically|evergreen|rolling)\b/.test(t)) return { auto: true, term: parseDuration(t) };
  return { auto: null, term: parseDuration(t) };
}

export function parseMoney(text) {
  const t = String(text || '');
  const m = /([A-Z]{3}|[$€£¥₩])?\s*([\d][\d,.\s]*\d|\d)\s*([A-Z]{3})?/.exec(t);
  if (!m) return null;
  const symbols = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₩': 'KRW' };
  const currency = m[3] || (m[1] && (symbols[m[1]] || m[1])) || '';
  const amount = Number(m[2].replace(/[,\s]/g, ''));
  return Number.isFinite(amount) ? { amount, currency } : null;
}

export function contractFromPage(page) {
  const props = pageProperties(page.body);
  if (!props.size || !(pick(props, 'notice') || pick(props, 'renewal') || pick(props, 'term'))) return null;
  const read = (f) => pick(props, f);
  const owner = read('owner');
  const value = read('value');
  return {
    pageId: String(page.id),
    title: page.title,
    url: page.url || '',
    counterparty: read('counterparty')?.text || page.title,
    owner: owner ? { accountIds: owner.accountIds, text: owner.text } : null,
    start: read('start') ? (read('start').date || parseDate(read('start').text)) : null,
    startText: read('start')?.text || '',
    term: parseDuration(read('term')?.text),
    termText: read('term')?.text || '',
    renewal: parseRenewal(read('renewal')?.text),
    renewalText: read('renewal')?.text || '',
    notice: parseDuration(read('notice')?.text),
    noticeText: read('notice')?.text || '',
    end: read('end') ? (read('end').date || parseDate(read('end').text)) : null,
    value: value ? parseMoney(value.text) : null,
    valueText: value?.text || '',
  };
}

// Dates for today. State: act (notice due within 30 days), soon (within 90), later, closed (the notice day has
// passed and the contract renews), ended (a fixed term that is over), incomplete (dates cannot be worked out).
export function assess(c, today) {
  const findings = [];
  const auto = c.renewal?.auto === true;
  if (!c.renewal) findings.push('No renewal row: treated as a fixed term that does not renew.');
  else if (c.renewal.auto === null) findings.push(`Renewal "${c.renewalText}" does not say whether it is automatic.`);
  if (!c.notice && /business/i.test(c.noticeText)) findings.push(`Notice period "${c.noticeText}" is in business days: count it by hand, since holidays differ by place.`);
  else if (!c.notice && c.noticeText) findings.push(`Notice period "${c.noticeText}" is not a number of days, weeks, months or years.`);
  if (!c.notice && !c.noticeText) findings.push('No notice period.');
  if (!c.start && c.startText) findings.push(`Start date "${c.startText}" is not a date (use the date picker or YYYY-MM-DD).`);
  if (!c.term && c.termText) findings.push(`Term "${c.termText}" is not a length of time.`);
  if (!c.owner || (!c.owner.accountIds.length && !c.owner.text)) findings.push('No owner.');

  let renewsOn = null;
  let renewals = 0;
  if (c.start && c.term) {
    renewsOn = shift(c.start, c.term);
    const next = auto ? (c.renewal.term || c.term) : null;
    while (next && addDays(renewsOn, -1) < today && renewals < 600) {
      renewsOn = shift(renewsOn, next);
      renewals += 1;
    }
  } else if (c.end) {
    renewsOn = addDays(c.end, 1);
  } else {
    findings.push('No start date and term, or end date: the term end cannot be worked out.');
  }
  if (c.notice && c.term && approxDays(c.notice) >= approxDays(c.renewal?.term || c.term)) {
    findings.push(`Notice period (${formatDuration(c.notice)}) is as long as the term.`);
  }

  const termEnds = renewsOn ? addDays(renewsOn, -1) : null;
  const noticeBy = termEnds && c.notice ? shift(termEnds, c.notice, -1) : null;
  const nextTerm = auto ? (c.renewal.term || c.term) : null;
  const nextNoticeBy = noticeBy && nextTerm ? shift(addDays(shift(renewsOn, nextTerm), -1), c.notice, -1) : null;
  const deadline = noticeBy || termEnds;
  let state;
  if (!termEnds || (auto && !noticeBy)) state = 'incomplete';
  else if (!auto && termEnds < today) state = 'ended';
  else if (deadline < today) state = auto ? 'closed' : 'act';
  else {
    const days = daysBetween(today, deadline);
    state = days <= WINDOW.act ? 'act' : days <= WINDOW.soon ? 'soon' : 'later';
  }
  return {
    ...c,
    auto,
    renewals,
    termEnds,
    renewsOn: auto ? renewsOn : null,
    noticeBy,
    nextNoticeBy: state === 'closed' ? nextNoticeBy : null,
    deadline,
    daysLeft: deadline ? daysBetween(today, deadline) : null,
    state,
    rule: noticeBy ? `Notice period ${formatDuration(c.notice)}, counted back from the last day of the term.` : '',
    findings,
  };
}

const ORDER = { act: 0, closed: 1, soon: 2, later: 3, incomplete: 4, ended: 5 };

export function assessAll(pages, today) {
  return pages
    .map(contractFromPage)
    .filter(Boolean)
    .map((c) => assess(c, today))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || String(a.deadline).localeCompare(String(b.deadline)) || a.title.localeCompare(b.title));
}

// Total annual value per currency for contracts whose notice day falls within `days`.
export function valueAtStake(contracts, days) {
  const out = {};
  for (const c of contracts) {
    if (!c.value || c.daysLeft === null || c.daysLeft < 0 || c.daysLeft > days) continue;
    if (!['act', 'soon', 'later'].includes(c.state)) continue;
    out[c.value.currency] = (out[c.value.currency] || 0) + c.value.amount;
  }
  return out;
}

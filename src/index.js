import Resolver from '@forge/resolver';
import { spaceByKey, spacePages, pageWithBody, createPage, updatePageBody, pageByTitle } from './confluence.js';
import { createTasks } from './jira.js';
import { assess, assessAll, contractFromPage, valueAtStake, WINDOW } from './core/contracts.js';
import { planTasks } from './core/tasks.js';
import { formatDate, formatDuration, todayIso } from './core/dates.js';
import { SAMPLE, sampleBody, RAW_SAMPLE, rawSampleBody } from './core/sample.js';
import { checkTerms, upsertTerms } from './core/terms.js';
import { textOf } from './core/properties.js';

async function contractsInSpace(spaceKey) {
  const space = await spaceByKey(spaceKey);
  if (!space) return { error: `No Confluence space with key ${spaceKey} is visible to you.` };
  const today = todayIso();
  const { pages } = await spacePages(space.id);
  return { space, today, pages: pages.length, contracts: assessAll(pages, today) };
}

// What the UI and the actions show for one contract; page bodies stay on the server.
const view = (c) => ({
  pageId: c.pageId, title: c.title, url: c.url, counterparty: c.counterparty, owner: c.owner,
  state: c.state, auto: c.auto, noticeBy: c.noticeBy, nextNoticeBy: c.nextNoticeBy, deadline: c.deadline,
  daysLeft: c.daysLeft, termEnds: c.termEnds, renewsOn: c.renewsOn, renewals: c.renewals, notice: c.noticeText,
  renewal: c.renewalText, renewalTerm: c.auto ? formatDuration(c.renewal?.term || c.term) : '', term: c.termText,
  value: c.valueText, rule: c.rule, findings: c.findings,
});

const resolver = new Resolver();

resolver.define('getSpaceData', async ({ context }) => {
  const r = await contractsInSpace(context.extension.space.key);
  if (r.error) return r;
  return {
    today: r.today,
    pagesRead: r.pages,
    contracts: r.contracts.map(view),
    atStake30: valueAtStake(r.contracts, WINDOW.act),
    atStake90: valueAtStake(r.contracts, WINDOW.soon),
  };
});

resolver.define('getPageData', async ({ context }) => {
  const page = await pageWithBody(context.extension.content.id);
  const c = contractFromPage(page);
  return { today: todayIso(), contract: c ? view(assess(c, todayIso())) : null };
});

resolver.define('createTasks', async ({ payload, context }) => {
  const projectKey = String(payload.projectKey || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]+$/.test(projectKey)) return { ok: false, error: 'Enter a Jira project key, for example LEGAL.' };
  const r = await contractsInSpace(context.extension.space.key);
  if (r.error) return { ok: false, error: r.error };
  const tasks = planTasks(r.contracts, Number(payload.withinDays) || WINDOW.act);
  if (tasks.length === 0) return { ok: true, created: [], existing: [], failed: [] };
  try {
    return { ok: true, ...(await createTasks(projectKey, tasks)) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

resolver.define('loadSample', async ({ context }) => {
  const r = await contractsInSpace(context.extension.space.key);
  if (r.error) return { ok: false, error: r.error };
  if (r.contracts.length > 0) return { ok: false, error: 'This space already has contract pages.' };
  const today = todayIso();
  const parent = await createPage(r.space.id, 'Vendor contracts (sample)', '<p>Fictional contracts created by Notice Window to show how it reads page properties. Edit or delete them freely.</p>');
  for (const s of SAMPLE) await createPage(r.space.id, s.title, sampleBody(s, today, context.accountId), parent.id);
  await createPage(r.space.id, RAW_SAMPLE.title, rawSampleBody(), parent.id);
  return { ok: true, count: SAMPLE.length + 1 };
});

export const handler = resolver.getDefinitions();

// Byline text on every page: the notice day on contract pages, a neutral label elsewhere.
export async function bylineProperties(payload) {
  try {
    const page = await pageWithBody(payload.extension.content.id);
    const c = contractFromPage(page);
    if (!c) return { title: 'Notice window', tooltip: 'No contract terms on this page' };
    const a = assess(c, todayIso());
    const short = (d) => formatDate(d).replace(/ \d{4}$/, '');
    const titles = {
      act: `Notice by ${short(a.deadline)}`,
      soon: `Notice by ${short(a.deadline)}`,
      later: `Notice by ${formatDate(a.deadline)}`,
      closed: `Renews ${short(a.renewsOn)}`,
      ended: 'Contract ended',
      incomplete: 'Contract dates incomplete',
    };
    return { title: titles[a.state], tooltip: a.rule || 'Open to see what is missing' };
  } catch (e) {
    return { title: 'Notice window' };
  }
}

// Rovo and MCP actions.
const spaceKeyOf = (payload) => String(payload.spaceKey || payload.context?.confluence?.spaceKey || '').trim().toUpperCase();

export async function listNoticeDeadlines(payload) {
  const spaceKey = spaceKeyOf(payload);
  if (!spaceKey) return { error: 'Provide the key of the Confluence space that holds the contract pages, for example LEGAL.' };
  const r = await contractsInSpace(spaceKey);
  if (r.error) return r;
  const within = Number(payload.withinDays) || 90;
  const inWindow = r.contracts.filter((c) => c.daysLeft !== null && c.daysLeft >= 0 && c.daysLeft <= within && ['act', 'soon', 'later'].includes(c.state));
  return {
    today: r.today,
    withinDays: within,
    noticeDue: inWindow.map(view),
    windowClosedRenewingSoon: r.contracts.filter((c) => c.state === 'closed').map(view),
    incomplete: r.contracts.filter((c) => c.state === 'incomplete').map((c) => ({ title: c.title, url: c.url, findings: c.findings })),
    annualValueWithNoticeDue: valueAtStake(r.contracts, within),
  };
}

export async function getContractDates(payload) {
  const spaceKey = spaceKeyOf(payload);
  const query = String(payload.contract || '').trim().toLowerCase();
  if (!spaceKey || !query) return { error: 'Provide the space key and part of the contract title or counterparty name.' };
  const r = await contractsInSpace(spaceKey);
  if (r.error) return r;
  const matches = r.contracts.filter((c) => `${c.title} ${c.counterparty}`.toLowerCase().includes(query));
  if (matches.length === 0) return { error: `No contract page in ${spaceKey} matches "${payload.contract}".` };
  return { today: r.today, contracts: matches.slice(0, 5).map(view) };
}

// The page the user is viewing, or one named by ID or exact title in the current space.
async function targetPageId(payload) {
  const ctx = payload.context?.confluence || {};
  const given = String(payload.page || '').trim();
  if (/^\d+$/.test(given)) return given;
  if (!given) return ctx.contentId ? String(ctx.contentId) : '';
  const space = ctx.spaceKey ? await spaceByKey(ctx.spaceKey) : null;
  return space ? (await pageByTitle(space.id, given)) || '' : '';
}

// Plain text of a contract page, so the agent can find the terms in it.
export async function getPageText(payload) {
  const pageId = await targetPageId(payload);
  if (!pageId) return { error: 'Open the contract page, or give its page ID or exact title.' };
  const page = await pageWithBody(pageId);
  const text = textOf(page.body);
  return { page: page.title, url: page.url, text: text.slice(0, 15000), truncated: text.length > 15000, hasTermsTable: !!contractFromPage(page) };
}

// Writes the terms a person confirmed in Rovo into the page's properties table, then returns the dates they lead to.
export async function setContractTerms(payload) {
  const pageId = await targetPageId(payload);
  if (!pageId) return { error: 'Open the contract page, or give its page ID or exact title.' };
  const { terms, problems } = checkTerms(payload);
  if (problems.length) return { error: 'Nothing was written.', problems };
  const page = await pageWithBody(pageId);
  await updatePageBody(page, upsertTerms(page.body, terms), 'Contract terms confirmed in Rovo (Notice Window)');
  const fresh = await pageWithBody(pageId);
  const c = contractFromPage(fresh);
  return { written: terms, page: fresh.title, url: fresh.url, dates: c ? view(assess(c, todayIso())) : null };
}

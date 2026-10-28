// Plans one Jira task per contract whose notice day falls within the chosen number of days. The label carries the
// page ID and the notice day, so running it again for the same term finds the existing task instead of a duplicate.
import { formatDate } from './dates.js';

export const taskLabel = (c) => `notice-window-${c.pageId}-${c.deadline}`;

export function planTasks(contracts, withinDays) {
  return contracts
    .filter((c) => (c.state === 'act' || c.state === 'soon' || c.state === 'later') && c.daysLeft !== null && c.daysLeft <= withinDays)
    .map((c) => ({
      pageId: c.pageId,
      label: taskLabel(c),
      summary: c.auto
        ? `Give notice to ${c.counterparty} by ${formatDate(c.noticeBy)}, or the contract renews on ${formatDate(c.renewsOn)}`
        : `Decide on ${c.counterparty} by ${formatDate(c.deadline)}: the term ends on ${formatDate(c.termEnds)}`,
      dueDate: c.deadline,
      assignee: c.owner?.accountIds?.[0] || null,
      lines: [
        `Contract: ${c.title}`,
        c.auto
          ? `Renews automatically on ${formatDate(c.renewsOn)} unless notice is given by ${formatDate(c.noticeBy)} (${c.noticeText} before the term ends on ${formatDate(c.termEnds)}).`
          : `Fixed term ending on ${formatDate(c.termEnds)}${c.noticeBy ? `; notice period ${c.noticeText}` : ''}.`,
        c.valueText ? `Annual value: ${c.valueText}.` : '',
        'Check the notice clause in the signed contract before acting: Notice Window applies the common rule and is not legal advice.',
      ].filter(Boolean),
      url: c.url,
      title: c.title,
    }));
}

// Atlassian Document Format for the task description: one paragraph per line, then a link to the contract page.
export function descriptionAdf(task) {
  const paragraph = (content) => ({ type: 'paragraph', content });
  const text = (t, marks) => (marks ? { type: 'text', text: t, marks } : { type: 'text', text: t });
  const body = task.lines.map((l) => paragraph([text(l)]));
  if (task.url) body.push(paragraph([text('Contract page: '), text(task.title, [{ type: 'link', attrs: { href: task.url } }])]));
  return { type: 'doc', version: 1, content: body };
}

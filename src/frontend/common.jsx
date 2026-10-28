import React from 'react';
import { Lozenge } from '@forge/react';
import { formatDate } from '../core/dates.js';

export { formatDate };

export function money(byCurrency) {
  const parts = Object.entries(byCurrency || {}).map(([cur, n]) => `${cur ? `${cur} ` : ''}${n.toLocaleString('en-US')}`);
  return parts.join(' and ');
}

export function DaysLozenge({ c }) {
  if (c.state === 'closed') return <Lozenge>Notice day passed</Lozenge>;
  if (c.state === 'incomplete') return <Lozenge appearance="moved">Dates incomplete</Lozenge>;
  if (c.state === 'ended') return <Lozenge>Ended</Lozenge>;
  const n = c.daysLeft;
  const label = n === 0 ? 'Today' : n < 0 ? `${-n} day${n === -1 ? '' : 's'} late` : `${n} day${n === 1 ? '' : 's'} left`;
  const appearance = c.state === 'act' ? 'removed' : c.state === 'soon' ? 'moved' : 'default';
  return <Lozenge appearance={appearance}>{label}</Lozenge>;
}

// The one sentence a contract owner needs: what to do and by when.
export function actBy(c) {
  if (c.state === 'incomplete') return 'Cannot work out the dates';
  if (c.state === 'ended') return `Ended on ${formatDate(c.termEnds)}`;
  if (c.state === 'closed') return c.nextNoticeBy ? `Next notice day ${formatDate(c.nextNoticeBy)}` : `Renews on ${formatDate(c.renewsOn)}`;
  return c.auto ? `Give notice by ${formatDate(c.deadline)}` : `Decide by ${formatDate(c.deadline)}`;
}

export function termLine(c) {
  if (!c.termEnds) return '';
  if (c.auto) {
    return `The current term ends on ${formatDate(c.termEnds)}. Without notice it renews automatically on ${formatDate(c.renewsOn)}${c.renewalTerm ? ` for another ${c.renewalTerm}` : ''}.`;
  }
  return c.state === 'ended' ? `The term ended on ${formatDate(c.termEnds)}.` : `The term ends on ${formatDate(c.termEnds)} and does not renew by itself.`;
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, daysBetween, formatDate, formatDuration, parseDate, parseDuration, shift } from '../src/core/dates.js';

test('months keep the day where it exists', () => {
  assert.equal(addMonths('2025-01-31', 1), '2025-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2025-03-31', -1), '2025-02-28');
  assert.equal(addMonths('2025-11-15', 3), '2026-02-15');
  assert.equal(shift('2026-03-01', { months: 0, days: 60 }, -1), '2025-12-31');
  assert.equal(daysBetween('2026-10-28', '2026-11-09'), 12);
});

test('durations and dates in the wording teams use', () => {
  assert.deepEqual(parseDuration('60 days'), { months: 0, days: 60 });
  assert.deepEqual(parseDuration("ninety (90) calendar days' notice"), { months: 0, days: 90 });
  assert.deepEqual(parseDuration('3 months'), { months: 3, days: 0 });
  assert.deepEqual(parseDuration('Automatic, 1 year'), { months: 12, days: 0 });
  assert.deepEqual(parseDuration('six weeks'), { months: 0, days: 42 });
  assert.equal(parseDuration('30 business days'), null);
  assert.equal(parseDuration('reasonable notice'), null);
  assert.equal(parseDate('2025-02-01'), '2025-02-01');
  assert.equal(parseDate('1 February 2025'), '2025-02-01');
  assert.equal(parseDate('Feb 1, 2025'), '2025-02-01');
  assert.equal(parseDate('01/02/2025'), null);
  assert.equal(parseDate('2025-02-30'), null);
  assert.equal(formatDate('2026-11-09'), '9 Nov 2026');
  assert.equal(formatDuration({ months: 12, days: 0 }), '12 months');
  assert.equal(formatDuration({ months: 36, days: 0 }), '3 years');
  assert.equal(formatDuration({ months: 0, days: 1 }), '1 day');
});

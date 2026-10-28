# Notice Window

The last day to give notice on every contract, read from the Confluence pages where the contracts already live.
Contracts that renew automatically unless someone gives notice in time are easy to miss: the date that matters is not
the renewal date but the notice day before it. Notice Window works that day out for each contract page, shows it in
the page byline, lists what is due across the space, creates Jira tasks for the owners and answers questions in Rovo.

Built on Atlassian Forge for Codegeist 2026 (category: Apps for Business Teams).

## How contracts are read

A contract is a Confluence page with a page properties table (the Page Properties macro, or a plain table with a
Notice period row). Notice Window understands these rows:

| Row | Example | Used for |
|---|---|---|
| Counterparty | Orbitline Analytics Ltd | names in lists and tasks |
| Owner | @mention | task assignee |
| Start date | date picker or 2025-02-01 | first term |
| Initial term | 12 months | first term end |
| Renewal | Automatic, 12 months / Manual | whether and how it renews |
| Notice period | 60 days, 3 months | the notice day |
| Annual value | USD 48,000 | value at stake |

An End date row can replace Start date and Initial term. Business days are not counted (they need a holiday calendar),
so a notice period in business days is flagged instead of guessed.

The rule applied: an automatic renewal rolls forward to the term that contains today; the term ends the day before the
renewal date; the notice day is the end of the term minus the notice period. Contracts word this differently, so every
date is shown with the rule that produced it. Notice Window is not legal advice.

## What you get

- **Byline on each contract page**: "Notice by 9 Nov", "Renews 22 Jan" when the notice day has passed, or "Contract
  dates incomplete". Click it for the term end, the renewal date and anything missing from the table.
- **Notice Window space page**: every contract in the space with what to do, time left, the renewal or end date and the
  annual value; a warning with the value at stake in the next 30 days; and the pages whose terms are incomplete.
- **Jira tasks**: one task per contract whose notice day falls in the next 30 days, assigned to the owner, due on the
  notice day and linked to the page. A label per contract and term means running it again skips existing tasks.
- **Rovo agent "Notice Window Assistant"** and the same two actions as tools on the Atlassian MCP server:
  `list-notice-deadlines` and `get-contract-dates`. [`skills/notice-window/SKILL.md`](skills/notice-window/SKILL.md)
  tells a third-party agent how to use them.
- **Load sample contracts** creates seven fictional contract pages dated relative to today, so every state shows up.

## Try it

1. Install the app on a Confluence site (add Jira for the tasks).
2. Open a space, choose **Notice Window** under the space apps, and press **Load sample contracts**.
3. Open one of the new pages to see its notice day in the byline.

## Architecture

- `src/core/`: plain JavaScript, no network: `dates.js` (calendar arithmetic and wording such as "ninety (90) days"),
  `properties.js` (page properties from storage format), `contracts.js` (terms, notice day and state), `tasks.js`
  (task plan and description), `sample.js` (fictional data).
- `src/index.js`: Forge resolvers, the byline title function and the Rovo actions. Confluence and Jira are called as the
  current user (`asUser`), so people see only the contracts they can open.
- `src/frontend/`: UI Kit space page and byline popup.
- No LLM calls in the app. The Rovo agent uses Rovo's own model on the site that runs it.

## Development

```sh
npm install
npm test          # node --test, core logic
forge lint
forge deploy -e development
forge install --site <your-site>.atlassian.net -p Confluence -e development
```

## Credits

Built with help from an AI coding assistant (Anthropic Claude). Sample data is fictional.

## Licence

MIT.

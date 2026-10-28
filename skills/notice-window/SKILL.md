---
name: notice-window
description: Finds the last day to give notice on contracts kept as Confluence pages (page properties with start date, term, renewal and notice period), using the Notice Window tools on the Atlassian MCP server. Use when someone asks which contracts need notice soon, when a contract renews, or what renews automatically and for how much.
---

# Notice Window

Notice Window is a Forge app for Confluence and Jira. It reads contract pages and works out, for today, when each
contract's term ends, when it renews and the last day to give notice. This skill tells an MCP client how to call the
app's two tools and how to report what they return.

## Connect

1. A site admin installs Notice Window and turns on its tools for external MCP clients: Atlassian Administration >
   Apps > Sites > your site > Connected apps > Notice Window. External MCP access is part of Atlassian's Early Access
   Program and is off by default.
2. Add `https://mcp.atlassian.com/forge/92bd8b36-c090-408b-a969-200b7b6859c4` as a remote MCP server in your client and
   sign in. On the consent screen you choose the site. The tools run with your own Confluence permissions.

## Tools

- `list-notice-deadlines`, inputs `spaceKey` and optional `withinDays` (default 90): the contracts whose notice day
  falls in that time, soonest first, with renewal or end dates, owners and annual values; contracts whose notice day has
  passed and that will renew, with the next notice day; pages whose terms are incomplete; and the annual value with
  notice due.
- `get-contract-dates`, inputs `spaceKey` and `contract` (part of the page title or counterparty name): the dates and
  any missing terms for the matching contracts.

## Answering

When the user asks what needs attention, call `list-notice-deadlines` with the space key (ask for it if you do not know
it) and report, in this order:

1. Contracts with notice due: counterparty, last day to give notice, days left, what happens if nobody acts (renews on
   a date, or ends), owner and annual value, each linked to its page.
2. Contracts whose notice day has passed, with the renewal date and the next notice day.
3. Pages whose terms are incomplete, with what is missing.

When the user asks about one contract, call `get-contract-dates`.

## Limits

- Report only what the tools return. The dates follow the common rule that notice must be given at least the notice
  period before the last day of the term; say so, and tell the user to check the signed contract's wording.
- Do not give legal advice and do not say whether a contract should be renewed.

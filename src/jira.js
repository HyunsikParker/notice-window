// Jira calls for the notice tasks, as the current user.
import api, { route } from '@forge/api';
import { descriptionAdf } from './core/tasks.js';

async function jira(path, options) {
  const res = await api.asUser().requestJira(path, options);
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null, text };
}

const json = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify(body),
});

async function existingByLabel(label) {
  const r = await jira(route`/rest/api/3/search/jql`, json({ jql: `labels = "${label}"`, fields: ['summary'], maxResults: 1 }));
  return r.ok ? r.data.issues?.[0]?.key || null : null;
}

async function taskTypeId(projectKey) {
  const r = await jira(route`/rest/api/3/issue/createmeta/${projectKey}/issuetypes`);
  if (!r.ok) throw new Error(r.status === 404 ? `No Jira project with key ${projectKey} that you can create work in.` : `Jira ${r.status}`);
  const types = (r.data.issueTypes || r.data.values || []).filter((t) => !t.subtask);
  const type = types.find((t) => (t.untranslatedName || t.name) === 'Task') || types.find((t) => t.hierarchyLevel === 0) || types[0];
  if (!type) throw new Error(`Project ${projectKey} has no work type for tasks.`);
  return type.id;
}

// Creates the planned tasks that do not exist yet. Due date and assignee are dropped if the project's screens refuse them.
export async function createTasks(projectKey, tasks) {
  const issuetypeId = await taskTypeId(projectKey);
  const created = [];
  const existing = [];
  const failed = [];
  for (const t of tasks) {
    const found = await existingByLabel(t.label);
    if (found) { existing.push({ key: found, pageId: t.pageId }); continue; }
    const fields = {
      project: { key: projectKey },
      issuetype: { id: issuetypeId },
      summary: t.summary,
      description: descriptionAdf(t),
      labels: ['notice-window', t.label],
      duedate: t.dueDate,
      ...(t.assignee ? { assignee: { accountId: t.assignee } } : {}),
    };
    let r = await jira(route`/rest/api/3/issue`, json({ fields }));
    for (let retry = 0; !r.ok && r.status === 400 && retry < 2; retry += 1) {
      // Drop the optional fields Jira refused (for example a due date that is not on the create screen) and try again.
      const refused = Object.keys(r.data?.errors || {}).filter((f) => ['duedate', 'assignee', 'labels'].includes(f));
      for (const f of refused.length ? refused : ['duedate', 'assignee']) delete fields[f];
      r = await jira(route`/rest/api/3/issue`, json({ fields }));
    }
    if (!r.ok) { failed.push({ pageId: t.pageId, error: `Jira ${r.status}: ${r.text.slice(0, 200)}` }); continue; }
    const key = r.data.key;
    if (t.url) {
      await jira(route`/rest/api/3/issue/${key}/remotelink`, json({
        globalId: `notice-window-page-${t.pageId}`,
        object: { url: t.url, title: t.title },
        application: { type: 'com.atlassian.confluence', name: 'Confluence' },
        relationship: 'Contract',
      }));
    }
    created.push({ key, pageId: t.pageId, summary: t.summary });
  }
  return { created, existing, failed };
}

// Confluence REST v2 calls. Reads run as the current user, so a person only sees contracts they can open in Confluence.
import api, { route } from '@forge/api';

const MAX_PAGES = 1000;

async function confluenceJson(path, options) {
  const res = await api.asUser().requestConfluence(path, options);
  if (!res.ok) throw new Error(`Confluence ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export async function spaceByKey(spaceKey) {
  const data = await confluenceJson(route`/wiki/api/v2/spaces?keys=${spaceKey}`);
  return data.results?.[0] || null;
}

const toPage = (p, base) => ({
  id: p.id,
  title: p.title,
  url: p._links?.webui ? `${base || ''}${p._links.webui}` : '',
  body: p.body?.storage?.value || '',
});

// Every current page in the space with its storage body; contract pages are recognised later by their table.
export async function spacePages(spaceId) {
  const pages = [];
  let path = route`/wiki/api/v2/spaces/${spaceId}/pages?body-format=storage&status=current&limit=100`;
  let base = '';
  while (path && pages.length < MAX_PAGES) {
    const data = await confluenceJson(path);
    base = data._links?.base || base;
    pages.push(...(data.results || []).map((p) => toPage(p, base)));
    const next = data._links?.next;
    path = next ? route`/wiki/api/v2/spaces/${spaceId}/pages?body-format=storage&status=current&limit=100&cursor=${new URLSearchParams(next.split('?')[1]).get('cursor')}` : null;
  }
  return { pages, base };
}

export async function pageWithBody(pageId) {
  const p = await confluenceJson(route`/wiki/api/v2/pages/${pageId}?body-format=storage`);
  return { ...toPage(p, p._links?.base || ''), version: p.version?.number || 1, spaceId: p.spaceId };
}

export async function updatePageBody(page, storage, message) {
  return confluenceJson(route`/wiki/api/v2/pages/${page.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      id: String(page.id), status: 'current', title: page.title,
      body: { representation: 'storage', value: storage },
      version: { number: page.version + 1, message },
    }),
  });
}

export async function pageByTitle(spaceId, title) {
  const data = await confluenceJson(route`/wiki/api/v2/pages?space-id=${spaceId}&title=${title}&status=current&limit=5`);
  return data.results?.[0]?.id || null;
}

export async function createPage(spaceId, title, storage, parentId) {
  const body = { spaceId, status: 'current', title, body: { representation: 'storage', value: storage } };
  if (parentId) body.parentId = parentId;
  return confluenceJson(route`/wiki/api/v2/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
}

// Reads the key-value rows of Confluence page-properties tables (the "details" macro) from storage-format XHTML.
// Values keep three readings: plain text, the first date-picker date and any mentioned users' account IDs.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function textOf(html) {
  return String(html || '')
    .replace(/<time[^>]*datetime="([^"]+)"[^>]*\/?>/g, ' $1 ')
    .replace(/<(br|\/p|\/li|\/div|\/h\d)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (all, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      return ENTITIES[e.toLowerCase()] ?? all;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function rowsOf(tableHtml) {
  const rows = [];
  for (const tr of tableHtml.match(/<tr\b[\s\S]*?<\/tr>/gi) || []) {
    const cells = [...tr.matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((c) => c[2]);
    if (cells.length < 2) continue;
    const key = textOf(cells[0]).replace(/[:*]+$/, '').trim().toLowerCase();
    if (!key) continue;
    const raw = cells[1];
    rows.push({
      key,
      text: textOf(raw),
      date: /<time[^>]*datetime="(\d{4}-\d{2}-\d{2})"/.exec(raw)?.[1] || null,
      accountIds: [...raw.matchAll(/ri:account-id="([^"]+)"/g)].map((m) => m[1]),
    });
  }
  return rows;
}

// Returns a Map of lower-case key -> value. Page-properties macros come first; without one, a plain table whose rows
// include `requiredKey` is accepted so that a team that pasted a simple table still gets results.
export function pageProperties(storage, requiredKey = 'notice period') {
  const out = new Map();
  const macros = String(storage || '').match(/<ac:structured-macro\b[^>]*ac:name="details"[\s\S]*?<\/ac:structured-macro>/g) || [];
  const tables = macros.flatMap((m) => m.match(/<table\b[\s\S]*?<\/table>/gi) || []);
  let rows = tables.flatMap(rowsOf);
  if (rows.length === 0) {
    const plain = (String(storage || '').match(/<table\b[\s\S]*?<\/table>/gi) || []).map(rowsOf);
    rows = plain.find((r) => r.some((row) => row.key === requiredKey)) || [];
  }
  for (const row of rows) if (!out.has(row.key)) out.set(row.key, row);
  return out;
}

import { createHash, randomUUID } from 'node:crypto';
import { send } from './http.js';

// The /v1 API, implemented from CONTRACT.md — the § numbers below point into it.
//
// createV1(db) returns a handler for every request whose path is /v1 or starts
// with /v1/. It always answers and returns true: an unknown /v1 path is a
// not-found problem, never the legacy { error } shape.

const PROBLEMS = {
  'invalid-json': [400, 'Malformed JSON'],
  'validation': [400, 'Invalid request'],
  'idempotency-key-missing': [400, 'Idempotency-Key required'],
  'not-found': [404, 'Not found'],
  'idempotency-key-in-flight': [409, 'Request in progress'],
  'unknown-menu-item': [422, 'Unknown menu item'],
  'idempotency-key-reused': [422, 'Idempotency-Key reused'],
  'internal': [500, 'Internal error'],
};

// §2: every 4xx/5xx under /v1 is a problem details object.
function problem(res, slug, detail, errors, headers) {
  const [status, title] = PROBLEMS[slug];
  const body = { type: `https://menu.example/problems/${slug}`, title, status, detail };
  if (errors) body.errors = errors;
  send(res, status, body, { 'content-type': 'application/problem+json', ...headers });
}

// A body serialised once and stored, so a replay is byte for byte the original.
function sendJson(res, status, json, headers) {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(json);
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const isIntIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
// Path segments and query values: plain decimal digits ('12', not '012', '1e1', '12.0').
const decimal = (s) => (/^(0|[1-9]\d*)$/.test(s) ? Number(s) : NaN);
const intIn = (lo, hi) => (s) => { const n = decimal(s); return isIntIn(n, lo, hi) ? n : undefined; };
const parseId = intIn(1, Number.MAX_SAFE_INTEGER);

// readRaw() decodes chunk by chunk, which can split a UTF-8 character in two.
// Decode the whole body once instead; bytes that are not UTF-8 are not JSON.
const utf8 = new TextDecoder('utf-8', { fatal: true });
async function readBytes(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// §4.2: two bodies are the same when they are equal as JSON values — key order
// and whitespace do not matter, anything else does. Serialising the parsed value
// with sorted keys turns that into string equality.
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v !== null && typeof v === 'object')
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
const fingerprint = (body) => createHash('sha256').update(canonical(body)).digest('hex');

// §4.2 step 4: every broken field, not just the first.
function orderErrors(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body))
    return [{ pointer: '', detail: 'must be a JSON object' }];
  const errors = [];
  if (!isIntIn(body.tableId, 1, 200))
    errors.push({ pointer: '/tableId', detail: 'must be an integer from 1 to 200' });
  const { items } = body;
  if (!Array.isArray(items) || items.length < 1 || items.length > 20)
    errors.push({ pointer: '/items', detail: 'must be an array of 1 to 20 lines' });
  if (Array.isArray(items)) {
    items.forEach((line, i) => {
      if (line === null || typeof line !== 'object' || Array.isArray(line)) {
        errors.push({ pointer: `/items/${i}`, detail: 'must be an object' });
        return;
      }
      if (!isIntIn(line.menuItemId, 1, Infinity))
        errors.push({ pointer: `/items/${i}/menuItemId`, detail: 'must be a positive integer' });
      if (!isIntIn(line.qty, 1, 20))
        errors.push({ pointer: `/items/${i}/qty`, detail: 'must be an integer from 1 to 20' });
    });
  }
  return errors;
}

// §4.2 step 3, for a key whose request ended in 201.
function replay(res, stored, fp) {
  if (stored.fingerprint !== fp)
    return problem(res, 'idempotency-key-reused', 'this Idempotency-Key was already used with a different request body');
  sendJson(res, stored.status, stored.body, { Location: stored.location, 'Idempotent-Replayed': 'true' });
}

// §4.4: a cursor is base64url of { before, tableId } — keyset paging on id.
// A later page holds only ids below the last one already seen, so orders placed
// meanwhile (always a larger id) can neither appear on it nor shift it.
const encodeCursor = (before, tableId) => Buffer.from(JSON.stringify({ before, tableId })).toString('base64url');
function decodeCursor(s) {
  try {
    const { before, tableId } = JSON.parse(Buffer.from(s, 'base64url').toString());
    // Only a string this server made re-encodes to itself.
    if (isIntIn(before, 1, Number.MAX_SAFE_INTEGER) && (tableId === null || isIntIn(tableId, 1, 200))
        && encodeCursor(before, tableId) === s) return { before, tableId };
  } catch {}
  return undefined;
}

// How long an in-flight mark outlives a process that crashed while holding it.
const LOCK_MS = 60_000;

export function createV1(db) {
  const ORDER = 'SELECT id, table_id, total_vnd, created_at FROM orders';
  const q = {
    menuItem: db.prepare('SELECT id, name, price_vnd FROM menu_items WHERE id = ?'),
    prices: db.prepare('SELECT id, price_vnd FROM menu_items WHERE id IN (SELECT value FROM json_each(?))'),
    order: db.prepare(`${ORDER} WHERE id = ?`),
    page: db.prepare(`${ORDER} WHERE id < ? ORDER BY id DESC LIMIT ?`),
    pageOfTable: db.prepare(`${ORDER} WHERE table_id = ? AND id < ? ORDER BY id DESC LIMIT ?`),
    lines: db.prepare(`SELECT order_id, menu_item_id, qty, unit_price_vnd FROM order_items
                       WHERE order_id IN (SELECT value FROM json_each(?)) ORDER BY order_id, line`),
    insertOrder: db.prepare('INSERT INTO orders (table_id, total_vnd, created_at) VALUES (?, ?, ?)'),
    insertLine: db.prepare('INSERT INTO order_items (order_id, line, menu_item_id, qty, unit_price_vnd) VALUES (?, ?, ?, ?, ?)'),
    key: db.prepare('SELECT fingerprint, status, location, body FROM idempotency_keys WHERE key = ?'),
    insertKey: db.prepare(`INSERT INTO idempotency_keys (key, fingerprint, status, location, body, order_id, created_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?)`),
    // Takes the mark unless another request holds one that has not expired.
    lock: db.prepare(`INSERT INTO idempotency_locks (key, token, expires_at) VALUES (?, ?, ?)
                      ON CONFLICT (key) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at
                      WHERE idempotency_locks.expires_at <= ?`),
    unlock: db.prepare('DELETE FROM idempotency_locks WHERE key = ? AND token = ?'),
    dropLock: db.prepare('DELETE FROM idempotency_locks WHERE key = ?'),
  };

  const lock = (key, token) => {
    const now = Date.now();
    return q.lock.run(key, token, now + LOCK_MS, now).changes > 0;
  };

  // fn is synchronous, so no other request on this connection can slip a
  // statement in between BEGIN and COMMIT.
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  }

  // Orders as §3 shows them, lines in the order the client sent them.
  function withItems(rows) {
    const items = new Map(rows.map((o) => [o.id, []]));
    for (const l of q.lines.all(JSON.stringify(rows.map((o) => o.id))))
      items.get(l.order_id).push({ menuItemId: l.menu_item_id, qty: l.qty, unitPriceVnd: l.unit_price_vnd });
    return rows.map((o) => ({ id: o.id, tableId: o.table_id, items: items.get(o.id), totalVnd: o.total_vnd, createdAt: o.created_at }));
  }

  // §4.1
  function getMenuItem(res, segment) {
    const id = parseId(segment);
    const row = id && q.menuItem.get(id);
    if (!row) return problem(res, 'not-found', `there is no menu item ${segment}`);
    send(res, 200, { id: row.id, name: row.name, priceVnd: row.price_vnd });
  }

  // §4.3
  function getOrder(res, segment) {
    const id = parseId(segment);
    const row = id && q.order.get(id);
    if (!row) return problem(res, 'not-found', `there is no order ${segment}`);
    send(res, 200, withItems([row])[0]);
  }

  // §4.4
  function listOrders(res, params) {
    const errors = [];
    // §4.4 has no rule against a repeated parameter: the first value counts.
    const read = (name, parse, rule) => {
      if (!params.has(name)) return undefined;
      const value = parse(params.get(name));
      if (value === undefined) errors.push({ parameter: name, detail: rule });
      return value;
    };
    const tableId = read('tableId', intIn(1, 200), 'must be an integer from 1 to 200') ?? null;
    const tableIdOk = errors.length === 0;
    const limit = read('limit', intIn(1, 100), 'must be an integer from 1 to 100') ?? 20;
    const cursor = read('cursor', decodeCursor, 'must be a nextCursor returned by this endpoint');
    if (cursor && tableIdOk && cursor.tableId !== tableId)
      errors.push({ parameter: 'cursor', detail: 'was returned for a different tableId' });
    if (errors.length)
      return problem(res, 'validation', `${plural(errors.length, 'query parameter is', 'query parameters are')} invalid`, errors);

    // One row past the page says whether another page exists, so nextCursor is
    // null exactly when nothing follows and never leads to an empty page.
    const before = cursor?.before ?? Number.MAX_SAFE_INTEGER;
    const rows = tableId === null ? q.page.all(before, limit + 1) : q.pageOfTable.all(tableId, before, limit + 1);
    const page = rows.slice(0, limit);
    send(res, 200, {
      items: withItems(page),
      nextCursor: rows.length > limit ? encodeCursor(page.at(-1).id, tableId) : null,
    });
  }

  // §4.2 — the steps are checked in the contract's order.
  async function placeOrder(req, res) {
    // 1. Idempotency-Key
    const key = req.headers['idempotency-key'];
    if (!key || key.length > 255)
      return problem(res, 'idempotency-key-missing', key === undefined
        ? 'the Idempotency-Key header is missing'
        : 'the Idempotency-Key header must be 1 to 255 characters');

    // From here until it ends this request is in flight, even while its body is
    // still arriving: the mark lives in the database so every instance sees it.
    const token = randomUUID();
    let locked = lock(key, token);
    try {
      // 2. JSON
      const bytes = await readBytes(req);
      let body;
      try { body = JSON.parse(utf8.decode(bytes)); }
      catch { return problem(res, 'invalid-json', 'the request body is not valid JSON'); }
      const fp = fingerprint(body);

      // 3. A key used before: replay, reused, or in flight.
      const stored = q.key.get(key);
      if (stored) return replay(res, stored, fp);
      if (!locked && !(locked = lock(key, token)))
        return problem(res, 'idempotency-key-in-flight',
          'a request with this Idempotency-Key is still being processed', undefined, { 'Retry-After': '1' });

      // 4. Fields
      const errors = orderErrors(body);
      if (errors.length)
        return problem(res, 'validation', errors[0].pointer === ''
          ? 'the request body is not a JSON object'
          : `${plural(errors.length, 'field is', 'fields are')} invalid`, errors);

      // 5–6. One transaction: the prices are read where the order is written, and
      // the key, fingerprint and response are stored with the order or not at all.
      const result = transaction(() => {
        const raced = q.key.get(key);           // another instance finished first
        if (raced) return { raced };

        const { tableId, items } = body;
        const price = new Map(q.prices.all(JSON.stringify(items.map((l) => l.menuItemId))).map((r) => [r.id, r.price_vnd]));
        const unknown = [];
        items.forEach((l, i) => {
          if (!price.has(l.menuItemId))
            unknown.push({ pointer: `/items/${i}/menuItemId`, detail: `menu item ${l.menuItemId} does not exist` });
        });
        if (unknown.length) return { unknown };

        const lines = items.map((l) => ({ menuItemId: l.menuItemId, qty: l.qty, unitPriceVnd: price.get(l.menuItemId) }));
        const totalVnd = lines.reduce((sum, l) => sum + l.unitPriceVnd * l.qty, 0);
        const createdAt = new Date().toISOString();
        const id = Number(q.insertOrder.run(tableId, totalVnd, createdAt).lastInsertRowid);
        lines.forEach((l, i) => q.insertLine.run(id, i, l.menuItemId, l.qty, l.unitPriceVnd));

        const location = `/v1/orders/${id}`;
        const json = JSON.stringify({ id, tableId, items: lines, totalVnd, createdAt });
        q.insertKey.run(key, fp, 201, location, json, id, createdAt);
        q.dropLock.run(key);
        return { location, json };
      });

      if (result.raced) return replay(res, result.raced, fp);
      if (result.unknown)
        return problem(res, 'unknown-menu-item',
          `${plural(result.unknown.length, 'order line names a menu item that does', 'order lines name menu items that do')} not exist`,
          result.unknown);
      sendJson(res, 201, result.json, { Location: result.location });
    } finally {
      // Only a 201 is stored, and its transaction already dropped the mark;
      // any other ending frees the key for the client to try again.
      if (locked) q.unlock.run(key, token);
    }
  }

  async function route(req, res, url) {
    const [resource, id, ...rest] = url.pathname.split('/').slice(2);
    const { method } = req;
    if (resource === 'menu' && id !== undefined && !rest.length && method === 'GET') return getMenuItem(res, id);
    if (resource === 'orders' && id === undefined && method === 'POST') return placeOrder(req, res);
    if (resource === 'orders' && id === undefined && method === 'GET') return listOrders(res, url.searchParams);
    if (resource === 'orders' && id !== undefined && !rest.length && method === 'GET') return getOrder(res, id);
    problem(res, 'not-found', `there is no ${method} ${url.pathname} in /v1`);
  }

  return async function handleV1(req, res, url) {
    try {
      await route(req, res, url);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) problem(res, 'internal', 'the server could not complete the request');
    }
    return true;
  };
}

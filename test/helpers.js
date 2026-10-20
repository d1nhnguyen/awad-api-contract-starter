// Start the app in-process on a fresh in-memory database with every migration
// applied, in order — including the ones you add.
import { readFileSync, readdirSync } from 'node:fs';
import { open } from '../src/db.js';
import { createApp } from '../src/app.js';

export async function startApp() {
  const db = open(':memory:');
  const dir = new URL('../migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.up.sql')).sort())
    db.exec(readFileSync(new URL(f, dir), 'utf8'));
  const ins = db.prepare('INSERT INTO menu_items (name, price_vnd) VALUES (?, ?)');
  for (const [name, price] of [['Phở bò', 45500], ['Trà đá', 5000], ['Cơm tấm', 40000], ['Bánh xèo', 60000]])
    ins.run(name, price);
  const server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://localhost:${server.address().port}`;

  // call('POST', '/v1/orders', body, { 'idempotency-key': 'k1' })
  // body: an object is sent as JSON; a string is sent as it is (for malformed JSON).
  async function call(method, path, body, headers = {}) {
    const res = await fetch(base + path, {
      method,
      headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = undefined; }
    return { status: res.status, headers: res.headers, text, body: json };
  }
  return { db, server, base, call, close: () => new Promise((r) => server.close(r)) };
}

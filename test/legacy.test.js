// The legacy, unversioned API — what old clients rely on. These must keep passing.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

let app;
before(async () => { app = await startApp(); });
after(() => app.close());

test('GET /menu/:id returns price in thousands of dong', async () => {
  const r = await app.call('GET', '/menu/1');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { id: 1, name: 'Phở bò', price: 45.5 });
});

test('PATCH /menu/:id takes thousands of dong', async () => {
  const r = await app.call('PATCH', '/menu/2', { price: 6 });
  assert.equal(r.status, 200);
  assert.equal(r.body.price, 6);
});

test('legacy errors are { error, message }', async () => {
  const r = await app.call('GET', '/menu/999');
  assert.equal(r.status, 404);
  assert.equal(r.body.error, 'not_found');
  assert.equal((await app.call('PATCH', '/menu/1', { price: -1 })).status, 400);
});

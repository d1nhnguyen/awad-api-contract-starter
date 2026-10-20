# Menu service API — contract, version 1

CSC13114 · session 5 starter · frozen 15 Oct 2026

This file is the specification. `test/contract.test.js` checks an implementation
against it. If the code and this file disagree, the code is wrong. If this file
is wrong, change it in a separate commit that says why — never quietly.

## 1. Conventions

- Every endpoint in this contract lives under `/v1`.
- Requests and responses are JSON, UTF-8.
- **Money is an integer number of dong**: `priceVnd`, `unitPriceVnd`, `totalVnd`.
- Ids are positive integers. Timestamps are ISO 8601 strings in UTC, e.g.
  `2026-10-15T01:20:00.000Z`.
- Clients ignore response fields they do not know. The server ignores request
  fields it does not know.

## 2. Errors

Every `/v1` response with a 4xx or 5xx status — including a request for a `/v1`
path that does not exist — is a **problem details** object (RFC 9457):

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://menu.example/problems/validation",
  "title": "Invalid request",
  "status": 400,
  "detail": "2 fields are invalid",
  "errors": [
    { "pointer": "/tableId", "detail": "must be an integer from 1 to 200" },
    { "pointer": "/items/0/qty", "detail": "must be an integer from 1 to 20" }
  ]
}
```

| Member | Rule |
|---|---|
| `type` | `https://menu.example/problems/` followed by a slug from the table below. No other values |
| `title` | the title from the table below |
| `status` | a number, equal to the HTTP status of the response |
| `detail` | one sentence about **this** occurrence. Never a stack trace, an SQL message, a table name or a file path |
| `errors` | only on `validation` and `unknown-menu-item`: one entry **per problem found** (not just the first), each `{ "detail", "pointer" }` for a body field — a JSON Pointer such as `/items/0/qty`, `""` for the whole body — or `{ "detail", "parameter" }` for a query parameter such as `limit` |

| Slug | Status | Title | When |
|---|---|---|---|
| `invalid-json` | 400 | Malformed JSON | the body is not valid JSON |
| `validation` | 400 | Invalid request | a body field or query parameter breaks a rule in this contract |
| `idempotency-key-missing` | 400 | Idempotency-Key required | `POST /v1/orders` without an `Idempotency-Key` header, or with one that is empty or longer than 255 characters |
| `not-found` | 404 | Not found | no resource with that id (also when the id is not a positive integer), or no such `/v1` path |
| `idempotency-key-in-flight` | 409 | Request in progress | the first request with this key has not finished yet |
| `unknown-menu-item` | 422 | Unknown menu item | an order line names a menu item that does not exist |
| `idempotency-key-reused` | 422 | Idempotency-Key reused | the key was already used with a different body |
| `internal` | 500 | Internal error | anything else. `detail` is a fixed, generic sentence |

Clients decide what to do from `type`, never from `title` or `detail`.

## 3. Resources

**MenuItem**

```json
{ "id": 12, "name": "Phở bò #12", "priceVnd": 45500 }
```

**Order**

```json
{
  "id": 31,
  "tableId": 7,
  "items": [
    { "menuItemId": 12, "qty": 2, "unitPriceVnd": 45500 },
    { "menuItemId": 3,  "qty": 1, "unitPriceVnd": 15000 }
  ],
  "totalVnd": 106000,
  "createdAt": "2026-10-15T01:20:00.000Z"
}
```

- `items` keep the order in which the client sent them.
- `unitPriceVnd` is the menu item's `priceVnd` **when the order was placed**; a
  later price change does not alter an existing order.
- `totalVnd` = the sum of `unitPriceVnd × qty` over all lines.

## 4. Endpoints

### 4.1 `GET /v1/menu/{id}`

- `200` — a MenuItem.
- `404 not-found` — no such item.

### 4.2 `POST /v1/orders` — place an order

Request headers: `Content-Type: application/json` and **`Idempotency-Key`**, a
string of 1 to 255 characters chosen by the client, one per order it intends to
place (a UUID is a good choice).

Request body:

```json
{ "tableId": 7, "items": [ { "menuItemId": 12, "qty": 2 }, { "menuItemId": 3, "qty": 1 } ] }
```

| Field | Rule |
|---|---|
| `tableId` | integer from 1 to 200 |
| `items` | array of 1 to 20 lines |
| `items[i].menuItemId` | positive integer |
| `items[i].qty` | integer from 1 to 20 |

A body that is valid JSON but not an object is a `validation` error with pointer `""`.

The server checks, **in this order**, and stops at the first step that fails:

1. `Idempotency-Key` present, 1 to 255 characters, else `400 idempotency-key-missing`.
2. The body is valid JSON, else `400 invalid-json`.
3. **The key has been used before** (see *Idempotency* below): replay, or
   `422 idempotency-key-reused`, or `409 idempotency-key-in-flight`.
4. Every field follows the table above, else `400 validation` listing **every**
   broken field.
5. Every `menuItemId` exists, else `422 unknown-menu-item` with one `errors`
   entry per unknown line (`pointer` `/items/{i}/menuItemId`).
6. The order is created: **`201`**, the Order as the body, and
   `Location: /v1/orders/{id}`.

**Idempotency.** A client that does not get an answer — a timeout, a dropped
mobile connection — sends the same request again with the same key. That retry
must not place a second order.

- When step 6 succeeds, the server stores the key, a fingerprint of the body and
  the response, **in the same transaction as the order**.
- Two bodies are *the same* when they are equal as JSON values: key order and
  whitespace do not matter, any other difference does.
- Same key, same body → the **stored** response: status `201`, the identical body,
  the same `Location`, plus the header **`Idempotent-Replayed: true`**. No new
  order. The first, original response does not carry that header.
- Same key, different body → `422 idempotency-key-reused`. Nothing is created.
- Same key while the first request is still being processed → `409
  idempotency-key-in-flight`. The client waits and retries.
- **Only a `201` is stored.** A request that ends in any 4xx stores nothing, so
  the client may fix the body and send it again with the same key.
- A stored key is kept for at least 24 hours.

### 4.3 `GET /v1/orders/{id}`

- `200` — an Order.
- `404 not-found` — no such order.

### 4.4 `GET /v1/orders` — list orders, newest first

Query parameters, all optional:

| Parameter | Rule | Default |
|---|---|---|
| `tableId` | integer from 1 to 200 — only orders of that table | all tables |
| `limit` | integer from 1 to 100 — page size | 20 |
| `cursor` | a `nextCursor` value returned by this endpoint | first page |

A value outside these rules is `400 validation` with `parameter` set to its name.
Out-of-range `limit` is an error, **not** silently clamped.

Response `200`:

```json
{ "items": [ { "id": 31, "tableId": 7, "…": "…" } ], "nextCursor": "eyJpZCI6Mjl9" }
```

- `items` are Orders, **newest first** (largest `id` first).
- `nextCursor` is `null` **if and only if** there are no more orders after this
  page. A client never receives a cursor that leads to an empty page.
- A cursor is **opaque**: the client stores it and sends it back unchanged, and
  never builds one. A `cursor` the server cannot read is `400 validation`
  (`parameter`: `cursor`). Use a cursor with the same `tableId` it came from.
- **Pages do not move under the client.** While a client walks the pages, orders
  placed after it fetched the first page do not appear on later pages, and no
  order appears twice or is skipped.
- A cursor stays valid for at least 24 hours.

## 5. Versions and the legacy API

- **Within `/v1`, only additive changes**: a new optional request field, a new
  response field, a new endpoint, a new problem type. Anything else — renaming or
  removing a field, changing a type or a unit, tightening a rule, changing an
  error — is a new version, `/v2`, and `/v1` keeps running until its `Sunset` date.
- The unversioned **legacy** endpoints — `GET /menu`, `GET /menu/{id}`,
  `POST /menu`, `PATCH /menu/{id}` — are **deprecated from 15 Oct 2026** and
  removed after 31 Dec 2026. Until then they behave **exactly as they do today**:
  same paths, `price` in thousands of dong, errors as `{ "error", "message" }` with
  `Content-Type: application/json`. The error model of section 2 does **not**
  apply to them.
- Every legacy response, errors included, carries these two headers:

  ```http
  Deprecation: @1792022400
  Sunset: Thu, 31 Dec 2026 23:59:59 GMT
  ```

  (`@1792022400` is 15 Oct 2026 00:00 UTC, as RFC 9745 writes a date; `Sunset`
  is RFC 8594.)
- A successful `GET /menu/{id}` also carries
  `Link: </v1/menu/{id}>; rel="successor-version"`.

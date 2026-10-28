-- POST /v1/orders idempotency (CONTRACT.md §4.2) and GET /v1/orders paging (§4.4).

-- One row per Idempotency-Key whose request ended in 201. Written in the same
-- transaction as the order, so a key exists if and only if its order does.
CREATE TABLE idempotency_keys (
  key         TEXT    PRIMARY KEY,
  fingerprint TEXT    NOT NULL,              -- sha256 of the request body as a canonical JSON value
  status      INTEGER NOT NULL,              -- always 201: only a 201 is stored
  location    TEXT    NOT NULL,
  body        TEXT    NOT NULL,              -- the response body, byte for byte
  order_id    INTEGER NOT NULL REFERENCES orders(id),
  created_at  TEXT    NOT NULL               -- ISO 8601, UTC
);

-- A key whose first request has not finished yet (409 idempotency-key-in-flight).
-- Shared through the database so every instance sees it; deleted when the request
-- ends. expires_at lets a lock left behind by a crashed process lapse.
CREATE TABLE idempotency_locks (
  key        TEXT    PRIMARY KEY,
  token      TEXT    NOT NULL,
  expires_at INTEGER NOT NULL                -- ms since the epoch
);

-- GET /v1/orders?tableId=…, newest first.
CREATE INDEX orders_by_table ON orders (table_id, id);

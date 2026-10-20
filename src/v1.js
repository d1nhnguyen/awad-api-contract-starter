// The /v1 API. Implement it from CONTRACT.md — the contract is the spec.
//
// createV1(db) returns a handler for every request whose path is /v1 or starts
// with /v1/. The handler must answer the request and return true. Returning
// false (as this stub does) hands the request to the legacy code, which
// answers 404 { error: 'not_found' } — the wrong shape for /v1.
//
// Helpers you may use: send(), readRaw() in ./http.js.
// Schema: migrations/001_init.up.sql. Add new tables as migrations/002_*.sql.

export function createV1(db) {
  return async function handleV1(req, res, url) {
    return false;
  };
}

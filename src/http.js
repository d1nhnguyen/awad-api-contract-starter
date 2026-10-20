// Small helpers shared by the legacy routes and /v1. No framework on purpose:
// everything the contract talks about — status, headers, body — is visible here.

export function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

// The raw request body as a string ('' when there is none). Parsing is the
// caller's job, so it can decide what a malformed body means.
export async function readRaw(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw;
}

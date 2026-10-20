# Session 5 starter — the contract comes first

CSC13114 · Advanced Web Application Development · HK1 2026–2027

The `smart-restaurant` menu service again, as it looks after IA#2: money is an
integer number of dong. Node 22.5+, no dependencies — SQLite through the
built-in `node:sqlite`.

The service still has only its **legacy** API (`/menu…`). Your job today is the
new, versioned API under `/v1`, and the contract for it is already written:
**[`CONTRACT.md`](CONTRACT.md)**. You do not write the implementation by hand —
your agent does, from the contract. Then `npm run contract` decides whether it
did what the contract says.

## Run it

```bash
npm run migrate          # creates data/app.db
npm run seed             # 200 menu items
npm start                # :3001 — PORT=3002 npm start for a second instance
npm test                 # the legacy API: green, and it must stay green
npm run contract         # CONTRACT.md, checked over HTTP: all red until /v1 exists
```

| Path | What it is |
|---|---|
| `CONTRACT.md` | the specification of `/v1`. **Read it before you prompt anything** |
| `src/v1.js` | an empty stub — the `/v1` implementation goes here |
| `src/app.js` | the legacy API, and the place where `/v1` is plugged in |
| `migrations/` | `001_init` is the schema. A new table is a new `002_….up.sql` + `.down.sql` |
| `test/legacy.test.js` | what old clients rely on |
| `test/contract.test.js` | the contract tests — 29 of them, each named after the section it checks |

## In the room

1. `npm run migrate && npm run seed && npm test && npm run contract`. Legacy
   green, contract all red. Commit nothing yet.
2. Read `CONTRACT.md` — ten minutes, no agent. Start `NOTES.md` with the **two
   sentences of the contract you expect the agent to get wrong**, and why.
3. Hand it to your agent. Something like:

   > Implement the `/v1` API in `src/v1.js` exactly as `CONTRACT.md` specifies,
   > and the headers its section 5 requires on the legacy API in `src/app.js`.
   > Put any new table in a new migration with a `down`. Do not read or edit
   > anything under `test/`, and do not edit `CONTRACT.md`. Run `npm test` when
   > you are done; it must stay green.

4. **Before you fix anything**:
   `npm run contract 2>&1 | tee contract-run-1.txt` — the agent's first attempt,
   as it is. Commit it.
5. Get to green. When a test fails, give the agent the **test name and the
   section of `CONTRACT.md`** — not the test code. Then
   `npm run contract 2>&1 | tee contract-run-final.txt`.
6. In `NOTES.md`, one line per test that failed in `contract-run-1.txt`: the
   sentence of the contract, what the agent did instead, and — if the sentence
   could be read two ways — the wording you would change it to.
7. Ask the agent: *"Which sentences of `CONTRACT.md` could be read two ways, and
   what did you choose for each?"* A green run does not mean the contract is
   complete — only that the tests found nothing. For every point it lists, write
   in `NOTES.md` your decision and the sentence you would add to the contract.

Rules: do not edit `test/contract.test.js` to make it pass, and do not change
`CONTRACT.md` to match the code. If you think a test or the contract is wrong,
say so in `NOTES.md` — that is a finding, not a failure.

## Then: your own project

Write the same kind of contract for **one endpoint of your team's project** — the
one whose errors you would least like a stranger to see. Use the sections of
`CONTRACT.md` as the template: errors (slug, status, when), resource shape,
rules for every field, paging if it returns a list, idempotency if it creates
something, and what happens to the old version when it changes. Commit it to your
team repository as `docs/contract/<endpoint>.md`.

## What to turn in on Classroom

Not graded on its own — it is groundwork for `PA#2`, where contract tests become
part of your quality gate. Due **Wednesday 28 October, 22:00**:

- `contract-run-1.txt`, `contract-run-final.txt` and `NOTES.md` — your own;
- the link to your team's `docs/contract/<endpoint>.md` — the same link for
  everyone in the team.

`AI-LOG.md` still applies to the project contract: say which parts the
assistant drafted.

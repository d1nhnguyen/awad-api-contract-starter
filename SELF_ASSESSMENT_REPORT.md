# Self-assessment — IA#3

Submitted by: 23120031 — Nguyễn Phú Dinh

Total I claim: 92 / 100

| Criterion                                    | Max | I claim | Evidence                                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | --- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. The contract tests pass                   | 30  | 30      | `contract-run-final.txt`: 29/29 contract, legacy 3/3 (`npm test`), on Node 22, from a fresh `data/`. `src/` has not changed since that run (659e202)                                                                                                                                     |
| 2. The rules were kept                       | 10  | 10      | `git diff ee78c39 -- test CONTRACT.md` is empty. New tables only in `migrations/002_v1_orders.up.sql` with a matching `.down.sql` (up and down both run)                                                                                                                                 |
| 3. Predictions, made before the agent ran    | 10  | 10      | NOTES.md §1: P1 and P2 quote §4.2, each with a reason; committed in 409f58b, before the agent's first commit 73a784c. Outcome line for each (neither came true)                                                                                                                          |
| 4. The first run, read line by line          | 20  | 17      | `contract-run-1.txt` (f0a5a79) is 29/29 and was committed before the only `src/` fix (659e202). As the rubric asks for that case, NOTES.md §2 explains three points the agent said it guessed at (unknown fields, "in progress", cursor and tableId): sentence, what it did, new wording |
| 5. The sentences that could be read two ways | 20  | 16      | NOTES.md §3: the agent's 20 points pasted, each with my decision, why, and a sentence to add; point 16 corrected (no test caught it). Point 23 found by me; points 21–22 are not in the agent's list but came from a second AI session (declared in AI-LOG.md)                           |
| 6. AI-LOG.md                                 | 10  | 9       | The prompt handed over (verbatim), the fix prompt, the two-ways question; Rejected: the repeated-parameter rule in listOrders (659e202). The review session is declared in its own entry                                                                                                 |

## What I did not manage

The agent's first attempt already passed 29/29, so I had no real failures to
explain: criterion 4 rests on three points the agent said it guessed at, not on
failing tests.

I used a second Claude Code session heavily: it found the repeated-parameter
rule I rejected, drafted most of the decisions and proposed sentences in
NOTES.md §3, and found points 21–22. I read and checked each one against
CONTRACT.md and the code, but only point 23 was found by me. The one fix prompt
names no test, because no test failed.

I recorded the legacy 500 leaking `e.message` as a finding (NOTES.md point 20)
but did not fix it, because §5 says legacy behaviour must stay exactly as it is.

## What I would do differently

Look for two-way sentences myself, with the contract open, before asking any
agent — so that more of NOTES.md §3 is my own reading rather than a review of
the agent's. And keep AI-LOG.md as I go: I wrote parts of it after the fact
and had to correct who found what.

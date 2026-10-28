# AI-LOG — IA#3

## 2026-10-28 — predictions in NOTES.md (IA#3)

Tool: none. The README says to read CONTRACT.md with no agent, and the
predictions are the point of the step. NOTES.md (409f58b) was committed before
the agent's first commit (73a784c).

## 2026-10-28 — the /v1 API from CONTRACT.md (IA#3)

Tool: Claude Code (Claude Opus 5.5).
Asked for: the README's prompt. Implement /v1 in src/v1.js exactly as
CONTRACT.md specifies, add the §5 headers to the legacy API in src/app.js, put
any new table in a migration with a down, do not read or edit test/ or
CONTRACT.md, and keep `npm test` green. The prompt, as sent:

> Implement the /v1 API in src/v1.js exactly as CONTRACT.md specifies, and the headers its section 5 requires on the legacy API in src/app.js. Put any new table in a new migration with a down. Do not read or edit anything under test/, and do not edit CONTRACT.md. Run npm test when you are done; it must stay green.

Kept: src/v1.js, the §5 headers in src/app.js, and migration 002
(idempotency_keys, idempotency_locks, an index on orders(table_id, id)).
Commit 73a784c holds them exactly as the agent wrote them. P1 and P2 were checked
in the code with the review session (entry below; NOTES.md §1). contract-run-1.txt: 29/29. `npm test`: 3/3.
Changed: nothing else. Since 73a784c, src/ differs only in the read() helper
of listOrders (the rejection below, 659e202). migrations/ is unchanged.
Rejected: listOrders in src/v1.js returned 400 validation when a query parameter
was repeated (?limit=5&limit=5). The contract has no such rule: §2 allows
validation only when a field or parameter "breaks a rule in this contract", and
the §4.4 table lists only three rules. I removed it, and the server now uses the
first value. No test caught this; both runs are 29/29. It was found when I
reviewed the agent's diff with a second Claude Code session (the review session
below), which showed ?limit=5&limit=5 → 400 on a throwaway server.
Fix prompt, sent to the review session: "Remove the 'must be given at most once'
rule in listOrders". No test failed, so it names no test; the contract sections
are in the reason above.

## 2026-10-28 — two-way sentences in CONTRACT.md (IA#3)

Tool: Claude Code (Claude Opus 5.5), in the session that wrote src/.
Asked for: "Which sentences of CONTRACT.md could be read two ways, and what did
you choose for each?" (asked after 659e202).
Kept: its 20 points, pasted as given into NOTES.md §3, and every choice the code
makes now. The decision and the contract wording under each point were drafted
with the review session (entry below); I read each against CONTRACT.md and the
code.
Changed: point 16. It said the repeated-parameter choice "was caught by a test".
That is false: contract-run-1.txt and contract-run-final.txt are both 29/29, and
it was found reading the diff, with the review session. I corrected it under the point. Its list also
missed two sentences; the review session found them, and they are points 21
(§2 vs §5: is the list of problem types closed?) and 22 (§1: the timestamp
format).
Rejected: none of its 20 choices.

## 2026-10-28 — review session: requirements, diff review, NOTES draft (IA#3)

Tool: Claude Code (Claude Opus 5.5), a second session that did not write src/
and did not read test/.
Asked for: a summary of the README, CONTRACT.md, the rubric and the slides;
"find one thing in the agent's diff I should not keep"; then the fix prompt
"Remove the 'must be given at most once' rule in listOrders"; then a draft of
NOTES.md (§1 Outcome, §2, the decision and wording lines in §3, points 21–22).
Later: a rewording of my own point 23 (NOTES.md §3, "Found by me") so that it
argues from the contract instead of the code; the point itself is mine. Then a
draft of SELF_ASSESSMENT_REPORT.md, whose marks I checked against the rubric.
Kept: the repeated-parameter finding (it showed ?limit=5&limit=5 → 400 on a
throwaway server, and that §2/§4.4 have no such rule); its fix in 659e202,
still 29/29 and 3/3; the NOTES draft, after I read each point against
CONTRACT.md and the code.
Changed: its NOTES draft said I found point 16 and points 21–22 myself; they
came from this session, so I reworded them. Its wording for point 8 said the
in-flight mark lapses "after a crash"; the code (LOCK_MS) expires it 60 s
after the key passes step 1, so the sentence now says that.
Rejected: its advice to run `! nvm use 22` once: every command runs in a fresh
shell, so it did not stick and contract.test.js crashed on Node 20. I ran
`nvm use 22` in my own terminal before each run instead.

## 2026-10-28 — this log (IA#3)

Tool: Claude Code (Claude Opus 5.5).
Asked for: AI-LOG.md in the course template's format, from git log, NOTES.md
and the two contract runs.
Kept: the entries above, after checking each one against git log,
contract-run-1.txt and contract-run-final.txt.

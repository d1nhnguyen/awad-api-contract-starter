# NOTES — IA#3

## 1. Predictions (written before the agent touched src/)

### P1 — §4.2

> Two bodies are _the same_ when they are equal as JSON values: key order and
> whitespace do not matter, any other difference does.

Why I expect the agent to get it wrong: the agent might compare two JSON strings instead of their values. So if there are two equivalent JSON bodies with different key orders or whitespace will be treated as different requests.

### P2 — §4.2

> When step 6 succeeds, the server stores the key, a fingerprint of the body and
> the response, **in the same transaction as the order**.

Why I expect the agent to get it wrong: the agent might save the order and its idempotency record in separate database transactions. If one operation succeeds and the other fails, the database could become inconsistent and it may allowing duplicate orders when the client retries.

### Outcome

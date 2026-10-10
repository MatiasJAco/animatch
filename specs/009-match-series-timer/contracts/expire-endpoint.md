# Contract: Match the Series Time-Out Reveal Endpoint

**Feature**: [spec.md](../spec.md) | **Phase**: 1 — Design & Contracts | **Date**: 2026-10-10

## Purpose

The answer mapping for the day is never shipped in the daily puzzle payload (001 R-010, spec
FR-027a/b). When the 90-second countdown reaches zero and the game is not won, the client has no way
to reveal the correct series on its own, so it asks the server for the disclosure that the old
lost-on-mistake response used to carry. This endpoint is that disclosure, on demand and stateless.

## Endpoint

```text
POST /api/daily/match_the_series/expire
```

- **Request body**: none. (The time-out is a device assertion; the server holds no clock — see
  [research.md](../research.md) R-004 for the accepted trade-off.)
- **Authentication / identity**: none (Constitution IV).

### 200 response

```json
{
  "result": "expired",
  "state": "lost",
  "answers": {
    "c:12345": "a:9001",
    "p:678": "a:9002"
  }
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `result` | `"expired"` | The ending cause, distinct from a scored `hit`/`miss` |
| `state` | `"lost"` | The game is finished for the day |
| `answers` | `Record<string, string>` | The full mapping — every clue key to its correct series key (18 entries) |

The mapping is exactly `daily_puzzles.solution.answers` for the day: the same set the old ending-miss
outcome disclosed. No clue name, image, or extra field is added.

### Error responses

Reuses the shared `ErrorEnvelope` (`{ error: { code, message } }`) and status map
(`server/utils/errors.ts`):

| Condition | Code | HTTP |
|-----------|------|------|
| Stored puzzle cannot be read | `DATABASE_UNAVAILABLE` | 503 |
| No puzzle for the day / generation failed | `PUZZLE_UNAVAILABLE` | 503 |

No code, message, or field leaks connection strings, SQL, stack traces, or hostnames (Constitution V).

## Rules

1. **Stateless**: the endpoint reads the stored puzzle and writes nothing; it creates no session and
   stores no result (Constitution IV).
2. **No new disclosure class**: it returns only the mapping the existing loss path already revealed;
   it never returns the mapping before a loss, because the client only calls it after the clock hits
   zero (a determined client could call it earlier; accepted under the v1 threat model, R-004).
3. **Deterministic**: for a given UTC day the response is identical on every call — it is the stored
   solution, not a recomputation.
4. **Fail visible**: on error the client shows the existing bilingual retry panel rather than marking
   the game lost without a reveal.

## Client behavior

1. The countdown reaching zero triggers exactly one `expire` request (guarded so a reload or a slow
   tick cannot double-apply the ending).
2. On `200`: persist `status: 'lost'` and `revealedAnswers = answers` in the day's progress entry,
   render the existing reveal list, and stop the countdown.
3. On error: render the error panel with a retry (the same request), keep the game in progress, and
   keep the clock at zero so a reload or retry resumes the ending.

## Out of scope (validated as unchanged)

- `GET /api/daily/match_the_series` payload shape except the removed `wrongLimit` key.
- The attempt endpoint's `hit`/`miss` scoring and the `greenPairs` evidence check.
- `daily_puzzles` schema, migrations, and the create-once path.

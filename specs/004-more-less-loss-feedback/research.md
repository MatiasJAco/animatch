# Research: More or Less — Explain Every Loss

**Feature**: [spec.md](spec.md) | **Phase**: 0 — Outline & Research | **Date**: 2026-10-07

All unknowns were resolved from the codebase itself (the existing More or Less server logic, board component, progress composable, i18n catalogs, and test layout). No project-external research was required. Each decision below records what was chosen, why, and the alternatives considered.

## R-001 — Where the loss explanation renders

**Decision**: The loss explanation is part of the result view (the page's `finished` branch), rendered alongside the existing `ResultPanel` summary, not as an inline block in `MoreOrLessBoard`.

**Rationale**: Today a miss makes the board emit `outcome`, the page sets `finished`, and the parent immediately renders `ResultPanel` in place of the board (`app/pages/game/more-or-less.vue:57-71`). The board's inline reveal block (`MoreOrLessBoard.vue:107-118`) is therefore unmounted at exactly the moment a miss is announced — the player may never see it, which is the defect this feature fixes. Owning the explanation in the result view guarantees a persistent, single home for the reason (FR-001, FR-006) and works identically for the fresh-loss and return-visit flows.

**Alternatives considered**:
- *Keep the explanation in the board* — rejected: the board leaves the DOM on finish, so reloads and return visits would show no explanation without extra plumbing, and the current code already proves this path is visually unreliable.
- *Dedicated full-screen panel replacing ResultPanel* — rejected: it would duplicate the result/share chrome and complicate the win/loss shared layout.

## R-002 — How the failed person's identity is obtained on a return visit

**Decision**: Derive the person (id and name for the tile) from the recorded **failed round index** plus the **day's puzzle payload**, `ordered = [initialVisible, ...chain]`, hidden = `ordered[failedRound + 1]` — the exact rule the server uses (`server/game/moreOrLess.ts:67-68`). No person identity is stored in the loss record.

**Rationale**: Per Principle III the day's puzzle is deterministic and identical for everyone for the UTC day, and the page already refetches it on every visit (`useFetch('/api/daily/more_or_less')`). Storing only the round index plus the counts keeps the stored record small, avoids duplicating puzzle data, and cannot drift from the actual comparison because it is computed from the same payload the server compared against.

**Alternatives considered**:
- *Store personId/personName in the loss record* — rejected: redundant with the stable daily puzzle and adds fields that must be kept consistent in storage; still requires the puzzle for nothing else.
- *Return person identity in the attempt response* — rejected: the server contract already ships name+id in the puzzle payload, and changing the attempt contract would widen disclosure surface for no benefit (see R-007).

**Degradation rule** (spec edge cases + FR-012/FR-013): if the recorded round is out of range or the puzzle lacks that person, the helper returns `personId: null` / empty name and the view renders counts and answers without the tile — never blank.

## R-003 — Persistence mechanism for the loss record

**Decision**: Extend the existing client blob `animatch:v1:progress`. Add an optional `loss?: MoreOrLessLossRecord` field to `LocalGameState` for `more_or_less`, and allow `markFinished(game, status, attempts, extra?)` to merge extra fields (used for `loss`, `endedAt`).

**Rationale**: The blob is already date-scoped (previous day discarded on load, `useLocalProgress.ts:94-107`), namespaced per game, and tolerant of malformed input (returns null -> fresh empty state). Adding an optional field is backward compatible with every existing stored blob (old blobs simply lack `loss`) and with the version marker `v: 1` (additive, non-breaking). This satisfies FR-007 (explanation persists for the UTC day) and FR-011 (cleared/malformed storage -> playable empty state).

**Alternatives considered**:
- *New storage key* — rejected: would introduce a second unversioned key and a second day-scoping mechanism to keep in sync.
- *Server-side persistence* — rejected outright: violates Principle IV (stateless v1, no accounts/session) and would require schema + API changes.

## R-004 — The "red" emphasis within audit/accessibility/test constraints

**Decision**: The true hidden count is rendered in red using the existing `--wrong` theme token (`app/assets/css/main.css:15`), the same token already used for `.feedback--wrong`. The count is always accompanied by its text label and the reveal sentence, so meaning never depends on color alone; the answer/count labels also carry an explicit distinguishing role via natural reading order.

**Rationale**: Principle VI forbids tests asserting on stylesheet text, CSS class string contents, or markup snapshots; and FR-012 requires meaning that survives a no-color reading. Using the established token (which is dark-mode aware via the `--wrong` variant) keeps the forced "red" request satisfied while the label guarantees accessibility. Visual red is verified manually in quickstart, not by the test suite.

**Alternatives considered**:
- *Hard-coded `color: red`* — rejected: bypasses the app's theme system and would look wrong in dark mode.
- *New dedicated token* — rejected: unnecessary; `--wrong` already means "incorrect answer" throughout the app.

## R-005 — Component structure for the explanation

**Decision**: New component `app/components/MoreOrLessLossExplanation.vue` (props: the derived `MoreOrLessLossView`) and a single optional slot in `ResultPanel` so the page composes:

```vue
<ResultPanel game="more_or_less" state="lost" :attempts="...">
  <MoreOrLessLossExplanation :view="lossView" />
</ResultPanel>
```

The slot is empty for wins and for the other two games, so `ResultPanel`'s rendered output is unchanged elsewhere.

**Rationale**: Keeps the explanation strongly scoped to More or Less (no cross-game prop creep on a shared component), cleanly separates concern (component takes a view object, not storage/outcome internals), and preserves the existing result/share chrome.

**Alternatives considered**:
- *Extend `ResultPanel` props to carry loss details* — rejected: it is shared by three games and would grow with game-specific knowledge.
- *New top-level `MoreOrLessLostPanel` replacing ResultPanel* — rejected: duplicates the shared result/share markup.

## R-006 — Board behavior on a miss

**Decision**: On a `miss`, the board does not rely on its inline `revealed` block; it emits the outcome immediately and the result view renders the explanation (FR-006). The board's inline reveal continues to serve the *hit* case (reveals the count between rounds). Concretely: keep `revealed = true` only for hits; the miss branch resolves through the page.

**Rationale**: Removes the redundant/flashing transient block that the parent unmount would destroy anyway, and makes the single source of the miss explanation unambiguous. The hit-path reveal (`more_or_less.reveal`) is unchanged.

**Alternatives considered**:
- *Leave board reveal as-is on miss* — rejected: it paints (or threatens to paint) a second, larger explanation that vanishes on unmount, which is exactly the confusing behavior being removed. No server or page-flow change is implied beyond the board's own branch.

## R-007 — Server and API changes

**Decision**: **None.** `MoreOrLessOutcome` already returns `result`, `round`, `correct`, `given`, `counts {hidden, visible}`, `state` on a miss (`server/game/moreOrLess.ts:26-34,85-92`; contract `specs/001-daily-anime-puzzles/contracts/openapi.yaml`, `moreOrLessMiss` example). The hidden count's disclosure is already the sole disclosure path and is confined to the resolved round, satisfying FR-009.

**Rationale**: Reusing the existing outcome avoids opening any new disclosure surface, keeps the API contract frozen (per the 001 spec's `MoreOrLessOutcome` description that counts are disclosed on both hit and miss), and keeps this feature purely client-side — the lowest-risk change satisfying the spec.

**Alternatives considered**:
- *Add person id/name to the attempt outcome* — rejected: redundant (puzzle carries id/name already) and would expand a frozen contract.
- *New endpoint for loss summary* — rejected: statelessness plus no benefit (Principle IV).

## R-008 — i18n additions and copy correction

**Decision**: Fix the existing Spanish `more_or_less.reveal` typo from `"Tinha {count} roles"` to `"Tenía {count} roles"`. Answer words reuse `more_or_less.answer.more|less`; the round indicator reuses `more_or_less.round`. No "your answer"/"correct answer" sentence is added — the review decision is that the comparison itself (the true count on the red-framed tile against the compared count) is the explanation, so those labels are intentionally omitted from the catalog. No new color- or tile-related strings are needed; the tile alt text reuses `image.alt`.

**Rationale**: FR-008 demands both locales complete from the first commit and a correctness review of existing loss/reveal copy — the "Tinha" typo is a surfaced defect (Portuguese spelling in the Spanish catalog, present in the built output). All user-facing text routes through the catalog; nothing is inlined.

**Alternatives considered**: keep copy as-is — rejected: the typo is user-visible Spanish copy on the exact loss/reveal screen this feature is building.

## R-009 — Test strategy within the 15-test cap

**Decision**: Extract the derivation into a pure helper `app/utils/moreOrLessLoss.ts` (`lossView(puzzle, loss) -> MoreOrLessLossView`) and test it directly; extend `tests/local-progress.test.ts` for loss-record persistence, next-day discard, and malformed-record degradation; extend `tests/i18n.test.ts` for the reveal label in both locales and the typo fix. Planned new/edited test coverage fits well under the 15-test feature cap (≈4–6 new `it` blocks) and matches the existing style (vitest over pure logic — see `tests/local-progress.test.ts`, `tests/i18n.test.ts`).

**Rationale**: The project has no Vue component-mount harness, and Principle VI disallows assertions on stylesheet text or markup snapshots. Asserting the pure view object (person, counts, answers, round) plus storage and locale behavior covers all spec-acceptance semantics; the red "color" is not asserted by tests and is validated in quickstart.

**Alternatives considered**:
- *Component mounting tests (e.g. @vue/test-utils)* — rejected: would add a new dependency (Constitution VI requires owner approval) and the project deliberately tests behavior via logic units.
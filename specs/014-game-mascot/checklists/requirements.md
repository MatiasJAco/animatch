# Specification Quality Checklist: Game Screen Mascot

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-14
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Validation passed on 2026-11-14 (iteration 1 of 3). All 16 checklist items pass; no `[NEEDS CLARIFICATION]` marker was left in the spec.
- Validation re-passed on 2026-11-14 (iteration 2 of 3, after the clarification session of the same date). All 16 checklist items still pass and no item changed state, so no checkbox marker was toggled.
- **Scope is bounded** in Overview, Vocabulary, FR-001, FR-002 and FR-004: the mascot appears on the five playable screens — More or Less, Groups and the Spring/Summer/Autumn 2026 editions of Match the Series — in every state, and on no other screen. The app's error page and the home screen's existing behaviour are explicitly out of scope (FR-004, FR-005).
- **The request's three words are each pinned to a measurable outcome**: "the same mascot" → FR-003 and SC-011 (identical image file, asset unchanged); "at the same size" → FR-006, FR-007, FR-009 and SC-001 (one size rule, shared with the home screen, measured identical within 1 pixel at every viewport); "in the same corner" → FR-008 and SC-002 (the viewport's inline-end and block-end edges, within 1 pixel). SC-012 additionally holds the home screen itself unchanged.
- **One genuine conflict was resolved and recorded** rather than left open. The request fixes the size and the corner, while a narrow viewport's game column reaches the window's edge, so the mascot must overlap the board's bottom inline-end corner — the same overlap the home screen already has over its card column. The overlap is accepted (Clarifications, session 2026-11-14; FR-014; Known Limitation; Assumptions) with the properties it must never break — no layout change, no swallowed click, no scrollbar, no removed, hidden or truncated text, and no covered content trapped under the mascot — and SC-016 requires it to be written down in the feature's contract. It is never resolved by changing the mascot's size or corner, because that would defeat the request.
- **The five clarification answers are integrated, each in the section it belongs to.** (1) *What the mascot may cover*: FR-014, FR-015, the Overview, the Edge Cases, User Story 3's sixth acceptance scenario and the Known Limitation entity now say "visually cover" and allow any board content — tile artwork, labels, counts, the More/Fewer buttons and the status copy — provided every control beneath still answers clicks and taps and the content can be scrolled out from under the mascot. (2) *"Remove, hide or truncate"*: the phrase is defined in the Overview and in FR-014 as changing the text or taking it out of the layout, not covering it, so the requirement now agrees with the Overview. (3) *Legibility*: FR-019 is checkable as it stands — no opaque background against the dark surface and the same drawing in both display modes — with an explicit statement that no contrast ratio is specified or asserted, mirrored in the dark-mode edge case and in SC-017. (4) *How it is proven*: SC-018 and a new assumption record that every outcome about presence, size, corner, overlap and failure behaviour is asserted automatically, that the suite stays within the constitution's 15-test cap by looping over the screens, viewports and states, and that the rest is covered by the existing game checks re-run with the mascot present. (5) *What "unchanged" means*: FR-005, SC-012, the Overview and a new assumption state that the home screen is unchanged for the visitor — same rendered size, corner, behaviour and file, 0 differences — while sharing one mascot component and renaming markup, class names and test hooks are permitted as internal changes; feature 013's contract file is updated to point at the supersession.
- **The non-interference requirements are stated as outcomes, not preferences**: FR-013 (0 pixels of overlap at 1024 pixels and wider, where the game column is narrower than the home page's), FR-015 (0 swallowed clicks, and covered content scrollable out from under the mascot), FR-016 (0 horizontal scrollbars from 320 to 1920 pixels), FR-017 (0 measurable change to board geometry, header geometry, action positions or scroll behaviour), FR-018 (0 focus stops) — each with a matching measure in SC-005 to SC-009.
- **The failure path is kept**: FR-022 and SC-010 require the game to stay fully playable with no broken-image indicator and no fallback request; the existing home screen's behaviour is unchanged (FR-005, SC-012).
- **Compatibility is restated, not assumed**: FR-023 to FR-029 and SC-012 to SC-015 keep the routes, daily content, scoring, saved results, sharing, the board-first layout contract, both message catalogs and the dependency set intact, so this feature cannot silently regress what feature 013 and the earlier features guaranteed.
- **The specification names no framework, language, styling mechanism, component or file.** The viewport widths, the 1024-pixel band boundary, the 35% and 55% size ceilings and the asset's dimensions and budget are observable properties of the existing mascot's behaviour that the feature reuses unchanged, not implementation choices made here. The one passage that names internal artefacts — FR-005 and the "Unchanged" assumption's permission to share one mascot component and to rename markup, class names and test hooks — is an owner-sanctioned boundary on what may change invisibly, not an implementation choice: it prescribes no language, framework, styling mechanism or file.

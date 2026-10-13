# Contract: Home Game Grid & Ordering

**Feature**: [spec.md](../spec.md) | **Phase**: 1 — Design & Contracts | **Date**: 2026-10-13

## Interface scope

- **UI contract**: how the home page presents the larger set of games.
- **No API contract change**: ordering is served by `/api/daily` (see
  [game-identities.md](./game-identities.md)).

---

## 1. Layout

The home game list becomes a responsive grid instead of a single vertical column.

| Concern | Rule |
|---------|------|
| Desktop/tablet | Two or more cards per row when width allows |
| Phone | Cards remain readable and tappable, no horizontal scrolling |
| Card contents | Unchanged: name, summary, finished badge, status message, play link |
| Dependencies | No new library; CSS-only layout on the existing list element |

## 2. Ordering

Order is authoritative from the listing; the client renders the received order.

1. More or Less
2. Match the Series — Autumn 2026 (current season)
3. Match the Series — Spring 2026
4. Match the Series — Summer 2026
5. Groups

## 3. Per-card state

Each card independently shows: ready with a play link, unavailable, error, or finished-today.
A finished edition and an unfinished edition coexist on the same page. A single unavailable or
errored card never replaces the whole list (the existing total-failure guard still applies only
when every game is in error).

## 4. Localization

Every card's name, summary, and status text comes from the message catalog in both Spanish and
English. The card's route is derived from the game identity exactly as today
(`match_the_series_autumn_2026` → `/game/match-the-series-autumn-2026`).
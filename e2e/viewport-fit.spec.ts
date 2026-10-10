import { test, expect, type Page } from '@playwright/test'

/**
 * Board-first layout verification harness (feature 007).
 *
 * Assertions target rendered geometry and DOM order only — no stylesheet text, class-string
 * contents, or markup snapshots. Vertical page scrolling is allowed on the game screens (feature
 * 007 relaxed feature 006's lock); horizontal overflow is still forbidden.
 */

interface Viewport {
  name: string
  width: number
  height: number
}

const VIEWPORTS: Viewport[] = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1024x768', width: 1024, height: 768 },
]

const ROUTES = {
  home: '/',
  match: '/game/match-the-series',
  groups: '/game/groups',
  more: '/game/more-or-less',
} as const

type GameKey = 'match' | 'groups' | 'more'

const ATTEMPT_URL: Record<GameKey, string> = {
  match: '**/api/daily/match_the_series/attempt',
  groups: '**/api/daily/groups/attempt',
  more: '**/api/daily/more_or_less/attempt',
}

const READY: Record<GameKey, string> = {
  match: '.grid-3x3 .tile',
  groups: '.grid-4x4 .tile',
  more: '.comparison',
}

// The board-first contract per screen: the board is the first region, then the actions (where they
// exist), then the status/how-to-play copy.
const REGIONS: Record<GameKey, { board: string; actions: string | null; meta: string }> = {
  match: { board: '.game-board', actions: null, meta: '.game-meta' },
  groups: { board: '.game-board', actions: '.game-actions', meta: '.game-meta' },
  more: { board: '.game-board', actions: '.game-actions', meta: '.game-meta' },
}

const ERROR_CODE_BODY = JSON.stringify({ error: { code: 'DATABASE_UNAVAILABLE' } })

interface Box {
  top: number
  bottom: number
  left: number
  right: number
  height: number
  centerY: number
}

async function boxOf(page: Page, selector: string): Promise<Box | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
      height: r.height,
      centerY: (r.top + r.bottom) / 2,
    }
  }, selector)
}

async function viewportHeight(page: Page): Promise<number> {
  const size = page.viewportSize()
  if (!size) throw new Error('viewport size unavailable')
  return size.height
}

// FR-007: no horizontal page scroll anywhere at a supported width.
async function noHorizontalScroll(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => {
    const root = document.scrollingElement as HTMLElement
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth }
  })
  expect
    .soft(
      metrics.scrollWidth,
      `horizontal overflow: scrollWidth ${metrics.scrollWidth} > clientWidth ${metrics.clientWidth}`,
    )
    .toBe(metrics.clientWidth)
}

// The home screen is out of scope and keeps its locked frame.
async function noDocumentScroll(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => {
    const root = document.scrollingElement as HTMLElement
    return {
      scrollHeight: root.scrollHeight,
      clientHeight: root.clientHeight,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
    }
  })
  expect
    .soft(metrics.scrollHeight, `vertical overflow: ${metrics.scrollHeight} > ${metrics.clientHeight}`)
    .toBe(metrics.clientHeight)
  expect
    .soft(metrics.scrollWidth, `horizontal overflow: ${metrics.scrollWidth} > ${metrics.clientWidth}`)
    .toBe(metrics.clientWidth)
}

// No element may extend past the viewport's horizontal edges (FR-007 / FR-002).
async function withinNoHorizontalOverflow(page: Page): Promise<void> {
  const size = page.viewportSize()
  if (!size) return
  const offenders = await page.evaluate((width) => {
    const bad: string[] = []
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue
      if (rect.left < -1 || rect.right > width + 1) {
        const tag = el.tagName.toLowerCase()
        const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : ''
        bad.push(`${tag}${cls ? '.' + cls : ''} [${Math.round(rect.left)}..${Math.round(rect.right)}]`)
      }
    }
    return bad
  }, size.width)
  expect.soft(offenders, `horizontal overflow: ${offenders.join(', ')}`).toEqual([])
}

// US1: the board is the first region; the primary actions and the status/help copy come after it,
// and the board + actions are usable without scrolling.
async function assertBoardFirst(page: Page, game: GameKey): Promise<void> {
  const regions = REGIONS[game]
  const board = await boxOf(page, regions.board)
  const meta = await boxOf(page, regions.meta)
  expect(board, `${game}: board region missing`).not.toBeNull()
  expect(meta, `${game}: status/help region missing`).not.toBeNull()
  const height = await viewportHeight(page)
  expect.soft(board!.top, `${game}: board must precede the status/help copy`).toBeLessThan(meta!.top)
  if (regions.actions) {
    // The action row is present while playing and absent in a finished/failed board.
    const actions = await boxOf(page, regions.actions)
    if (actions) {
      expect.soft(board!.top, `${game}: board must precede the action row`).toBeLessThan(actions.top)
      expect
        .soft(actions.bottom, `${game}: action row must be usable without scrolling`)
        .toBeLessThanOrEqual(height + 1)
    }
  }
  expect.soft(board!.top, `${game}: board must be above the fold`).toBeLessThan(height)
}

// US3: the title and the Home/Reset controls share one row with aligned vertical centers.
async function assertHeaderAligned(page: Page, game: GameKey): Promise<void> {
  const title = await boxOf(page, '.game-header__title')
  const controls = await boxOf(page, '.game-header-controls')
  expect(title, `${game}: title missing`).not.toBeNull()
  expect(controls, `${game}: header controls missing`).not.toBeNull()
  const overlap = Math.min(title!.bottom, controls!.bottom) - Math.max(title!.top, controls!.top)
  expect.soft(overlap, `${game}: title and controls must share one row`).toBeGreaterThan(0)
  expect
    .soft(Math.abs(title!.centerY - controls!.centerY), `${game}: header centers differ`)
    .toBeLessThanOrEqual(2)
}

// US2: the freed height goes to the board, not to blank space (proxy: the board is taller than the
// status/help block it displaced) and the board stays horizontally centered.
async function assertBoardGrowth(page: Page, game: GameKey): Promise<void> {
  const board = await boxOf(page, '.game-board')
  const meta = await boxOf(page, '.game-meta')
  const size = page.viewportSize()
  expect(board).not.toBeNull()
  expect(meta).not.toBeNull()
  expect.soft(board!.height, `${game}: board should be larger than the moved copy`).toBeGreaterThan(meta!.height)
  if (size) {
    const boardCenter = (board!.left + board!.right) / 2
    expect.soft(Math.abs(boardCenter - size.width / 2), `${game}: board should be centered`).toBeLessThanOrEqual(2)
  }
}

// Refined FR-009: an attempt error is visible above the fold and is never part of the
// below-the-fold status/how-to-play copy.
async function assertErrorAboveFold(page: Page, game: GameKey): Promise<void> {
  const panel = await boxOf(page, 'section.card[role="alert"]')
  expect(panel, `${game}: error panel missing`).not.toBeNull()
  const height = await viewportHeight(page)
  expect.soft(panel!.top, `${game}: error panel must be above the fold`).toBeLessThan(height)
  const inMeta = await page.evaluate(() => {
    const el = document.querySelector('section.card[role="alert"]')
    return Boolean(el && el.closest('.game-meta'))
  })
  expect.soft(inMeta, `${game}: error panel must not live in .game-meta`).toBe(false)
  const retry = await boxOf(page, 'section.card[role="alert"] .button')
  if (retry) {
    expect
      .soft(retry.bottom, `${game}: error retry must be reachable without scrolling`)
      .toBeLessThanOrEqual(height + 1)
  }
}

async function setLocale(page: Page, locale: 'es' | 'en'): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem('animatch:v1:prefs', JSON.stringify({ v: 1, language: value }))
  }, locale)
}

async function clearProgress(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.removeItem('animatch:v1:progress'))
}

async function openPlaying(page: Page, game: GameKey): Promise<void> {
  await page.goto(ROUTES[game])
  await page.waitForSelector(READY[game])
}

// Ensures a tile ends up selected, re-clicking if the first click raced Vue hydration.
async function selectTiles(page: Page, count: number): Promise<void> {
  const tiles = page.locator('.grid-4x4 .tile')
  for (let i = 0; i < count; i += 1) {
    const tile = tiles.nth(i)
    await expect(async () => {
      if ((await tile.getAttribute('aria-pressed')) !== 'true') {
        await tile.click({ timeout: 2000 })
      }
      await expect(tile).toHaveAttribute('aria-pressed', 'true')
    }).toPass({ timeout: 20_000 })
  }
}

async function attemptMatch(page: Page): Promise<void> {
  await page.locator('.grid-3x3 .tile').first().click({ timeout: 2000 })
}

async function attemptGroups(page: Page): Promise<void> {
  await selectTiles(page, 4)
  await page.locator('.game-actions button.button:not(.button--ghost)').click({ timeout: 2000 })
}

async function attemptMore(page: Page): Promise<void> {
  await page.locator('.game-actions button').first().click({ timeout: 2000 })
}

async function attempt(page: Page, game: GameKey): Promise<void> {
  if (game === 'match') return attemptMatch(page)
  if (game === 'groups') return attemptGroups(page)
  return attemptMore(page)
}

// Retries the attempt until the requested post-state renders; a first click can race hydration.
async function attemptUntil(
  page: Page,
  game: GameKey,
  postSelector: string,
  count?: number,
): Promise<void> {
  await expect(async () => {
    await attempt(page, game)
    if (count === undefined) {
      await expect(page.locator(postSelector)).toBeVisible({ timeout: 1500 })
    } else {
      await expect(page.locator(postSelector)).toHaveCount(count, { timeout: 1500 })
    }
  }).toPass({ timeout: 30_000 })
}

// Principle V: an attempt that fails must render the error panel with a retry action.
async function forceAttemptError(page: Page, game: GameKey): Promise<void> {
  await page.route(ATTEMPT_URL[game], (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: ERROR_CODE_BODY }),
  )
}

async function routeMatchTimeout(page: Page): Promise<void> {
  const payload = await (await page.request.get('/api/daily/match_the_series')).json()
  const answers: Record<string, string> = {}
  for (const clue of payload.clues as Array<{ key: string }>) {
    answers[clue.key] = payload.grid.series[0].key
  }
  await page.route('**/api/daily/match_the_series/expire', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: 'expired', state: 'lost', answers }),
    }),
  )
}

// Seeds a near-zero remaining time so the countdown reaches zero without a real 90-second wait.
async function seedMatchTimer(page: Page, remainingMs: number): Promise<void> {
  await page.evaluate((ms) => {
    const key = 'animatch:v1:progress'
    const day = new Date().toISOString().slice(0, 10)
    localStorage.setItem(
      key,
      JSON.stringify({
        v: 1,
        date: day,
        games: {
          match_the_series: {
            status: 'in_progress',
            attempts: 0,
            greenSeries: [],
            answeredClues: [],
            clueIndex: 0,
            greenPairs: [],
            timerRemainingMs: ms,
          },
        },
      }),
    )
  }, remainingMs)
}

async function routeGroupsLoss(page: Page): Promise<void> {
  const payload = await (await page.request.get('/api/daily/groups')).json()
  const keys = (payload.tiles as Array<{ key: string }>).map((tile) => tile.key)
  const groups = [0, 1, 2, 3].map((index) => ({
    keys: keys.slice(index * 4, index * 4 + 4),
    criterion: { type: 'same_source', source: `group-${index}` },
  }))
  await page.route(ATTEMPT_URL.groups, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: 'miss', overlap: 0, state: 'lost', groups }),
    }),
  )
}

async function routeMoreOrLessLoss(page: Page): Promise<void> {
  await page.route(ATTEMPT_URL.more, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        result: 'miss',
        round: 0,
        correct: 'more',
        given: 'less',
        counts: { hidden: 5, visible: 3 },
        state: 'lost',
      }),
    }),
  )
}

test.describe('board-first layout', () => {
  test.describe.configure({ timeout: 180_000 })

  // T001 smoke: the locked home screen still boots and fits.
  test('home fits the viewport at 1920x1080', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(ROUTES.home)
    await page.waitForSelector('.game-list .card')
    await noDocumentScroll(page)
    await withinNoHorizontalOverflow(page)
  })

  // US1: no horizontal overflow, and the error state stays above the fold (vertical scroll is
  // allowed now, but a failure must remain visible).
  test('no horizontal overflow and error visibility across screens and states', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      await page.goto(ROUTES.home)
      await page.waitForSelector('.game-list .card')
      await noHorizontalScroll(page)

      for (const game of ['match', 'groups', 'more'] as GameKey[]) {
        await openPlaying(page, game)
        await noHorizontalScroll(page)

        await forceAttemptError(page, game)
        await attemptUntil(page, game, 'section.card[role="alert"]')
        await assertErrorAboveFold(page, game)
        await noHorizontalScroll(page)
        await page.unroute(ATTEMPT_URL[game])
      }
    }
  })

  // US1 + US2 + US3: board-first order, aligned headers and a grown board at every size.
  test('board-first order, header alignment and board growth on each game', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      for (const game of ['match', 'groups', 'more'] as GameKey[]) {
        await openPlaying(page, game)
        const actionSelector = REGIONS[game].actions
        if (actionSelector) {
          await expect(page.locator(actionSelector), `${game}: actions visible while playing`).toBeVisible()
        }
        await assertBoardFirst(page, game)
        await assertHeaderAligned(page, game)
        await assertBoardGrowth(page, game)
        await withinNoHorizontalOverflow(page)
      }
    }
  })

  // US1: the resize sweep keeps horizontal overflow off at every intermediate width.
  test('resize sweep keeps horizontal overflow off', async ({ page }) => {
    for (const game of ['match', 'groups', 'more'] as GameKey[]) {
      await openPlaying(page, game)
      for (let width = 1920; width >= 1024; width -= 60) {
        const height = 768 + Math.round(((width - 1024) / (1920 - 1024)) * (1080 - 768))
        await page.setViewportSize({ width, height })
        await noHorizontalScroll(page)
      }
      for (let width = 1024; width <= 1920; width += 60) {
        const height = 768 + Math.round(((width - 1024) / (1920 - 1024)) * (1080 - 768))
        await page.setViewportSize({ width, height })
        await noHorizontalScroll(page)
      }
    }
  })

  // US1 finished states: the board stays first and nothing overflows horizontally; the result and
  // the status copy are allowed below the fold.
  test('finished states follow the board-first contract', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      await page.goto(ROUTES.home)
      await page.waitForSelector('.game-list .card')
      await clearProgress(page)

      // Match time-out in session: the reveal list stays inside the board region, above the meta.
      await page.goto(ROUTES.match)
      await page.waitForSelector(READY.match)
      await routeMatchTimeout(page)
      await seedMatchTimer(page, 800)
      await page.reload()
      await page.waitForSelector('.reveal-list')
      await assertBoardFirst(page, 'match')
      await noHorizontalScroll(page)
      await withinNoHorizontalOverflow(page)

      // Match finished after reload: the persisted reveal survives.
      await page.reload()
      await page.waitForSelector('.share-text')
      await page.waitForSelector('.reveal-list')
      await assertBoardFirst(page, 'match')
      await noHorizontalScroll(page)

      // Groups loss in session: revealed rows inside the board grid.
      await clearProgress(page)
      await page.goto(ROUTES.groups)
      await page.waitForSelector(READY.groups)
      await routeGroupsLoss(page)
      await attemptUntil(page, 'groups', '.group-row--revealed', 4)
      await assertBoardFirst(page, 'groups')
      await noHorizontalScroll(page)
      await withinNoHorizontalOverflow(page)

      // Groups finished after reload.
      await page.reload()
      await page.waitForSelector('.share-text')
      await assertBoardFirst(page, 'groups')
      await noHorizontalScroll(page)

      // More-or-Less loss: the explanation replaces the board; assert it is present and unclipped.
      await clearProgress(page)
      await page.goto(ROUTES.more)
      await page.waitForSelector(READY.more)
      await routeMoreOrLessLoss(page)
      await attemptUntil(page, 'more', '.loss-explanation')
      await expect(page.locator('.result-summary')).toBeVisible()
      await noHorizontalScroll(page)
      await withinNoHorizontalOverflow(page)

      await page.unroute(ATTEMPT_URL.match)
      await page.unroute(ATTEMPT_URL.groups)
      await page.unroute(ATTEMPT_URL.more)
    }
  })

  // Both locales keep the contract and wrap without horizontal overflow.
  test('both locales keep the board-first contract', async ({ page }) => {
    for (const locale of ['es', 'en'] as const) {
      await setLocale(page, locale)
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })

        await page.goto(ROUTES.home)
        await page.waitForSelector('.game-list .card')
        await noHorizontalScroll(page)

        for (const game of ['match', 'groups', 'more'] as GameKey[]) {
          await openPlaying(page, game)
          await assertBoardFirst(page, game)
          await assertHeaderAligned(page, game)
          await noHorizontalScroll(page)
          await withinNoHorizontalOverflow(page)
        }
      }
    }
  })
})

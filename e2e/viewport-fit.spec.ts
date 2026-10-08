import { test, expect, type Page } from '@playwright/test'

/**
 * Viewport-fit verification harness (feature 006).
 *
 * Assertions target rendered metrics only: document scroll geometry and element bounding boxes.
 * No stylesheet text, class-string, or markup-snapshot assertions.
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

const PUZZLE_URL: Record<GameKey, string> = {
  match: '**/api/daily/match_the_series',
  groups: '**/api/daily/groups',
  more: '**/api/daily/more_or_less',
}

const READY: Record<GameKey, string> = {
  match: '.grid-3x3 .tile',
  groups: '.grid-4x4 .tile',
  more: '.comparison',
}

const ERROR_CODE_BODY = JSON.stringify({ error: { code: 'DATABASE_UNAVAILABLE' } })

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
    .soft(
      metrics.scrollHeight,
      `vertical overflow: scrollHeight ${metrics.scrollHeight} > clientHeight ${metrics.clientHeight}`,
    )
    .toBe(metrics.clientHeight)
  expect
    .soft(
      metrics.scrollWidth,
      `horizontal overflow: scrollWidth ${metrics.scrollWidth} > clientWidth ${metrics.clientWidth}`,
    )
    .toBe(metrics.clientWidth)
}

async function withinViewport(page: Page, selectors: readonly string[]): Promise<void> {
  const size = page.viewportSize()
  if (!size) {
    throw new Error('viewport size is unavailable')
  }
  for (const selector of selectors) {
    const locator = page.locator(selector)
    const count = await locator.count()
    expect(count, `missing P1 region: ${selector}`).toBeGreaterThan(0)
    for (let i = 0; i < count; i += 1) {
      const box = await locator.nth(i).boundingBox()
      expect(box, `no bounding box for ${selector}[${i}]`).not.toBeNull()
      if (!box) {
        continue
      }
      const right = box.x + box.width
      const bottom = box.y + box.height
      expect.soft(box.x, `${selector}[${i}] left ${box.x}`).toBeGreaterThanOrEqual(-1)
      expect.soft(box.y, `${selector}[${i}] top ${box.y}`).toBeGreaterThanOrEqual(-1)
      expect
        .soft(right, `${selector}[${i}] right ${right} > viewport ${size.width}`)
        .toBeLessThanOrEqual(size.width + 1)
      expect
        .soft(bottom, `${selector}[${i}] bottom ${bottom} > viewport ${size.height}`)
        .toBeLessThanOrEqual(size.height + 1)
    }
  }
}

// FR-001 / FR-002: no element may extend past the viewport edges at any supported size.
async function withinNoHorizontalOverflow(page: Page): Promise<void> {
  const size = page.viewportSize()
  if (!size) {
    return
  }
  const offenders = await page.evaluate((width) => {
    const bad: string[] = []
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) {
        continue
      }
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
  await page.locator('.row button.button:not(.button--ghost)').click({ timeout: 2000 })
}

async function attemptMore(page: Page): Promise<void> {
  await page.locator('.row button').first().click({ timeout: 2000 })
}

async function attempt(page: Page, game: GameKey): Promise<void> {
  if (game === 'match') {
    return attemptMatch(page)
  }
  if (game === 'groups') {
    return attemptGroups(page)
  }
  return attemptMore(page)
}

// Retries the attempt until the requested post-state renders; a first click can race hydration
// on the dev server.
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

// A craftable "lost" outcome lets every finished layout be measured deterministically.
async function routeMatchLoss(page: Page): Promise<void> {
  const payload = await (await page.request.get('/api/daily/match_the_series')).json()
  const answers: Record<string, string> = {}
  for (const clue of payload.clues as Array<{ key: string }>) {
    answers[clue.key] = payload.grid.series[0].key
  }
  await page.route(ATTEMPT_URL.match, async (route) => {
    const body = (route.request().postDataJSON() ?? {}) as { clueKey?: string; seriesKey?: string }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        result: 'miss',
        state: 'lost',
        clueKey: body.clueKey,
        seriesKey: body.seriesKey,
        correctSeriesKey: payload.grid.series[0].key,
        answers,
      }),
    })
  })
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

const P1 = {
  home: ['.home__header', '.home__header .lang-switch', '.game-list .card'],
  matchPlaying: ['.page-header', '.clue-card', '.grid-3x3', '.match-next'],
  groupsPlaying: ['.page-header', '.grid-4x4', '.row .button'],
  groupsRows: ['.page-header', '.grid-4x4'],
  morePlaying: ['.page-header', '.comparison', '.row button'],
  result: ['.page-header', '.share-text'],
  error: ['.page-header', 'section.card[role="alert"]', 'section.card[role="alert"] .button'],
} as const

const PLAYING_P1: Record<GameKey, readonly string[]> = {
  match: P1.matchPlaying,
  groups: P1.groupsPlaying,
  more: P1.morePlaying,
}

test.describe('viewport fit', () => {
  test.describe.configure({ timeout: 180_000 })

  // T008 — harness smoke: the locked shell boots and the helper agrees with the browser.
  test('home fits the viewport at 1920x1080', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(ROUTES.home)
    await page.waitForSelector('.game-list .card')
    await noDocumentScroll(page)
    await withinViewport(page, P1.home)
  })

  // T009 — scroll predicates across screens, states, and viewports.
  test('no document scroll across screens and states', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      await page.goto(ROUTES.home)
      await page.waitForSelector('.game-list .card')
      await noDocumentScroll(page)

      for (const game of ['match', 'groups', 'more'] as GameKey[]) {
        // Playing state (real puzzle data).
        await openPlaying(page, game)
        await noDocumentScroll(page)

        // Attempt-error state: the endpoint fails, the panel renders above the board.
        await forceAttemptError(page, game)
        await attemptUntil(page, game, 'section.card[role="alert"]')
        await noDocumentScroll(page)
      }
    }
  })

  // T010 — every P1 region lies fully inside the viewport, and nothing overflows horizontally.
  test('primary regions stay inside the viewport', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      await page.goto(ROUTES.home)
      await page.waitForSelector('.game-list .card')
      await withinViewport(page, P1.home)
      await withinNoHorizontalOverflow(page)

      for (const game of ['match', 'groups', 'more'] as GameKey[]) {
        await openPlaying(page, game)
        await withinViewport(page, PLAYING_P1[game])
        await withinNoHorizontalOverflow(page)

        // Error-state P1: the panel and its retry action must also fit beside the board.
        await forceAttemptError(page, game)
        await attemptUntil(page, game, 'section.card[role="alert"]')
        await withinViewport(page, P1.error)
        await withinNoHorizontalOverflow(page)
        await page.unroute(ATTEMPT_URL[game])
      }
    }
  })

  // T016 — the resize sweep: fit holds between the checkpoints too.
  test('resize sweep keeps the document locked', async ({ page }) => {
    for (const game of ['match', 'groups', 'more'] as GameKey[]) {
      await openPlaying(page, game)
      for (let width = 1920; width >= 1024; width -= 60) {
        const height = 768 + Math.round(((width - 1024) / (1920 - 1024)) * (1080 - 768))
        await page.setViewportSize({ width, height })
        await noDocumentScroll(page)
      }
      for (let width = 1024; width <= 1920; width += 60) {
        const height = 768 + Math.round(((width - 1024) / (1920 - 1024)) * (1080 - 768))
        await page.setViewportSize({ width, height })
        await noDocumentScroll(page)
      }
    }
  })

  // T019 — finished and expanded states still fit.
  test('finished states stay inside the viewport', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      // Fresh device progress for this viewport; the finished states are then re-driven below.
      await page.goto(ROUTES.home)
      await page.waitForSelector('.game-list .card')
      await clearProgress(page)

      // Match loss, same session: 18-entry reveal list + result panel + share.
      await page.goto(ROUTES.match)
      await page.waitForSelector(READY.match)
      await routeMatchLoss(page)
      await attemptUntil(page, 'match', '.reveal-list')
      await noDocumentScroll(page)
      await withinViewport(page, [...P1.matchPlaying, '.reveal-list', '.share-text'])
      await withinNoHorizontalOverflow(page)

      // Match finished after reload: result panel + share, no reveal list.
      await page.reload()
      await page.waitForSelector('.share-text')
      await noDocumentScroll(page)
      await withinViewport(page, P1.result)
      await withinNoHorizontalOverflow(page)

      // Groups loss, same session: four revealed rows + result panel + share.
      await clearProgress(page)
      await page.goto(ROUTES.groups)
      await page.waitForSelector(READY.groups)
      await routeGroupsLoss(page)
      await attemptUntil(page, 'groups', '.group-row--revealed', 4)
      await noDocumentScroll(page)
      await withinViewport(page, [...P1.groupsRows, '.share-text'])
      await withinNoHorizontalOverflow(page)

      // Groups finished after reload: result panel + share, no rows.
      await page.reload()
      await page.waitForSelector('.share-text')
      await noDocumentScroll(page)
      await withinViewport(page, P1.result)
      await withinNoHorizontalOverflow(page)

      // More-or-Less loss with the red-framed explanation.
      await clearProgress(page)
      await page.goto(ROUTES.more)
      await page.waitForSelector(READY.more)
      await routeMoreOrLessLoss(page)
      await attemptUntil(page, 'more', '.loss-explanation')
      await noDocumentScroll(page)
      await withinViewport(page, [...P1.result, '.loss-explanation', '.comparison'])
      await withinNoHorizontalOverflow(page)

      await page.unroute(ATTEMPT_URL.match)
      await page.unroute(ATTEMPT_URL.groups)
      await page.unroute(ATTEMPT_URL.more)
    }
  })

  // T024 — both locales wrap without horizontal overflow.
  test('both locales fit at every viewport', async ({ page }) => {
    for (const locale of ['es', 'en'] as const) {
      await setLocale(page, locale)
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })

        await page.goto(ROUTES.home)
        await page.waitForSelector('.game-list .card')
        await noDocumentScroll(page)
        await withinNoHorizontalOverflow(page)

        for (const game of ['match', 'groups', 'more'] as GameKey[]) {
          await openPlaying(page, game)
          await noDocumentScroll(page)
          await withinNoHorizontalOverflow(page)
        }
      }
    }
  })
})

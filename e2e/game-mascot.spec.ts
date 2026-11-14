import { test, expect, type Page } from '@playwright/test'

/**
 * Game screen mascot contract (feature 014).
 *
 * Assertions target rendered geometry and rendered behaviour only — no stylesheet text,
 * no CSS class-string contents, no markup snapshots (Constitution VI). Every measurement
 * is taken from the live DOM.
 */

interface Game {
  /** The game's id in `server/game/ids.ts`. */
  id: string
  /** The game's route. */
  route: string
  /** The selector that is present only once the board is on screen. */
  ready: string
  /** The game's own daily endpoint — the interception scope, never a bare daily pattern. */
  daily: string
}

// The five game screens, in the order `GAME_IDS` declares them.
const GAMES: Game[] = [
  {
    id: 'more_or_less',
    route: '/game/more-or-less',
    ready: '.comparison',
    daily: '**/api/daily/more_or_less',
  },
  {
    id: 'match_the_series_autumn_2026',
    route: '/game/match-the-series-autumn-2026',
    ready: '.grid-3x3 .tile',
    daily: '**/api/daily/match_the_series_autumn_2026',
  },
  {
    id: 'match_the_series_spring_2026',
    route: '/game/match-the-series-spring-2026',
    ready: '.grid-3x3 .tile',
    daily: '**/api/daily/match_the_series_spring_2026',
  },
  {
    id: 'match_the_series_summer_2026',
    route: '/game/match-the-series-summer-2026',
    ready: '.grid-3x3 .tile',
    daily: '**/api/daily/match_the_series_summer_2026',
  },
  {
    id: 'groups',
    route: '/game/groups',
    ready: '.grid-4x4 .tile',
    daily: '**/api/daily/groups',
  },
]

const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 360, height: 640 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]

// The widths the resize sweep walks through, from the smallest supported window to the largest.
const SWEEP_WIDTHS = [
  320, 360, 400, 480, 560, 640, 720, 768, 820, 900, 1024, 1152, 1280, 1440, 1600, 1920,
]

const TOLERANCE = 1

// The loading branch's own copy, in the English catalog.
const LOADING_TEXT = 'Loading…'

// The structured failure body the app already handles.
const ERROR_BODY = JSON.stringify({ error: { code: 'DATABASE_UNAVAILABLE' } })

interface Rect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

interface MascotBox extends Rect {
  /** The URL the browser actually loaded for the mascot image. */
  imageUrl: string
}

// The locale is fixed so the loading copy has one exact spelling.
async function setEnglish(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('animatch:v1:prefs', JSON.stringify({ v: 1, language: 'en' }))
  })
}

// The daily payload is loaded with `await useFetch`, so a cold load issues the request from the
// SSR process, where the browser's routing never sees it, and the browser then hydrates from
// the SSR payload without re-requesting. The non-default states are therefore reached through a
// client-side navigation, which the browser does issue — and that only works once the app has
// hydrated, because an unhydrated link is a plain document navigation.
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const win = window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }
    if (typeof win.useNuxtApp === 'function') {
      return win.useNuxtApp().isHydrating === false
    }
    // A production build does not expose the Nuxt app on `window`; Vue's own mount marker on
    // the root element is the fallback signal.
    const root = document.querySelector('#__nuxt') as (Element & { __vue_app__?: unknown }) | null
    return Boolean(root && '__vue_app__' in root)
  })
}

// The game screen's own Home link: a client-side navigation back to the catalog.
async function goHomeByClientNavigation(page: Page): Promise<void> {
  await page.locator('a.game-header-controls__link[href="/"]').first().click()
  await page.waitForSelector('main.home')
  await page.waitForSelector('[data-home-catalog] [data-game-card]')
  await waitForHydration(page)
}

// The catalog's card link: a client-side navigation into the game route, which issues the
// game's own daily request from the browser.
async function enterGameByClientNavigation(page: Page, game: Game): Promise<void> {
  await page.locator(`[data-home-catalog] a[data-game="${game.id}"]`).click()
  await page.waitForURL(new RegExp(`${game.route}$`))
}

async function measureMascot(page: Page): Promise<MascotBox> {
  await page.waitForFunction(() => {
    const image = document.querySelector('[data-mascot-image]') as HTMLImageElement | null
    return Boolean(image && image.complete && image.naturalWidth > 0)
  })
  return page.evaluate(() => {
    const wrapper = document.querySelector('[data-mascot]') as HTMLElement
    const image = document.querySelector('[data-mascot-image]') as HTMLImageElement
    const rect = wrapper.getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      imageUrl: image.currentSrc || image.src,
    }
  })
}

// The page's own scroll surface, and the board's and the header's boxes.
async function measureLayout(page: Page): Promise<{
  scrollWidth: number
  clientWidth: number
  scrollHeight: number
  clientHeight: number
  scrollTop: number
  board: Rect | null
  header: Rect | null
  disabled: number
}> {
  return page.evaluate(() => {
    const root = document.scrollingElement as HTMLElement
    const rectOf = (selector: string): Rect | null => {
      const element = document.querySelector(selector)
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      }
    }
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      scrollHeight: root.scrollHeight,
      clientHeight: root.clientHeight,
      scrollTop: root.scrollTop,
      board: rectOf('.game-board'),
      header: rectOf('.game-header'),
      disabled: document.querySelectorAll('[disabled]').length,
    }
  })
}

// No horizontal scrollbar, and nothing reaching past the window's horizontal edges.
async function assertNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const metrics = await page.evaluate(() => {
    const root = document.scrollingElement as HTMLElement
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth }
  })
  expect.soft(
    metrics.scrollWidth,
    `${label}: horizontal overflow: scrollWidth ${metrics.scrollWidth} > clientWidth ${metrics.clientWidth}`,
  ).toBe(metrics.clientWidth)

  const size = page.viewportSize()
  if (!size) return
  const offenders = await page.evaluate((width) => {
    const bad: string[] = []
    for (const element of Array.from(document.body.querySelectorAll('*'))) {
      const rect = element.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue
      if (rect.left < -1 || rect.right > width + 1) {
        const tag = element.tagName.toLowerCase()
        const cls =
          typeof element.className === 'string' ? element.className.split(' ')[0] : ''
        bad.push(`${tag}${cls ? `.${cls}` : ''} [${Math.round(rect.left)}..${Math.round(rect.right)}]`)
      }
    }
    return bad
  }, size.width)
  expect.soft(offenders, `${label}: horizontal overflow: ${offenders.join(', ')}`).toEqual([])
}

interface CoveredControl {
  index: number
  tag: string
  cls: string
  disabled: boolean
  x: number
  y: number
  /** What `elementFromPoint` finds at the click point. */
  hit: string | null
  /** True when the hit target is the control itself or something inside it. */
  hitIsControl: boolean
  /** True when the hit target is the mascot or something inside it. */
  hitIsMascot: boolean
}

// Every interactive control whose rectangle intersects the mascot's rectangle, with the point
// where a visitor would press it and what the browser finds there.
async function coveredControls(page: Page): Promise<CoveredControl[]> {
  return page.evaluate(() => {
    const mascot = document.querySelector('[data-mascot]') as HTMLElement | null
    if (!mascot) return []
    const box = mascot.getBoundingClientRect()
    const controls = Array.from(
      document.querySelectorAll('button, a[href], input, select, textarea, [tabindex]'),
    )
    // A previous scan may have left markers behind.
    for (const stale of Array.from(document.querySelectorAll('[data-covered-control]'))) {
      stale.removeAttribute('data-covered-control')
    }
    const covered: CoveredControl[] = []
    for (const element of controls) {
      const rect = element.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue
      const left = Math.max(rect.left, box.left)
      const right = Math.min(rect.right, box.right)
      const top = Math.max(rect.top, box.top)
      const bottom = Math.min(rect.bottom, box.bottom)
      if (right <= left || bottom <= top) continue
      const x = (left + right) / 2
      const y = (top + bottom) / 2
      const hit = document.elementFromPoint(x, y)
      const index = covered.length
      element.setAttribute('data-covered-control', String(index))
      covered.push({
        index,
        tag: element.tagName.toLowerCase(),
        cls: typeof element.className === 'string' ? element.className : '',
        disabled: (element as HTMLButtonElement).disabled === true,
        x,
        y,
        hit: hit ? `${hit.tagName.toLowerCase()}.${String(hit.className).split(' ')[0]}` : null,
        hitIsControl: Boolean(hit && (hit === element || element.contains(hit))),
        hitIsMascot: Boolean(hit && mascot.contains(hit)),
      })
    }
    return covered
  })
}

// The leaf text nodes the mascot covers, and whether they can be brought out from under it.
//
// The contract accepts the visual cover of the board's bottom inline-end region below 1024
// pixels, so what must never happen is a covered item being *trapped*: fully hidden under the
// mascot with no way out. Scrolling the page to its end must bring every covered item out from
// under the mascot, at least partly.
async function coveredText(page: Page): Promise<
  Array<{ text: string; coveredAtTop: boolean; trappedAtBottom: boolean }>
> {
  return page.evaluate(() => {
    const mascot = document.querySelector('[data-mascot]') as HTMLElement | null
    const root = document.scrollingElement as HTMLElement
    if (!mascot) return []
    const max = Math.max(0, root.scrollHeight - root.clientHeight)
    const box = mascot.getBoundingClientRect()
    const covered = (element: Element): boolean => {
      const rect = element.getBoundingClientRect()
      return (
        rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top
      )
    }
    const trapped = (element: Element): boolean => {
      const rect = element.getBoundingClientRect()
      return (
        rect.left >= box.left &&
        rect.right <= box.right &&
        rect.top >= box.top &&
        rect.bottom <= box.bottom
      )
    }
    const leaves = Array.from(document.querySelectorAll('main.game-shell *')).filter((element) => {
      if (element.children.length > 0) return false
      if ((element.textContent || '').trim().length === 0) return false
      const rect = element.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return false
      return covered(element)
    })
    const results = leaves.map((element) => {
      const coveredAtTop = covered(element)
      window.scrollTo(0, max)
      const trappedAtBottom = trapped(element)
      window.scrollTo(0, 0)
      return {
        text: (element.textContent || '').trim().slice(0, 40),
        coveredAtTop,
        trappedAtBottom,
      }
    })
    return results
  })
}

// The board still answers a click: a tile toggles, a board action posts an attempt.
async function expectBoardAnswersClick(page: Page, game: Game): Promise<void> {
  if (game.id === 'groups') {
    const tile = page.locator('.grid-4x4 .tile').first()
    await tile.click()
    await expect(tile).toHaveAttribute('aria-pressed', 'true')
    return
  }
  if (game.id === 'more_or_less') {
    const attempt = page.waitForRequest('**/api/daily/more_or_less/attempt')
    await page.locator('.game-actions button').first().click()
    await attempt
    return
  }
  const attempt = page.waitForRequest(`**/api/daily/${game.id}/attempt`)
  await page.locator('.grid-3x3 .tile').first().click()
  await attempt
}

test.describe('game mascot', () => {
  test.describe.configure({ timeout: 600_000 })

  // Contract §3 and §10 item 1: the mascot is present on all five game screens in all four
  // states, and on no other screen.
  test('the mascot is present on every game screen in every state', async ({ page }) => {
    await setEnglish(page)

    for (const game of GAMES) {
      // Playing: the default render.
      await page.goto(game.route)
      await page.waitForSelector(game.ready)
      await expect(page.locator('[data-mascot]'), `${game.id}: playing`).toBeVisible()

      // Loading: the daily payload resolved as null. The interception is scoped to this game's
      // own daily URL, so the home page's own listing fetch still works and the navigation into
      // the game route is possible.
      await page.route(game.daily, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
      )
      await goHomeByClientNavigation(page)
      await enterGameByClientNavigation(page, game)
      await expect(page.locator('main.game-shell .game-board'), `${game.id}: board`).toHaveCount(0)
      await expect(page.locator('main.game-shell p'), `${game.id}: loading copy`).toHaveCount(1)
      await expect(page.locator('main.game-shell p'), `${game.id}: loading copy`).toHaveText(
        LOADING_TEXT,
      )
      await expect(page.locator('[data-mascot]'), `${game.id}: loading`).toBeVisible()
      await page.unroute(game.daily)

      // Error: the daily request failed with the structured body the app already handles.
      await page.route(game.daily, (route) =>
        route.fulfill({ status: 503, contentType: 'application/json', body: ERROR_BODY }),
      )
      await goHomeByClientNavigation(page)
      await enterGameByClientNavigation(page, game)
      await expect(
        page.locator('main.game-shell section[role="alert"]'),
        `${game.id}: error panel`,
      ).toBeVisible()
      await expect(page.locator('[data-mascot]'), `${game.id}: error`).toBeVisible()
      await page.unroute(game.daily)
    }

    // Finished: the device's own progress store marks the game as won today.
    const today = new Date().toISOString().slice(0, 10)
    for (const game of GAMES) {
      await page.goto('/')
      await page.waitForSelector('[data-home-catalog] [data-game-card]')
      await page.evaluate(
        ({ game: id, day }) => {
          localStorage.setItem(
            'animatch:v1:progress',
            JSON.stringify({ v: 1, date: day, games: { [id]: { status: 'won', attempts: 1 } } }),
          )
        },
        { game: game.id, day: today },
      )
      await page.goto(game.route)
      await page.waitForSelector(game.ready)
      await expect(page.locator('.result-summary'), `${game.id}: result panel`).toBeVisible()
      await expect(page.locator('[data-mascot]'), `${game.id}: finished`).toBeVisible()
    }

    // An unknown route is the app's error page: no frame, no mascot.
    await page.goto('/no-such-game')
    await expect(page.locator('[data-mascot]')).toHaveCount(0)
  })

  // Contract §5 and §10 item 2: the same mascot — the same size, the same corner and the same
  // file — on the home screen and on the five game screens.
  test('the same size, the same corner and the same file on every screen', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport)

      await page.goto('/')
      await page.waitForSelector('[data-home-catalog] [data-game-card]')
      const home = await measureMascot(page)
      expect(home.imageUrl, 'home: the mascot file').toContain('/artwork/matchi-mascot.webp')

      for (const game of GAMES) {
        await page.goto(game.route)
        await page.waitForSelector(game.ready)
        const box = await measureMascot(page)
        const label = `${game.id} ${viewport.width}x${viewport.height}`

        // The same size as on the home screen.
        expect(Math.abs(box.width - home.width), `${label}: width`).toBeLessThanOrEqual(TOLERANCE)
        expect(Math.abs(box.height - home.height), `${label}: height`).toBeLessThanOrEqual(TOLERANCE)

        // The same corner: the viewport's bottom inline-end corner.
        expect(
          Math.abs(box.right - viewport.width),
          `${label}: the inline-end edge`,
        ).toBeLessThanOrEqual(TOLERANCE)
        expect(
          Math.abs(box.bottom - viewport.height),
          `${label}: the block-end edge`,
        ).toBeLessThanOrEqual(TOLERANCE)

        // The same file.
        expect(box.imageUrl, `${label}: the loaded image`).toBe(home.imageUrl)

        // At 1024 pixels and wider the mascot clears the game screen's content column.
        if (viewport.width >= 1024) {
          const overlap = await page.evaluate(() => {
            const mascot = document.querySelector('[data-mascot]') as HTMLElement
            const shell = document.querySelector('.game-shell') as HTMLElement
            const a = mascot.getBoundingClientRect()
            const b = shell.getBoundingClientRect()
            const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
            const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
            return { width, height, area: width * height, clearance: a.left - b.right }
          })
          expect(overlap.area, `${label}: overlap with the content column`).toBe(0)
          expect(overlap.clearance, `${label}: the clearance from the content column`).toBeGreaterThan(
            0,
          )
        }
      }
    }
  })

  // Contract §6, §7 and §10 item 3: the mascot never gets in the way of playing.
  test('the mascot never gets in the way of playing', async ({ page }) => {
    let coveredControlCount = 0
    let coveredTextCount = 0

    // The device's progress store is cleared before every game screen loads, so each board
    // starts fresh and the Match the Series countdown starts at its full limit.
    await page.addInitScript(() => {
      if (sessionStorage.getItem('reset-progress') === '1') {
        localStorage.removeItem('animatch:v1:progress')
        sessionStorage.removeItem('reset-progress')
      }
    })

    for (const game of GAMES) {
      await page.setViewportSize({ width: 360, height: 640 })
      await page.goto(game.route)
      await page.waitForSelector(game.ready)

      // The board, the header and the scroll metrics are the same with and without the mascot.
      const withMascot = await measureLayout(page)
      await page.evaluate(() => {
        document.querySelector('[data-mascot]')?.remove()
      })
      const withoutMascot = await measureLayout(page)
      expect(withoutMascot.board, `${game.id}: the board`).toEqual(withMascot.board)
      expect(withoutMascot.header, `${game.id}: the header`).toEqual(withMascot.header)
      expect(withoutMascot.scrollWidth, `${game.id}: the scroll width`).toBe(
        withMascot.scrollWidth,
      )
      expect(withoutMascot.clientWidth, `${game.id}: the client width`).toBe(
        withMascot.clientWidth,
      )
      expect(withoutMascot.scrollHeight, `${game.id}: the scroll height`).toBe(
        withMascot.scrollHeight,
      )
      expect(withoutMascot.clientHeight, `${game.id}: the client height`).toBe(
        withMascot.clientHeight,
      )
      expect(withoutMascot.scrollTop, `${game.id}: the scroll offset`).toBe(withMascot.scrollTop)
      expect(withoutMascot.disabled, `${game.id}: the disabled controls`).toBe(
        withMascot.disabled,
      )

      // Back to the playing state, with the mascot in place.
      await page.reload()
      await page.waitForSelector(game.ready)

      // The resize sweep from 320 to 1920 pixels: no horizontal scrollbar, nothing past the
      // window's horizontal edges.
      for (const width of SWEEP_WIDTHS) {
        const height = width <= 480 ? 640 : 800
        await page.setViewportSize({ width, height })
        await assertNoHorizontalOverflow(page, `${game.id} ${width}x${height}`)
      }

      // Every control beneath the mascot still answers a click, and the covered content is
      // never trapped under the mascot.
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport)

        // A fresh board, so every covered control is in the state the game offers it in.
        await page.evaluate(() => sessionStorage.setItem('reset-progress', '1'))
        await page.goto(game.route)
        await page.waitForSelector(game.ready)

        const controls = await coveredControls(page)
        coveredControlCount += controls.length
        for (const control of controls) {
          const label = `${game.id} ${viewport.width}x${viewport.height} ${control.cls}`
          // The pointer reaches the control: the mascot never intercepts it.
          expect(control.hitIsMascot, `${label}: the mascot intercepts the pointer`).toBe(false)
          expect(control.hitIsControl, `${label}: the click would miss the control`).toBe(true)

          if (control.disabled) {
            // A control the game itself has disabled answers nothing; the mascot must not
            // change that either.
            continue
          }

          const locator = page.locator(`[data-covered-control="${control.index}"]`)
          await expect(locator, `${label}: the covered control`).toBeVisible()

          if (control.cls.includes('button--ghost')) {
            // The clear button: with no selection there is nothing to observe, and the
            // pointer transparency above already proves the mascot never intercepts it.
            continue
          }

          if (control.cls.includes('tile') && game.id === 'groups') {
            // A tile toggles: the click flips its pressed state either way.
            const before = await locator.getAttribute('aria-pressed')
            await page.mouse.click(control.x, control.y)
            await expect
              .poll(async () => locator.getAttribute('aria-pressed'), {
                message: `${label}: the tile answers the click`,
              })
              .not.toBe(before)
            continue
          }
          // A board tile or a board action: the attempt it posts is the answer.
          const attempt = page.waitForRequest(`**/api/daily/${game.id}/attempt`)
          await page.mouse.click(control.x, control.y)
          await attempt
          // The board is idle again: the tile is operable once more, or it was locked green.
          await expect
            .poll(
              async () => {
                const disabled = await locator.getAttribute('disabled')
                const cls = (await locator.getAttribute('class')) ?? ''
                return disabled === null || cls.includes('tile--green')
              },
              { timeout: 20_000, message: `${label}: the board stays busy` },
            )
            .toBe(true)
        }

        // The covered content can always be brought out from under the mascot: scrolling to
        // the end of the page leaves nothing completely hidden under it.
        const covered = await coveredText(page)
        coveredTextCount += covered.length
        for (const item of covered) {
          expect(
            item.trappedAtBottom,
            `${game.id} ${viewport.width}x${viewport.height}: "${item.text}" is trapped under the mascot`,
          ).toBe(false)
        }
      }

      // No focus stop, and no animation.
      await page.setViewportSize({ width: 360, height: 640 })
      const focusableInside = await page.evaluate(() => {
        const mascot = document.querySelector('[data-mascot]')
        if (!mascot) return -1
        return mascot.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')
          .length
      })
      expect(focusableInside, `${game.id}: the mascot holds a focusable element`).toBe(0)

      let landedOnMascot = false
      for (let index = 0; index < 20; index += 1) {
        await page.keyboard.press('Tab')
        const inside = await page.evaluate(() => {
          const active = document.activeElement
          const mascot = document.querySelector('[data-mascot]')
          return Boolean(active && mascot && mascot.contains(active))
        })
        if (inside) landedOnMascot = true
      }
      expect(landedOnMascot, `${game.id}: the mascot takes a focus stop`).toBe(false)

      const motion = await page.evaluate(() => {
        const read = (selector: string) => {
          const element = document.querySelector(selector)
          if (!element) return null
          const style = getComputedStyle(element)
          return {
            animationName: style.animationName,
            transitionDuration: style.transitionDuration,
          }
        }
        return { wrapper: read('[data-mascot]'), image: read('[data-mascot-image]') }
      })
      expect(motion.wrapper, `${game.id}: the mascot wrapper`).not.toBeNull()
      expect(motion.image, `${game.id}: the mascot image`).not.toBeNull()
      expect(motion.wrapper!.animationName, `${game.id}: the mascot animates`).toBe('none')
      expect(motion.image!.animationName, `${game.id}: the mascot image animates`).toBe('none')
      expect(motion.wrapper!.transitionDuration, `${game.id}: the mascot transitions`).toBe('0s')
      expect(motion.image!.transitionDuration, `${game.id}: the mascot image transitions`).toBe(
        '0s',
      )
    }

    // The checks above are only meaningful if the mascot really does reach the board's
    // bottom inline-end region on the narrow screens: the known limitation the contract
    // records (contract §9).
    expect(coveredControlCount, 'the mascot never covered a control').toBeGreaterThan(0)
    expect(coveredTextCount, 'the mascot never covered any text').toBeGreaterThan(0)
  })

  // Contract §8 and §10 item 4: a failed mascot leaves the game playable.
  test('a failed mascot leaves the game playable', async ({ page }) => {
    for (const game of GAMES) {
      const requested: Array<{ url: string; type: string }> = []
      const onRequest = (request: { url(): string; resourceType(): string }) => {
        requested.push({ url: request.url(), type: request.resourceType() })
      }
      page.on('request', onRequest)
      await page.route('**/artwork/matchi-mascot.webp', (route) => route.abort())

      await page.goto(game.route)
      await page.waitForSelector(game.ready)

      // The board still renders.
      await expect(page.locator('.game-board'), `${game.id}: the board`).toBeVisible()

      // The failed image is removed and nothing shows a broken-image indicator.
      await expect(page.locator('[data-mascot-image]'), `${game.id}: the mascot image`).toHaveCount(0)
      await expect(page.locator('[data-mascot]'), `${game.id}: the mascot wrapper`).toHaveCount(1)
      const broken = await page.evaluate(
        () =>
          Array.from(document.querySelectorAll('img')).filter(
            (image) => !(image.complete && image.naturalWidth > 0),
          ).length,
      )
      expect(broken, `${game.id}: a broken-image indicator is showing`).toBe(0)

      // The game still answers a click.
      await expectBoardAnswersClick(page, game)

      // The mascot's file was requested and failed; no fallback image was requested for it.
      const mascotRequests = requested
        .filter((request) => request.type === 'image' && request.url.toLowerCase().includes('mascot'))
        .map((request) => request.url)
      expect(
        mascotRequests.some((url) => url.endsWith('/artwork/matchi-mascot.webp')),
        `${game.id}: the mascot file was never requested`,
      ).toBe(true)
      expect(
        mascotRequests.filter((url) => !url.endsWith('/artwork/matchi-mascot.webp')),
        `${game.id}: a fallback image was requested`,
      ).toEqual([])

      page.off('request', onRequest)
      await page.unroute('**/artwork/matchi-mascot.webp')
    }
  })
})

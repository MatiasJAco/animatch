import { test, expect, type Page } from '@playwright/test'

/**
 * Home artwork contract (feature 013).
 *
 * Assertions target rendered geometry and rendered behaviour only — no stylesheet text,
 * no CSS class strings, no markup snapshots (Constitution VI). Every measurement is
 * taken from the live DOM.
 */

const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 360, height: 640 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const

// The mascot never exceeds 35% of the viewport width or 55% of its height (FR-005).
// The height ceiling was raised from 30% to 55% on 2026-11-13: the mascot is a tall
// figure, so filling the free column to the right of the catalog — the size the owner
// asked for — necessarily takes more height than width.
const MAX_WIDTH_SHARE = 0.35
const MAX_HEIGHT_SHARE = 0.55

const TOLERANCE = 1

interface Rect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

async function waitForCatalog(page: Page): Promise<void> {
  await page.waitForSelector('[data-home-catalog] [data-game-card]')
  await expect(page.locator('[data-game-card]')).toHaveCount(5)
}

async function setLocale(page: Page, locale: 'es' | 'en'): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem('animatch:v1:prefs', JSON.stringify({ v: 1, language: value }))
  }, locale)
}

// The three scroll positions the contract requires: top, middle and bottom.
async function scrollPositions(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const root = document.scrollingElement as HTMLElement
    const max = Math.max(0, root.scrollHeight - root.clientHeight)
    return [0, Math.round(max / 2), max]
  })
}

async function scrollTo(page: Page, top: number): Promise<void> {
  await page.evaluate((y) => window.scrollTo(0, y), top)
  await page.waitForTimeout(50)
}

// Marks one game as finished so the card's state text is rendered and can be measured.
async function seedFinished(page: Page, game: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 10)
  await page.addInitScript(
    ({ game: id, day }) => {
      localStorage.setItem(
        'animatch:v1:progress',
        JSON.stringify({ v: 1, date: day, games: { [id]: { status: 'won', attempts: 1 } } }),
      )
    },
    { game, day: date },
  )
}

async function mascotRect(page: Page): Promise<Rect | null> {
  const box = await page.locator('[data-home-mascot]').boundingBox()
  if (!box) return null
  return {
    left: box.x,
    top: box.y,
    right: box.x + box.width,
    bottom: box.y + box.height,
    width: box.width,
    height: box.height,
  }
}

function intersects(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

async function cardBoxes(page: Page): Promise<Array<{ width: number; height: number }>> {
  return page.locator('[data-game-card]').evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect()
      return { width: box.width, height: box.height }
    }),
  )
}

function expectEqualBoxes(boxes: Array<{ width: number; height: number }>): void {
  expect(boxes).toHaveLength(5)
  const first = boxes[0]
  for (const box of boxes) {
    expect(Math.abs(box.width - first.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(box.height - first.height)).toBeLessThanOrEqual(1)
  }
}

test.describe('home mascot', () => {
  test.describe.configure({ timeout: 180_000 })

  // Contract §3: the mascot is fully inside the viewport, at its bottom edge, at every
  // scroll position, and within its size shares.
  test('the mascot stays inside the viewport at its bottom edge at every size', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/')
      await waitForCatalog(page)

      const mascot = page.locator('[data-home-mascot]')
      await expect(mascot).toBeVisible()

      let anchor: Rect | null = null
      for (const top of await scrollPositions(page)) {
        await scrollTo(page, top)

        const rect = await mascotRect(page)
        expect(rect, `${viewport.width}x${viewport.height}: the mascot has no box`).not.toBeNull()
        const box = rect!

        // Fully inside the viewport.
        expect(box.left, 'the mascot leaves the inline-start edge').toBeGreaterThanOrEqual(-TOLERANCE)
        expect(box.top, 'the mascot leaves the block-start edge').toBeGreaterThanOrEqual(-TOLERANCE)
        expect(box.right, 'the mascot leaves the inline-end edge').toBeLessThanOrEqual(
          viewport.width + TOLERANCE,
        )
        expect(box.bottom, 'the mascot leaves the block-end edge').toBeLessThanOrEqual(
          viewport.height + TOLERANCE,
        )

        // Anchored to the bottom edge of the viewport.
        expect(box.bottom, 'the mascot is not anchored to the bottom edge').toBeGreaterThanOrEqual(
          viewport.height - TOLERANCE,
        )

        // Inside its size shares.
        expect(box.width / viewport.width, 'the mascot is too wide').toBeLessThanOrEqual(
          MAX_WIDTH_SHARE,
        )
        expect(box.height / viewport.height, 'the mascot is too tall').toBeLessThanOrEqual(
          MAX_HEIGHT_SHARE,
        )

        // It never moves relative to the viewport.
        if (anchor === null) {
          anchor = box
        } else {
          expect(Math.abs(box.left - anchor.left)).toBeLessThanOrEqual(TOLERANCE)
          expect(Math.abs(box.top - anchor.top)).toBeLessThanOrEqual(TOLERANCE)
          expect(Math.abs(box.width - anchor.width)).toBeLessThanOrEqual(TOLERANCE)
          expect(Math.abs(box.height - anchor.height)).toBeLessThanOrEqual(TOLERANCE)
        }
      }
    }
  })

  // Contract §5 and §7: the mascot never covers card text and never swallows a click.
  //
  // The no-overlap assertion is scoped to the default text size. At 200% browser text zoom
  // below about 1024 pixels the mascot overlaps card text — a wrapped card-summary line reaches
  // the corner the mascot occupies — which the project owner accepted on 2026-11-13 as a
  // documented limitation for that rare condition (SC-022, contracts/home-mascot.md §5). Nothing
  // in this file asserts zero overlap at 200% zoom.
  test('the mascot covers no card text at the default text size and never swallows a click', async ({ page }) => {
    for (const locale of ['es', 'en'] as const) {
      await setLocale(page, locale)
      // The last card carries a state message once it is finished, so the state text is
      // rendered and measured too.
      await seedFinished(page, 'groups')

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.goto('/')
        await waitForCatalog(page)
        await expect(page.locator('[data-home-mascot]')).toBeVisible()
        await expect(page.locator('[data-card-state]')).toHaveCount(1)

        for (const top of await scrollPositions(page)) {
          await scrollTo(page, top)

          // The rectangle of the text itself, not of the block that holds it: the card
          // text is left-aligned, so the inline-end corner of a card carries no text.
          const overlaps = await page.evaluate(() => {
            const mascot = document.querySelector('[data-home-mascot]')
            if (!mascot) return { missing: true, hits: [] as string[] }
            const box = mascot.getBoundingClientRect()
            const hits: string[] = []
            const texts = document.querySelectorAll(
              '[data-card-name], [data-card-summary], [data-card-state]',
            )
            for (const element of Array.from(texts)) {
              const range = document.createRange()
              range.selectNodeContents(element)
              for (const rect of Array.from(range.getClientRects())) {
                if (rect.width === 0 && rect.height === 0) continue
                const touches =
                  rect.left < box.right &&
                  rect.right > box.left &&
                  rect.top < box.bottom &&
                  rect.bottom > box.top
                if (touches) {
                  hits.push(`${element.textContent?.trim().slice(0, 40) ?? ''}`)
                }
              }
            }
            return { missing: false, hits }
          })

          expect(overlaps.missing, `${locale} ${viewport.width}x${viewport.height}`).toBe(false)
          expect(
            overlaps.hits,
            `${locale} ${viewport.width}x${viewport.height}: the mascot covers card text`,
          ).toEqual([])
        }

        // A playable card under the mascot's region still opens its game. The mascot
        // floats over the catalog, so the card that lies under it is clicked exactly
        // where the mascot is.
        const targets: Array<{ x: number; y: number; game: string; top: number }> = []
        for (const top of await scrollPositions(page)) {
          await scrollTo(page, top)

          const target = await page.evaluate(() => {
            const mascot = document.querySelector('[data-home-mascot]')
            if (!mascot) return null
            const box = mascot.getBoundingClientRect()
            for (const card of Array.from(
              document.querySelectorAll('[data-game-card][data-state="playable"]'),
            )) {
              const rect = card.getBoundingClientRect()
              const left = Math.max(box.left, rect.left)
              const right = Math.min(box.right, rect.right)
              const topEdge = Math.max(box.top, rect.top)
              const bottom = Math.min(box.bottom, rect.bottom)
              if (right > left && bottom > topEdge) {
                return {
                  x: (left + right) / 2,
                  y: (topEdge + bottom) / 2,
                  game: card.getAttribute('data-game'),
                }
              }
            }
            return null
          })

          if (target?.game) targets.push({ ...target, top })
        }

        if (targets.length > 0) {
          for (const target of targets) {
            await scrollTo(page, target.top)
            await page.mouse.click(target.x, target.y)
            await expect(page).toHaveURL(
              new RegExp(`/game/${target.game.replace(/_/g, '-')}$`),
            )
            await page.goBack()
            await waitForCatalog(page)
          }
        } else {
          // No card lies under the mascot: it must stand clear of the catalog column.
          const overlapsCatalog = await page.evaluate(() => {
            const mascot = document.querySelector('[data-home-mascot]')
            const catalog = document.querySelector('[data-home-catalog]')
            if (!mascot || !catalog) return true
            const a = mascot.getBoundingClientRect()
            const b = catalog.getBoundingClientRect()
            return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
          })
          expect(
            overlapsCatalog,
            `${locale} ${viewport.width}x${viewport.height}: the mascot overlaps the catalog`,
          ).toBe(false)
        }
      }
    }
  })

  // Contract §4 and §2: the mascot adds no focus stop, performs no animation, and
  // changes neither the catalog's rendered width nor the page's scroll behaviour.
  test('the mascot adds no focus stop, no animation and no layout change', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await waitForCatalog(page)
    await expect(page.locator('[data-home-mascot]')).toBeVisible()

    // No focusable element inside the mascot.
    const focusableInside = await page.evaluate(() => {
      const mascot = document.querySelector('[data-home-mascot]')
      if (!mascot) return -1
      return mascot.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')
        .length
    })
    expect(focusableInside, 'the mascot holds a focusable element').toBe(0)

    // Tabbing never lands on the mascot.
    let landedOnMascot = false
    for (let index = 0; index < 15; index += 1) {
      await page.keyboard.press('Tab')
      const inside = await page.evaluate(() => {
        const active = document.activeElement
        const mascot = document.querySelector('[data-home-mascot]')
        return Boolean(active && mascot && mascot.contains(active))
      })
      if (inside) landedOnMascot = true
    }
    expect(landedOnMascot, 'the mascot takes a focus stop').toBe(false)

    // The mascot and its image never animate and never transition.
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
      return { wrapper: read('[data-home-mascot]'), image: read('[data-mascot-image]') }
    })
    expect(motion.wrapper, 'the mascot wrapper is missing').not.toBeNull()
    expect(motion.image, 'the mascot image is missing').not.toBeNull()
    expect(motion.wrapper!.animationName, 'the mascot animates').toBe('none')
    expect(motion.image!.animationName, 'the mascot image animates').toBe('none')
    expect(motion.wrapper!.transitionDuration, 'the mascot transitions').toBe('0s')
    expect(motion.image!.transitionDuration, 'the mascot image transitions').toBe('0s')

    // Removing the mascot changes neither the catalog's width nor the scroll behaviour.
    const measure = () =>
      page.evaluate(() => {
        const catalog = document.querySelector('[data-home-catalog]')
        const root = document.scrollingElement as HTMLElement
        const rect = catalog?.getBoundingClientRect()
        return {
          catalogWidth: rect?.width ?? -1,
          catalogLeft: rect?.left ?? -1,
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          scrollHeight: root.scrollHeight,
          clientHeight: root.clientHeight,
        }
      })

    const before = await measure()
    await page.evaluate(() => {
      document.querySelector('[data-home-mascot]')?.remove()
    })
    const after = await measure()

    expect(after.catalogWidth).toBeCloseTo(before.catalogWidth, 1)
    expect(after.catalogLeft).toBeCloseTo(before.catalogLeft, 1)
    expect(after.scrollWidth).toBe(before.scrollWidth)
    expect(after.scrollHeight).toBe(before.scrollHeight)
    expect(before.scrollWidth, 'the page scrolls horizontally').toBe(before.clientWidth)
  })
})

test.describe('home artwork failure', () => {
  test.describe.configure({ timeout: 180_000 })

  // Contract §6: a failed mascot and a failed seasonal image degrade to the neutral
  // placeholder with the catalog intact, and the home page never requests the reserved
  // winter asset.
  test('a failed mascot and a failed seasonal image leave the catalog intact', async ({ page }) => {
    // The card sizes while every asset loads.
    const healthy = await page.context().newPage()
    await healthy.setViewportSize({ width: 1440, height: 900 })
    await healthy.goto('/')
    await healthy.waitForSelector('[data-home-catalog] [data-game-card]')
    await expect(healthy.locator('[data-game-card]')).toHaveCount(5)
    const before = await cardBoxes(healthy)
    await healthy.close()

    const requested: string[] = []
    page.on('request', (request) => {
      requested.push(request.url())
    })
    await page.route('**/artwork/matchi-mascot.webp', (route) => route.abort())
    await page.route('**/games/match-the-series-spring-2026.webp', (route) => route.abort())

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await waitForCatalog(page)

    // The catalog is complete and its cards keep their size.
    await expect(page.locator('[data-game-card]')).toHaveCount(5)
    const after = await cardBoxes(page)
    expectEqualBoxes(after)
    expect(after[0].width).toBeCloseTo(before[0].width, 1)
    expect(after[0].height).toBeCloseTo(before[0].height, 1)

    // The failed mascot is removed instead of showing a broken-image indicator.
    await expect(page.locator('[data-mascot-image]')).toHaveCount(0)
    await expect(page.locator('[data-home-mascot]')).toHaveCount(1)

    // The failed seasonal card shows the standard neutral placeholder, at the same size
    // as its siblings.
    const blocked = page.locator('[data-game="match_the_series_spring_2026"]')
    await expect(blocked.locator('[data-art-fallback]')).toHaveCount(1)
    await expect(blocked.locator('img[data-art-image]')).toHaveCount(0)

    // No broken-image indicator appears anywhere on the page.
    const broken = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img')).filter(
        (image) => !(image.complete && image.naturalWidth > 0),
      ).length,
    )
    expect(broken, 'a broken-image indicator is showing').toBe(0)

    // A playable card still opens its game.
    const playable = page.locator('[data-state="playable"]').first()
    const game = await playable.getAttribute('data-game')
    expect(game).not.toBeNull()
    await playable.locator('[data-game-art]').click()
    await expect(page).toHaveURL(new RegExp(`/game/${game!.replace(/_/g, '-')}$`))
    await page.goBack()
    await waitForCatalog(page)

    // The request set: the mascot's failed request, the two seasonal images that were not
    // blocked and the two unchanged illustrations — and never the reserved winter asset.
    const served = (fragment: string) =>
      requested.filter((url) => url.endsWith(fragment)).length > 0

    expect(served('/artwork/matchi-mascot.webp'), 'the mascot was never requested').toBe(true)
    expect(served('/games/match-the-series-summer-2026.webp')).toBe(true)
    expect(served('/games/match-the-series-autumn-2026.webp')).toBe(true)
    expect(served('/games/more-or-less.svg')).toBe(true)
    expect(served('/games/groups.svg')).toBe(true)
    expect(served('/games/match-the-series-winter-2026.webp'), 'the winter asset was requested').toBe(
      false,
    )
  })
})

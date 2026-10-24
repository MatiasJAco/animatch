import { test, expect } from '@playwright/test'
import { GAME_IDS } from '../server/game/ids'

const VIEWPORTS = [
  { name: 'phone', width: 360, height: 640, columns: 1 },
  { name: 'tablet', width: 768, height: 1024, columns: 2 },
  { name: 'laptop', width: 1024, height: 768, columns: 3 },
  { name: 'desktop', width: 1440, height: 900, columns: 3 },
  { name: 'wide', width: 1920, height: 1080, columns: 3 },
] as const

async function waitForCatalog(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForSelector('[data-home-catalog] [data-game-card]')
  await expect(page.locator('[data-game-card]')).toHaveCount(5)
}

async function seedFinished(page: import('@playwright/test').Page, game: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 10)
  await page.addInitScript(
    ({ game, date }) => {
      localStorage.setItem(
        'animatch:v1:progress',
        JSON.stringify({ v: 1, date, games: { [game]: { status: 'won', attempts: 1 } } }),
      )
    },
    { game, date },
  )
}

async function cardBoxes(page: import('@playwright/test').Page) {
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

async function horizontalMetrics(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const root = document.scrollingElement as HTMLElement
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth }
  })
}

test('the home catalog is complete and stably ordered', async ({ page }) => {
  await page.goto('/')
  await waitForCatalog(page)

  const ids = await page
    .locator('[data-game-card]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-game')))
  expect(ids).toEqual([...GAME_IDS])

  await seedFinished(page, 'groups')
  await page.reload()
  await waitForCatalog(page)

  await expect(page.locator('[data-game="groups"]')).toHaveAttribute('data-state', 'finished')
  await expect(page.locator('[data-state="finished"]')).toHaveCount(1)
  await expect(page.locator('[data-game-card]')).toHaveCount(5)
})

test('cards are uniform and show their artwork across viewports', async ({ page }) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/')
    await waitForCatalog(page)

    await expect(page.locator('img[data-art-image]')).toHaveCount(5)
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll<HTMLImageElement>('img[data-art-image]')).every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    )

    const boxes = await cardBoxes(page)
    expectEqualBoxes(boxes)

    const columns = await page
      .locator('.game-list')
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)
    expect(columns).toBe(viewport.columns)

    const horizontal = await horizontalMetrics(page)
    expect(horizontal.scrollWidth).toBe(horizontal.clientWidth)

    if (viewport.width === 1920) {
      const vertical = await page.evaluate(() => {
        const root = document.scrollingElement as HTMLElement
        return { scrollHeight: root.scrollHeight, clientHeight: root.clientHeight }
      })
      expect(vertical.scrollHeight).toBe(vertical.clientHeight)
    }
  }
})

test('missing artwork falls back and text zoom keeps cards uniform', async ({ page }) => {
  await page.route('**/games/groups.svg', (route) =>
    route.fulfill({ status: 404, contentType: 'image/svg+xml', body: '' }),
  )
  await page.goto('/')
  await waitForCatalog(page)
  await page.waitForSelector('[data-game="groups"] [data-art-fallback]')

  const before = await cardBoxes(page)
  expectEqualBoxes(before)

  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px'
  })
  await page.waitForFunction(() => getComputedStyle(document.documentElement).fontSize === '32px')
  await page.waitForTimeout(100)

  const after = await cardBoxes(page)
  expectEqualBoxes(after)

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 360, height: 640 },
    { width: 320, height: 640 },
  ]) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(100)

    expectEqualBoxes(await cardBoxes(page))
    const contentFits = await page.locator('[data-game-card]').evaluateAll((elements) =>
      elements.every((element) => element.scrollHeight <= element.clientHeight + 1),
    )
    expect(contentFits).toBe(true)

    const horizontal = await horizontalMetrics(page)
    expect(horizontal.scrollWidth).toBe(horizontal.clientWidth)
  }
})

test('the whole playable card opens its game and no play button exists', async ({ page }) => {
  await page.goto('/')
  await waitForCatalog(page)

  const first = page.locator('[data-state="playable"]').first()
  await expect(first).toBeVisible()
  const game = await first.getAttribute('data-game')
  expect(game).not.toBeNull()
  const route = `/game/${game!.replace(/_/g, '-')}`

  await first.locator('[data-game-art]').click()
  await expect(page).toHaveURL(new RegExp(`${route}$`))

  await page.goBack()
  await waitForCatalog(page)
  const card = page.locator(`[data-game="${game}"]`)
  const box = await card.boundingBox()
  expect(box).not.toBeNull()
  await card.click({ position: { x: box!.width - 6, y: box!.height - 6 } })
  await expect(page).toHaveURL(new RegExp(`${route}$`))

  await page.goto('/')
  await waitForCatalog(page)
  await expect(page.locator('[data-game-card] .button')).toHaveCount(0)
  await expect(page.locator('[data-game-card] button')).toHaveCount(0)

  const keyboardCard = page.locator('[data-state="playable"]').first()
  await keyboardCard.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`${route}$`))

  await page.goto('/')
  await waitForCatalog(page)
  const spaceCard = page.locator('[data-state="playable"]').first()
  await spaceCard.focus()
  await page.keyboard.press(' ')
  await expect(page).toHaveURL(new RegExp(`${route}$`))
})

test('playable cards react to hover while finished cards are inert', async ({ page }) => {
  await page.goto('/')
  await waitForCatalog(page)

  const playable = page.locator('[data-state="playable"]').first()
  const playableBackground = await playable.evaluate((element) => getComputedStyle(element).backgroundColor)
  await expect
    .poll(() => playable.evaluate((element) => getComputedStyle(element).cursor))
    .toBe('pointer')

  await playable.hover()
  await expect
    .poll(() => playable.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe(playableBackground)

  await seedFinished(page, 'groups')
  await page.reload()
  await waitForCatalog(page)

  const finished = page.locator('[data-game="groups"][data-state="finished"]')
  await expect(finished).toBeVisible()
  const finishedBackground = await finished.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  )
  expect(finishedBackground).not.toBe(playableBackground)

  await finished.hover()
  await page.waitForTimeout(200)
  expect(await finished.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    finishedBackground,
  )
  expect(await finished.getAttribute('href')).toBeNull()
  expect(await finished.getAttribute('tabindex')).toBeNull()
  expect(await finished.evaluate((element) => element.tagName)).toBe('ARTICLE')
  await expect(finished.locator('a')).toHaveCount(0)

  const beforeClick = page.url()
  await finished.click({ force: true })
  await page.waitForTimeout(100)
  expect(page.url()).toBe(beforeClick)
})

test('locale switching and the 1920/320 layouts stay consistent', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  await waitForCatalog(page)

  await page.evaluate(() => {
    ;(window as Window & { __localeMarker?: string }).__localeMarker = 'kept'
  })
  await page.locator('.lang-switch button[lang="en"]').click()
  await expect(page.locator('[data-game="groups"] [data-card-name]')).toHaveText('Groups')
  expect(
    await page.evaluate(() => (window as Window & { __localeMarker?: string }).__localeMarker),
  ).toBe('kept')

  await page.locator('.lang-switch button[lang="es"]').click()
  await expect(page.locator('[data-game="groups"] [data-card-name]')).toHaveText('Grupos')
  expect(
    await page.evaluate(() => (window as Window & { __localeMarker?: string }).__localeMarker),
  ).toBe('kept')

  const desktop = await page.evaluate(() => {
    const root = document.scrollingElement as HTMLElement
    return { scrollHeight: root.scrollHeight, clientHeight: root.clientHeight }
  })
  expect(desktop.scrollHeight).toBe(desktop.clientHeight)
  await expect(page.locator('.home-reset-controls')).toBeVisible()
  await expect(page.locator('.badge time')).toBeVisible()

  await page.setViewportSize({ width: 320, height: 640 })
  await page.waitForTimeout(100)
  const phone = await horizontalMetrics(page)
  expect(phone.scrollWidth).toBe(phone.clientWidth)
})

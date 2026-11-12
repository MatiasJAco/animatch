import { test, expect, type Page } from '@playwright/test'
import { GAME_IDS } from '../server/game/ids'
import { es } from '../app/i18n/es'
import { en } from '../app/i18n/en'

/**
 * Home header geometry harness (feature 012).
 *
 * Every helper reads rendered geometry, reading order, or operability from the live page.
 * No stylesheet source text, no class-string contents, and no markup snapshots are asserted
 * anywhere in this file (contract §8, constitution VI).
 */

export interface Viewport {
  name: string
  width: number
  height: number
}

/** The tested viewport matrix (contract §2). 600x800 sits inside the locale threshold band. */
export const VIEWPORTS: Viewport[] = [
  { name: '320x640', width: 320, height: 640 },
  { name: '360x640', width: 360, height: 640 },
  { name: '600x800', width: 600, height: 800 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
]

export const LOCALES = ['es', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const TITLE_TEXT = 'Animatch'

export const TAGLINE_TEXT: Record<Locale, string> = {
  es: 'Puzzles diarios de anime',
  en: 'Daily anime puzzles',
}

/** The catalog's existing loading message, read from the message catalog. */
export const LOADING_TEXT: Record<Locale, string> = {
  es: es['common.loading'],
  en: en['common.loading'],
}

/** The alignment tolerance (spec FR-001) and the hug tolerance (contract §3). */
export const ALIGN_TOLERANCE = 2
export const HUG_TOLERANCE = 1

/**
 * The pre-change header heights, measured on this machine before the feature (T002). The
 * pre-change header was a wrapping flex row, so the control already had a row of its own at the
 * narrow widths — which is why the baseline is not one number.
 */
export const HEADER_BASELINE: Record<Locale, Record<string, number>> = {
  es: {
    '320x640': 125.98,
    '360x640': 125.98,
    '600x800': 72.8,
    '768x1024': 72.8,
    '1920x1080': 72.8,
  },
  en: {
    '320x640': 125.98,
    '360x640': 72.8,
    '600x800': 72.8,
    '768x1024': 72.8,
    '1920x1080': 72.8,
  },
}

/**
 * Whether the control shared the title's row before the change. The header-growth rule applies
 * only where it did; where the control already had a row of its own, the height must not change.
 */
export const SHARED_ROW_BEFORE: Record<Locale, Record<string, boolean>> = {
  es: {
    '320x640': false,
    '360x640': false,
    '600x800': true,
    '768x1024': true,
    '1920x1080': true,
  },
  en: {
    '320x640': false,
    '360x640': true,
    '600x800': true,
    '768x1024': true,
    '1920x1080': true,
  },
}

/**
 * The language switch's natural width at a 32 px root font (200% text zoom), measured on the
 * reference platform. The content area is narrower than this at 320x640 (288 px) and at 360x640
 * (328 px), so at both of those widths the switch's own wrapping puts its two buttons on two
 * rows, each still at its natural width with its label intact.
 */
export const SWITCH_NATURAL_WIDTH_AT_200_PERCENT = 371.83

/** A measured box in viewport coordinates. */
export interface Box {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

/** A measured text run: the rendered glyphs of one element, grouped into lines. */
export interface TextRun {
  /** Horizontal midpoint of the widest rendered line. */
  mid: number
  /** Width of the widest rendered line. */
  width: number
  /** Number of rendered lines. */
  lines: number
  /** Horizontal midpoint of every rendered line. */
  lineMids: number[]
}

/** The content area: the home element's border box minus its horizontal padding. */
export interface ContentArea {
  left: number
  right: number
  width: number
  mid: number
}

export interface ControlGeometry {
  /** The switch group's own box. */
  switchBox: Box
  /** The wrapper element that holds the switch. */
  wrapperBox: Box
  /** The two language buttons, in document order. */
  buttons: Box[]
}

/** Seeds the stored locale before the page loads (same shape as the existing e2e suites). */
export async function setLocale(page: Page, locale: Locale): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem('animatch:v1:prefs', JSON.stringify({ v: 1, language: value }))
  }, locale)
}

/** Waits until the app has applied the stored locale to the document. */
export async function waitForLocale(page: Page, locale: Locale): Promise<void> {
  await page.waitForFunction(
    (value) => document.documentElement.lang === value,
    locale,
    { timeout: 15_000 },
  )
}

/** Loads the home page in the given locale and waits for the catalog to render. */
export async function openHome(page: Page, locale: Locale): Promise<void> {
  await setLocale(page, locale)
  await page.goto('/')
  await page.waitForSelector('[data-home-catalog] [data-game-card]')
  await expect(page.locator('[data-game-card]')).toHaveCount(5)
  await waitForLocale(page, locale)
}

/**
 * The content area's horizontal band: the home element's border box minus its horizontal
 * padding. Its midpoint is the reference for every centering rule.
 */
export async function measureContentArea(page: Page): Promise<ContentArea | null> {
  return page.evaluate(() => {
    const el = document.querySelector('main.home')
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0
    const borderRight = Number.parseFloat(style.borderRightWidth) || 0
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0
    const paddingRight = Number.parseFloat(style.paddingRight) || 0
    const left = rect.left + borderLeft + paddingLeft
    const right = rect.right - borderRight - paddingRight
    return { left, right, width: right - left, mid: (left + right) / 2 }
  })
}

/**
 * The rendered text run of an element, measured with a Range over its contents. A box that is
 * centered while its text stays left-aligned measures as off-center here.
 */
export async function measureTextRun(page: Page, selector: string): Promise<TextRun | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const range = document.createRange()
    range.selectNodeContents(el)
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0)
    if (rects.length === 0) return null

    // Group the fragments into rendered lines, then keep the widest one as the run's extent.
    const lines: Array<{ top: number; left: number; right: number }> = []
    for (const rect of rects) {
      const line = lines.find((candidate) => Math.abs(candidate.top - rect.top) <= 1)
      if (line) {
        line.left = Math.min(line.left, rect.left)
        line.right = Math.max(line.right, rect.right)
      } else {
        lines.push({ top: rect.top, left: rect.left, right: rect.right })
      }
    }
    const widest = lines.reduce((a, b) => (b.right - b.left > a.right - a.left ? b : a))
    return {
      mid: (widest.left + widest.right) / 2,
      width: widest.right - widest.left,
      lines: lines.length,
      lineMids: lines.map((line) => (line.left + line.right) / 2),
    }
  }, selector)
}

/** The measured box of the first element matching a selector. */
export async function measureBox(page: Page, selector: string): Promise<Box | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
    }
  }, selector)
}

/** The title block's box: the element that holds the heading and the tagline. */
export async function measureTitleBlock(page: Page): Promise<Box | null> {
  return page.evaluate(() => {
    const heading = document.querySelector('main.home h1')
    const block = heading?.parentElement
    if (!block) return null
    const rect = block.getBoundingClientRect()
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
    }
  })
}

/** The language control: the switch group's box, its wrapper's box, and its two buttons. */
export async function measureControl(page: Page): Promise<ControlGeometry | null> {
  return page.evaluate(() => {
    const group = document.querySelector('main.home header [role="group"]')
    if (!group) return null
    const toBox = (el: Element) => {
      const rect = el.getBoundingClientRect()
      return {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      }
    }
    const wrapper = group.parentElement
    return {
      switchBox: toBox(group),
      wrapperBox: wrapper ? toBox(wrapper) : toBox(group),
      buttons: Array.from(group.querySelectorAll('button')).map(toBox),
    }
  })
}

/** The header region's box. */
export async function measureHeader(page: Page): Promise<Box | null> {
  return measureBox(page, 'main.home header')
}

/** The reset countdown badge's box: the paragraph that carries the rollover time. */
export async function measureCountdown(page: Page): Promise<Box | null> {
  return page.evaluate(() => {
    const time = document.querySelector('main.home time')
    const badge = time?.closest('p')
    if (!badge) return null
    const rect = badge.getBoundingClientRect()
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
    }
  })
}

/**
 * A language button's natural width: its own text run plus the horizontal padding and borders
 * it is given. A button that a narrower container squeezed measures less than this.
 */
export async function measureButtonNaturalWidth(
  page: Page,
  index: number,
): Promise<number | null> {
  return page.evaluate((nth) => {
    const button = document.querySelector(
      `main.home header [role="group"] button:nth-of-type(${nth})`,
    ) as HTMLElement | null
    if (!button) return null
    const style = getComputedStyle(button)
    const range = document.createRange()
    range.selectNodeContents(button)
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0)
    if (rects.length === 0) return null
    const textWidth = rects.reduce((widest, rect) => Math.max(widest, rect.right - rect.left), 0)
    return (
      textWidth +
      (Number.parseFloat(style.paddingLeft) || 0) +
      (Number.parseFloat(style.paddingRight) || 0) +
      (Number.parseFloat(style.borderLeftWidth) || 0) +
      (Number.parseFloat(style.borderRightWidth) || 0)
    )
  }, index)
}

/** The headings of the page in document order, as tag names. */
export async function measureHeadingOrder(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('main.home h1, main.home h2, main.home h3')).map(
      (el) => el.tagName.toLowerCase(),
    ),
  )
}

/** The header's own row gap, in pixels. */
export async function measureHeaderGap(page: Page): Promise<number> {
  return page.evaluate(() => {
    const header = document.querySelector('main.home header')
    if (!header) return 0
    return Number.parseFloat(getComputedStyle(header).rowGap) || 0
  })
}

/** The measured outline width of the currently focused element, in pixels. */
export async function measureActiveElementOutline(page: Page): Promise<number> {
  return page.evaluate(() => {
    const active = document.activeElement
    if (!active) return 0
    return Number.parseFloat(getComputedStyle(active).outlineWidth) || 0
  })
}

/** The horizontal scroll metrics of the document. */
export async function measureHorizontalScroll(page: Page): Promise<{
  scrollWidth: number
  clientWidth: number
}> {
  return page.evaluate(() => {
    const root = document.scrollingElement as HTMLElement
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth }
  })
}

/** Every element that reaches past the viewport's horizontal edges. */
export async function measureHorizontalOverflow(page: Page): Promise<string[]> {
  const size = page.viewportSize()
  if (!size) return []
  return page.evaluate((width) => {
    const offenders: string[] = []
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue
      if (rect.left < -1 || rect.right > width + 1) {
        const tag = el.tagName.toLowerCase()
        offenders.push(`${tag} [${Math.round(rect.left)}..${Math.round(rect.right)}]`)
      }
    }
    return offenders
  }, size.width)
}

/** The root font size the page is currently rendered with, in pixels. */
export async function measureRootFontSize(page: Page): Promise<number> {
  return page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize))
}

/** True when two vertical ranges overlap. */
export function overlaps(a: Box, b: Box): boolean {
  return Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0 &&
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0
}

/** True when the two boxes share a row, judged by their vertical ranges. */
export function sharesRow(a: Box, b: Box): boolean {
  return Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0
}

/** The title's rendered text must be centered on the content area, and must stay inside it. */
async function assertTitleCentered(page: Page, label: string): Promise<void> {
  await expect(page.locator('main.home h1'), `title text at ${label}`).toHaveText(TITLE_TEXT)

  const run = await measureTextRun(page, 'main.home h1')
  const content = await measureContentArea(page)
  expect(run, `title text run missing at ${label}`).not.toBeNull()
  expect(content, `content area missing at ${label}`).not.toBeNull()

  expect
    .soft(
      Math.abs(run!.mid - content!.mid),
      `title midpoint off center at ${label}: ${run!.mid} vs ${content!.mid}`,
    )
    .toBeLessThanOrEqual(ALIGN_TOLERANCE)

  const box = await measureBox(page, 'main.home h1')
  expect
    .soft(box!.left, `title extends past the content area's left edge at ${label}`)
    .toBeGreaterThanOrEqual(content!.left - 1)
  expect
    .soft(box!.right, `title extends past the content area's right edge at ${label}`)
    .toBeLessThanOrEqual(content!.right + 1)
}

/**
 * The tagline's placement rule, in the two forms the rendered lines select.
 *
 * One line: the tagline's box hugs its own text, so the box width equals the text run's width
 * within 1 px.
 *
 * Wrapped: a block-level box cannot hug its widest wrapped line — `fit-content` resolves to
 * `min(max-content, available)`, so once the tagline wraps its box takes the whole available
 * width — so the rule is measured on the rendered text run instead: every rendered line stays
 * centered on the title's center line, the tagline is neither clipped nor truncated, and the box
 * stays inside the content area and centered on it.
 */
async function assertTaglinePlacement(page: Page, label: string): Promise<void> {
  const titleRun = await measureTextRun(page, 'main.home h1')
  const taglineRun = await measureTextRun(page, 'main.home h1 + p')
  const taglineBox = await measureBox(page, 'main.home h1 + p')
  const content = await measureContentArea(page)
  expect(titleRun, `title text run missing at ${label}`).not.toBeNull()
  expect(taglineRun, `tagline text run missing at ${label}`).not.toBeNull()
  expect(taglineBox, `tagline box missing at ${label}`).not.toBeNull()
  expect(content, `content area missing at ${label}`).not.toBeNull()

  // The tagline never overflows its own box: it is neither clipped nor truncated.
  const clipped = await page.evaluate(() => {
    const tagline = document.querySelector('main.home h1 + p') as HTMLElement
    return {
      horizontal: tagline.scrollWidth - tagline.clientWidth,
      vertical: tagline.scrollHeight - tagline.clientHeight,
    }
  })
  expect
    .soft(clipped.horizontal, `the tagline must not be clipped at ${label}`)
    .toBeLessThanOrEqual(1)
  expect
    .soft(clipped.vertical, `the tagline must not be truncated at ${label}`)
    .toBeLessThanOrEqual(1)

  // The tagline rides on the title's own center line.
  expect
    .soft(
      Math.abs(taglineRun!.mid - titleRun!.mid),
      `the tagline must sit on the title's center line at ${label}`,
    )
    .toBeLessThanOrEqual(ALIGN_TOLERANCE)

  if (taglineRun!.lines > 1) {
    // Wrapped: the rule is measured on the rendered text run.
    for (const lineMid of taglineRun!.lineMids) {
      expect
        .soft(
          Math.abs(lineMid - titleRun!.mid),
          `every rendered tagline line must stay on the title's center line at ${label}`,
        )
        .toBeLessThanOrEqual(ALIGN_TOLERANCE)
    }
    expect
      .soft(taglineBox!.width, `the tagline must stay inside the content area at ${label}`)
      .toBeLessThanOrEqual(content!.width + 1)
    expect
      .soft(
        Math.abs((taglineBox!.left + taglineBox!.right) / 2 - content!.mid),
        `the tagline box must stay centered at ${label}`,
      )
      .toBeLessThanOrEqual(ALIGN_TOLERANCE)
  } else {
    // One line: the box hugs its own text.
    expect
      .soft(
        Math.abs(taglineBox!.width - taglineRun!.width),
        `the tagline box must hug its text at ${label}`,
      )
      .toBeLessThanOrEqual(HUG_TOLERANCE)
  }
}

/**
 * Whether the control shares the title's row or has a row of its own, per locale and width.
 * The thresholds are the contract's: 38 em for Spanish and 35 em for English, measured against
 * the content area. 600x800 is inside that band, so the two locales differ there.
 */
export const CONTROL_ROW: Record<Locale, Record<string, 'shared' | 'stacked'>> = {
  es: {
    '320x640': 'stacked',
    '360x640': 'stacked',
    '600x800': 'stacked',
    '768x1024': 'shared',
    '1024x768': 'shared',
    '1440x900': 'shared',
    '1920x1080': 'shared',
  },
  en: {
    '320x640': 'stacked',
    '360x640': 'stacked',
    '600x800': 'shared',
    '768x1024': 'shared',
    '1024x768': 'shared',
    '1440x900': 'shared',
    '1920x1080': 'shared',
  },
}

test.describe('centered home header', () => {
  test.describe.configure({ timeout: 240_000 })

  // US1: the rendered title text is centered on the content area at every tested width in
  // both locales, and stays centered while the window is resized without a reload.
  test('the title text is centered on the content area at every width in both locales', async ({
    page,
  }) => {
    for (const locale of LOCALES) {
      await setLocale(page, locale)
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.goto('/')
        await page.waitForSelector('[data-home-catalog] [data-game-card]')
        await waitForLocale(page, locale)
        await assertTitleCentered(page, `${viewport.name}/${locale}`)

        // The page never scrolls sideways and nothing reaches past the viewport's edges, at
        // every width from 320 to 1920 pixels, in both languages.
        const scroll = await measureHorizontalScroll(page)
        expect
          .soft(scroll.scrollWidth, `the page must not scroll sideways at ${viewport.name}/${locale}`)
          .toBe(scroll.clientWidth)
        expect
          .soft(
            await measureHorizontalOverflow(page),
            `nothing may reach past the viewport at ${viewport.name}/${locale}`,
          )
          .toEqual([])
      }
    }

    // The title re-centers at the new width when the window is resized in place.
    await setLocale(page, 'es')
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    await page.waitForSelector('[data-home-catalog] [data-game-card]')
    await waitForLocale(page, 'es')
    for (const width of [1440, 1024, 768, 600, 360, 320]) {
      await page.setViewportSize({ width, height: 900 })
      await assertTitleCentered(page, `resized to ${width}`)
    }
  })

  // US2: the tagline is the element immediately below the title, it rides on the title's own
  // center line, and its box hugs its own text.
  test('the tagline rides on the title center line and hugs its own text', async ({ page }) => {
    for (const locale of LOCALES) {
      await setLocale(page, locale)
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.goto('/')
        await page.waitForSelector('[data-home-catalog] [data-game-card]')
        await waitForLocale(page, locale)
        const label = `${viewport.name}/${locale}`

        const relation = await page.evaluate(() => {
          const heading = document.querySelector('main.home h1')
          const next = heading?.nextElementSibling ?? null
          return {
            tag: next?.tagName.toLowerCase() ?? null,
            text: next?.textContent?.trim() ?? null,
            sameParent: Boolean(next) && next!.parentElement === heading!.parentElement,
          }
        })
        expect.soft(relation.tag, `the tagline must follow the title directly at ${label}`).toBe('p')
        expect.soft(relation.sameParent, `the tagline must share the title's block at ${label}`).toBe(true)
        expect
          .soft(relation.text, `unexpected tagline text at ${label}`)
          .toBe(TAGLINE_TEXT[locale])

        await assertTaglinePlacement(page, label)
      }
    }
  })

  // US3: the control stays visible, inside the content area, flush with its right edge, never
  // overlapping the title block, and keeps its natural width. It has a row of its own only
  // below the active locale's stacking threshold.
  test('the language control keeps its place at the content area top-right', async ({ page }) => {
    for (const locale of LOCALES) {
      await setLocale(page, locale)
      const widths: number[] = []

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.goto('/')
        await page.waitForSelector('[data-home-catalog] [data-game-card]')
        await waitForLocale(page, locale)
        const label = `${viewport.name}/${locale}`

        const content = await measureContentArea(page)
        const control = await measureControl(page)
        const block = await measureTitleBlock(page)
        expect(content, `content area missing at ${label}`).not.toBeNull()
        expect(control, `language control missing at ${label}`).not.toBeNull()
        expect(block, `title block missing at ${label}`).not.toBeNull()

        // Visible and fully inside the content area.
        expect.soft(control!.switchBox.width, `the control must be visible at ${label}`).toBeGreaterThan(0)
        expect
          .soft(control!.switchBox.left, `the control must stay inside the content area at ${label}`)
          .toBeGreaterThanOrEqual(content!.left - 1)
        expect
          .soft(control!.switchBox.right, `the control must stay inside the content area at ${label}`)
          .toBeLessThanOrEqual(content!.right + 1)

        // Flush with the content area's right edge, in both row states.
        expect
          .soft(
            Math.abs(content!.right - control!.switchBox.right),
            `the control must be flush right at ${label}`,
          )
          .toBeLessThanOrEqual(1)

        // Never intersects the title block.
        expect.soft(overlaps(control!.switchBox, block!), `the control must not overlap the title at ${label}`).toBe(false)

        // Both buttons on one row, neither label wrapped.
        expect.soft(control!.buttons, `the control must keep its two buttons at ${label}`).toHaveLength(2)
        expect
          .soft(
            sharesRow(control!.buttons[0], control!.buttons[1]),
            `both language buttons must sit on one row at ${label}`,
          )
          .toBe(true)
        for (const index of [1, 2]) {
          const run = await measureTextRun(page, `main.home header [role="group"] button:nth-of-type(${index})`)
          expect(run, `the language label is missing at ${label}`).not.toBeNull()
          expect.soft(run!.lines, `the language label must not wrap at ${label}`).toBe(1)
        }

        // The control keeps its natural width: it does not shrink as the viewport narrows.
        widths.push(control!.switchBox.width)

        // The row state follows the locale's stacking threshold.
        const expected = CONTROL_ROW[locale][viewport.name]
        const sharesTitleRow = sharesRow(control!.switchBox, block!)
        expect
          .soft(
            sharesTitleRow,
            `the control must be ${expected === 'shared' ? 'on' : 'below'} the title's row at ${label}`,
          )
          .toBe(expected === 'shared')
      }

      const natural = widths[0]
      for (const [index, width] of widths.entries()) {
        expect
          .soft(
            Math.abs(width - natural),
            `the control must keep its natural width at ${VIEWPORTS[index].name}/${locale}`,
          )
          .toBeLessThanOrEqual(1)
      }
    }
  })

  // US3: the title stays the first and only heading, the control is reachable and operable
  // with the keyboard, and the title's centering survives a locale switch and a hover.
  test('the title keeps the reading order and the control stays keyboard operable', async ({
    page,
  }) => {
    await setLocale(page, 'es')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForSelector('[data-home-catalog] [data-game-card]')
    await waitForLocale(page, 'es')

    const headings = await measureHeadingOrder(page)
    expect(headings[0], 'the title must be the first heading in reading order').toBe('h1')
    expect(
      headings.filter((tag) => tag === 'h1'),
      'the page must have exactly one main heading',
    ).toHaveLength(1)

    // Tab reaches the language control, and it shows a visible focus indicator.
    let reachedControl = false
    for (let attempt = 0; attempt < 6 && !reachedControl; attempt += 1) {
      await page.keyboard.press('Tab')
      reachedControl = await page.evaluate(() =>
        Boolean(document.activeElement?.closest('main.home header [role="group"]')),
      )
    }
    expect(reachedControl, 'the language control must be reachable with the keyboard').toBe(true)
    expect(
      await measureActiveElementOutline(page),
      'the focused control must show a visible focus indicator',
    ).toBeGreaterThan(0)

    // Enter on the English button switches the locale.
    let reachedEnglish = false
    for (let attempt = 0; attempt < 4 && !reachedEnglish; attempt += 1) {
      await page.keyboard.press('Tab')
      reachedEnglish = await page.evaluate(
        () => document.activeElement?.getAttribute('lang') === 'en',
      )
    }
    expect(reachedEnglish, 'the English button must be reachable with the keyboard').toBe(true)
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.documentElement.lang === 'en', undefined, {
      timeout: 15_000,
    })
    expect(await page.locator('main.home h1').textContent()).toBe(TITLE_TEXT)

    // The heading order and the centering are unaffected by the locale switch.
    expect(await measureHeadingOrder(page), 'the heading order must not change').toEqual(headings)
    await assertTitleCentered(page, 'after the locale switch')

    // Hovering the control does not move the title.
    const before = await measureTextRun(page, 'main.home h1')
    await page.locator('main.home header [role="group"] button').first().hover()
    await page.waitForTimeout(150)
    const after = await measureTextRun(page, 'main.home h1')
    expect(
      Math.abs(after!.mid - before!.mid),
      'hovering the control must not move the title',
    ).toBeLessThanOrEqual(1)
  })

  // US4: the header grows only by what the stacking requires, and the rest of the page keeps
  // its catalog, its countdown, its loading message, and its retryable failure state.
  test('the header grows only by the stacking and nothing else on the page changes', async ({
    page,
  }) => {
    const baselineWidths = ['320x640', '360x640', '600x800', '768x1024', '1920x1080']

    for (const locale of LOCALES) {
      await setLocale(page, locale)
      for (const name of baselineWidths) {
        const viewport = VIEWPORTS.find((entry) => entry.name === name)!
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.goto('/')
        await page.waitForSelector('[data-home-catalog] [data-game-card]')
        await waitForLocale(page, locale)
        const label = `${name}/${locale}`

        const header = await measureHeader(page)
        const control = await measureControl(page)
        const block = await measureTitleBlock(page)
        const countdown = await measureCountdown(page)
        const gap = await measureHeaderGap(page)
        expect(header, `the header is missing at ${label}`).not.toBeNull()
        expect(control, `the control is missing at ${label}`).not.toBeNull()
        expect(block, `the title block is missing at ${label}`).not.toBeNull()
        expect(countdown, `the countdown is missing at ${label}`).not.toBeNull()

        const baseline = HEADER_BASELINE[locale][name]
        const growth = header!.height - baseline
        const stackedNow = !sharesRow(control!.switchBox, block!)
        const allowance = control!.switchBox.height + gap

        if (SHARED_ROW_BEFORE[locale][name]) {
          // The control shared the title's row before, so the header may grow by exactly the
          // control's height plus the header gap — and by no more.
          expect
            .soft(growth, `the header must not grow by more than the stacking requires at ${label}`)
            .toBeLessThanOrEqual(allowance + 1)
          if (stackedNow) {
            expect
              .soft(
                Math.abs(growth - allowance),
                `the header must grow by exactly the stacking at ${label}`,
              )
              .toBeLessThanOrEqual(1)
          } else {
            expect
              .soft(Math.abs(growth), `the header must not grow at ${label}`)
              .toBeLessThanOrEqual(1)
          }
        } else {
          // The control already had a row of its own, so the height must not change at all.
          expect
            .soft(Math.abs(growth), `the header must not change height at ${label}`)
            .toBeLessThanOrEqual(1)
        }

        // The countdown flows immediately after the header.
        expect
          .soft(
            Math.abs(countdown!.top - header!.bottom),
            `the countdown must follow the header at ${label}`,
          )
          .toBeLessThanOrEqual(1)

        if (name === '1920x1080') {
          expect
            .soft(
              Math.abs(header!.height - block!.height),
              `the header must be a single row at ${label}`,
            )
            .toBeLessThanOrEqual(1)
        }
      }
    }

    // The catalog still lists the five games in the unchanged order.
    await setLocale(page, 'es')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForSelector('[data-home-catalog] [data-game-card]')
    await waitForLocale(page, 'es')

    const ids = await page
      .locator('[data-game-card]')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-game')))
    expect(ids).toEqual([...GAME_IDS])

    const states = await page
      .locator('[data-game-card]')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-state')))
    expect(states.every((state) => state !== null && state.length > 0)).toBe(true)

    // The finished marker still shows for a game finished on this device.
    await page.addInitScript(() => {
      const date = new Date().toISOString().slice(0, 10)
      localStorage.setItem(
        'animatch:v1:progress',
        JSON.stringify({ v: 1, date, games: { groups: { status: 'won', attempts: 1 } } }),
      )
    })
    await page.reload()
    await page.waitForSelector('[data-home-catalog] [data-game-card]')
    await expect(page.locator('[data-game="groups"]')).toHaveAttribute('data-state', 'finished')
    await expect(page.locator('[data-state="finished"]')).toHaveCount(1)
    await expect(page.locator('[data-game-card]')).toHaveCount(5)

    // The countdown still shows and rolls over.
    const beforeTick = await page.locator('main.home time').textContent()
    await page.waitForTimeout(1_300)
    const afterTick = await page.locator('main.home time').textContent()
    expect(afterTick).not.toBe(beforeTick)

    // A listing that has not arrived shows the loading message and no empty catalog.
    await page.goto('/game/groups')
    await page.waitForSelector('.grid-4x4 .tile')
    await page.route('**/api/daily', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
    )
    await page.locator('a[href="/"]').first().click()
    await expect(page.locator('main.home')).toBeVisible()
    await expect(page.locator('main.home p', { hasText: LOADING_TEXT.es })).toBeVisible()
    await expect(page.locator('[data-game-card]')).toHaveCount(0)
    await expect(page.locator('main.home section[role="alert"]')).toHaveCount(0)
    await page.unroute('**/api/daily')

    // A failed listing renders the retryable error panel with its retry action.
    await page.goto('/game/groups')
    await page.waitForSelector('.grid-4x4 .tile')
    await page.route('**/api/daily', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
    )
    await page.locator('a[href="/"]').first().click()
    const alert = page.locator('main.home section[role="alert"]')
    await expect(alert).toBeVisible()
    await expect(alert.locator('button')).toHaveCount(1)
    await expect(alert.locator('button')).toBeEnabled()
    await expect(page.locator('[data-game-card]')).toHaveCount(0)
    await page.unroute('**/api/daily')
  })

  // US4: at 200% text zoom the header keeps its centering, nothing reaches past the viewport's
  // edges, and the control stays fully inside the content area and operable — including the
  // one case where the content area is narrower than the control.
  test('200% text zoom keeps the header centered, inside the viewport and operable', async ({
    page,
  }) => {
    const zoomed = VIEWPORTS.filter((viewport) =>
      ['320x640', '360x640', '768x1024', '1920x1080'].includes(viewport.name),
    )

    for (const locale of LOCALES) {
      await setLocale(page, locale)
      for (const viewport of zoomed) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.goto('/')
        await page.waitForSelector('[data-home-catalog] [data-game-card]')
        await waitForLocale(page, locale)
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '32px'
        })
        await page.waitForFunction(() => getComputedStyle(document.documentElement).fontSize === '32px')
        const label = `200% ${viewport.name}/${locale}`

        // No horizontal scrolling, and nothing reaches past the viewport's edges.
        const scroll = await measureHorizontalScroll(page)
        expect
          .soft(scroll.scrollWidth, `the page must not scroll sideways at ${label}`)
          .toBe(scroll.clientWidth)
        expect
          .soft(await measureHorizontalOverflow(page), `nothing may reach past the viewport at ${label}`)
          .toEqual([])

        // The title and the tagline stay on the content area's center line.
        const content = await measureContentArea(page)
        const titleRun = await measureTextRun(page, 'main.home h1')
        expect(content, `the content area is missing at ${label}`).not.toBeNull()
        expect(titleRun, `the title text run is missing at ${label}`).not.toBeNull()
        expect
          .soft(
            Math.abs(titleRun!.mid - content!.mid),
            `the title must stay centered at ${label}`,
          )
          .toBeLessThanOrEqual(ALIGN_TOLERANCE)

        await assertTaglinePlacement(page, label)

        // The control stays fully inside the content area, flush right, and complete.
        const control = await measureControl(page)
        expect(control, `the control is missing at ${label}`).not.toBeNull()
        expect
          .soft(control!.switchBox.left, `the control must stay inside the content area at ${label}`)
          .toBeGreaterThanOrEqual(content!.left - 1)
        expect
          .soft(control!.switchBox.right, `the control must stay inside the content area at ${label}`)
          .toBeLessThanOrEqual(content!.right + 1)
        expect
          .soft(
            Math.abs(content!.right - control!.switchBox.right),
            `the control must stay flush right at ${label}`,
          )
          .toBeLessThanOrEqual(1)
        expect.soft(control!.buttons, `the control must keep its two buttons at ${label}`).toHaveLength(2)

        if (content!.width < SWITCH_NATURAL_WIDTH_AT_200_PERCENT) {
          // The content area is narrower than the switch's natural width (288 px at 320x640,
          // 328 px at 360x640): no layout can keep both buttons on one row there, so the
          // switch's own wrapping puts them on two rows, each still at its natural width with
          // its label intact.
          expect
            .soft(
              sharesRow(control!.buttons[0], control!.buttons[1]),
              `the buttons must fall onto two rows at ${label}`,
            )
            .toBe(false)
          for (const index of [1, 2]) {
            const run = await measureTextRun(
              page,
              `main.home header [role="group"] button:nth-of-type(${index})`,
            )
            expect(run, `the language label is missing at ${label}`).not.toBeNull()
            expect.soft(run!.lines, `the language label must stay intact at ${label}`).toBe(1)
            const natural = await measureButtonNaturalWidth(page, index)
            expect(natural, `the language button's natural width is missing at ${label}`).not.toBeNull()
            expect
              .soft(
                Math.abs(control!.buttons[index - 1].width - natural!),
                `the language button must keep its natural width at ${label}`,
              )
              .toBeLessThanOrEqual(1)
          }
        }

        // The control is still operable with a pointer.
        const other = locale === 'es' ? 'en' : 'es'
        await page.locator(`main.home header [role="group"] button[lang="${other}"]`).click()
        await page.waitForFunction((value) => document.documentElement.lang === value, other, {
          timeout: 15_000,
        })
        await page.locator(`main.home header [role="group"] button[lang="${locale}"]`).click()
        await page.waitForFunction((value) => document.documentElement.lang === value, locale, {
          timeout: 15_000,
        })
      }
    }
  })
})

/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')
const { compareChatButtonScope } = require('./chat-button-scope')
const { createChatButtonProbe, expectProbeTheme, expectChatButtonsPaint, expectButtonPaint, restoreChatButtonProbe } = require('./chat-card-buttons.helpers')

const test = createSessionTest()
const TRANSPARENT = 'rgba(0, 0, 0, 0)'
const THEMES = {
  light: { text: 'rgb(34, 34, 34)', border: 'rgb(122, 121, 113)', muted: 'rgb(102, 102, 102)' },
  dark: { text: 'rgb(208, 190, 170)', border: 'rgb(107, 106, 117)', muted: 'rgb(138, 137, 147)' }
}
const cases = Object.keys(THEMES).flatMap(applications => Object.keys(THEMES).flatMap(interfaceTheme =>
  [false, true].map(useUi => ({ applications, interfaceTheme, useUi }))))
const normalPaint = ({ text, border }) => ({
  color: text,
  background: 'rgba(0, 0, 0, 0.1)',
  border: `solid 1px ${border}`,
  opacity: '1',
  translucentAncestors: [],
  disabled: false,
  classDisabled: false,
  hovered: false
})
const clickedPaint = paint => ({ ...paint, classDisabled: true, pointerEvents: 'none', opacity: '0.5' })
const buttonsFor = (page, s) => page.locator(`#chat [data-message-id="${s.id}"] .message-content`).locator(s.selector)

function expectContrast (measured, scheme, name, state) {
  const label = `${scheme} ${name} ${measured.label} ${state}: ${JSON.stringify(measured)}`
  expect(measured.contrast, label).toBeGreaterThanOrEqual(4.5)
  expect(measured.approximateImage, label).toBe(scheme === 'light')
  if (scheme === 'dark') expect(measured.cardBackground, label).toEqual({ r: 11, g: 10, b: 19, a: 1 })
}

// Pin the element through rerenders and always restore native state and paint.
async function withDisabled (handle, scheme, normal, muted, checkHover = async () => {}) {
  const original = await handle.evaluate(el => el.disabled)
  try {
    await handle.evaluate(el => { el.blur(); el.disabled = true })
    const disabled = await expectButtonPaint(handle, scheme, { ...normal, color: muted, disabled: true }, false)
    await checkHover(disabled)
    return disabled
  } finally {
    await handle.evaluate((el, disabled) => { el.disabled = disabled }, original)
    await expectButtonPaint(handle, scheme, { ...normal, disabled: original }, false)
  }
}

async function expectCleanup (page) {
  expect(await restoreChatButtonProbe(page), 'owned messages removed and original config/body class restored').toEqual({
    remaining: [], nodesRemoved: true, configRestored: true, classRestored: true
  })
}

test.describe('Chat card buttons', () => {
  test.afterEach(async ({ page }) => { await restoreChatButtonProbe(page) })
  for (const [scheme, theme] of Object.entries(THEMES)) {
    test(`chat card buttons interactions ${scheme}`, async ({ page }) => {
      test.setTimeout(120000)
      const paint = normalPaint(theme)
      const states = []
      const focusStates = []
      try {
        await page.mouse.move(0, 0)
        const probe = await createChatButtonProbe(page, { applications: scheme, interfaceTheme: scheme, useUi: false })
        for (const s of probe.active) {
          const buttons = buttonsFor(page, s)
          await expect(buttons, s.name).toHaveCount(s.count)
          for (let index = 0; index < s.count; index++) {
            const button = buttons.nth(index)
            if (index === 0) await button.scrollIntoViewIfNeeded()
            const handle = await button.elementHandle()
            try {
              await page.mouse.move(0, 0)
              const normal = await expectButtonPaint(handle, scheme, paint)
              await button.hover()
              const hover = await expectButtonPaint(handle, scheme, { ...paint, background: TRANSPARENT, border: `solid 1px ${theme.text}`, hovered: true })
              expectContrast(normal, scheme, s.name, 'normal')
              expectContrast(hover, scheme, s.name, 'hover')
              states.push(s.name)
              if (index === 0 && probe.representatives.includes(s)) {
                await page.mouse.move(0, 0)
                await button.focus()
                const focus = await expectButtonPaint(handle, scheme, { color: theme.text, focused: true, hovered: false, opacity: '1', translucentAncestors: [] }, false)
                expect(focus.outline.style, `${s.name} visible core focus outline`).not.toBe('none')
                expect(parseFloat(focus.outline.width), `${s.name} focus outline width`).toBeGreaterThan(0)
                expect(focus.outline.color, `${s.name} focus outline paint`).not.toBe(TRANSPARENT)
                await withDisabled(handle, scheme, paint, theme.muted, async disabled => {
                  try {
                    await button.hover()
                    await expectButtonPaint(handle, scheme, { ...paint, color: theme.muted, background: disabled.background, border: disabled.border, disabled: true, hovered: true }, false)
                  } finally { await page.mouse.move(0, 0) }
                })
                focusStates.push({ name: s.name, outline: focus.outline })
              }
            } finally { await handle.dispose() }
          }
        }
        expect(states, 'all eight active buttons hover in each theme').toHaveLength(8)
        expect(focusStates, 'Enhanced and Death focus/native-disabled hover').toHaveLength(2)
        await page.mouse.move(0, 0)
        for (const s of probe.inactive) await expect(buttonsFor(page, s), s.name).toHaveCount(s.count)
        const inactive = await expectChatButtonsPaint(page, probe.inactive, scheme, clickedPaint(paint), false)
        expect(inactive, 'six actual non-GM clicked buttons').toHaveLength(6)
        const core = buttonsFor(page, probe.generic).first()
        await core.scrollIntoViewIfNeeded()
        await core.focus()
        const coreFocus = await expectButtonPaint(core, scheme, { focused: true, hovered: false }, false)
        for (const s of focusStates) expect(s.outline, `${s.name} retained core focus outline`).toEqual(coreFocus.outline)
        await core.evaluate(el => el.blur())
      } finally { await expectCleanup(page) }
    })
  }
  for (const config of cases) {
    const { applications, interfaceTheme, useUi } = config
    test(`chat card buttons apps=${applications} interface=${interfaceTheme} useUi=${useUi}`, async ({ page }) => {
      const scheme = useUi ? interfaceTheme : applications
      const theme = THEMES[scheme]
      const paint = normalPaint(theme)
      try {
        await page.mouse.move(0, 0)
        const probe = await createChatButtonProbe(page, config)
        await expectProbeTheme(page, probe.specimens, { ...config, text: theme.text })
        await expect.poll(() => page.evaluate(({ active, text }) => active.every(s =>
          [...document.querySelectorAll(`#chat-notifications [data-message-id="${s.id}"] .message-content ${s.selector}`)]
            .every(el => getComputedStyle(el).color === text && !el.getAnimations().some(a => a.playState === 'running'))),
        { active: probe.active, text: theme.text }), { message: 'optional notification copies retain settled theme color' }).toBe(true)
        await expectChatButtonsPaint(page, probe.active, scheme, paint, false)
        const result = await page.evaluate(compareChatButtonScope, probe.specimens)
        for (const s of probe.specimens.filter(s => !probe.inactive.includes(s))) {
          expect(result.targets[s.name] || result.enabled[s.name], `${s.name} count`).toHaveLength(s.count)
        }
        expect(result.enabled, 'Release Notes/icons, deed, Plain Card and scope controls retain paint').toEqual(result.disabled)
        expect(result.mutationCount, 'implemented button paint was actually disabled').toBeGreaterThan(0)
        // CSSOM comparison triggers target transitions; audit only after settling.
        const normal = await expectChatButtonsPaint(page, probe.active, scheme, paint)
        expect(normal, 'all active labels/layouts').toHaveLength(8)
        for (const measured of normal) expectContrast(measured, scheme, 'active', 'normal')
        const nativeDisabled = []
        for (const s of probe.representatives) {
          const handle = await buttonsFor(page, s).first().elementHandle()
          try { nativeDisabled.push(await withDisabled(handle, scheme, paint, theme.muted)) } finally { await handle.dispose() }
        }
        expect(nativeDisabled, 'Enhanced and Death native disabled').toHaveLength(2)
        for (const s of probe.inactive) await expect(buttonsFor(page, s), s.name).toHaveCount(s.count)
        const inactive = await expectChatButtonsPaint(page, probe.inactive, scheme, clickedPaint(paint), false)
        expect(inactive, 'six actual non-GM clicked buttons').toHaveLength(6)
      } finally { await expectCleanup(page) }
    })
  }
})

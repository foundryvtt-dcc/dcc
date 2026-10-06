/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Chat-card contrast sweep (#1003, follow-up to #856 / #948 / #950).
 *
 * The earlier theme specs pinned the colors of the specific elements each
 * issue named, so every round fixed what was reported and the next unlisted
 * element (buttons, this time) shipped dark-on-dark. This spec instead posts a
 * gallery of every DCC chat card that carries controls, renders it under each
 * theme the chat cards can follow, and holds EVERYTHING visible in it to WCAG:
 *
 * - SC 1.4.3 text contrast for every visible text node (4.5:1, 3:1 if large),
 *   measured against the color actually painted behind it: translucent layers
 *   (button fills, row highlights) are composited down to the card, and the
 *   light card's parchment image is sampled from the real file.
 * - SC 1.4.11 non-text contrast (3:1) for every control's boundary — its border
 *   or its fill, whichever stands out more from the card.
 * - Both again with each enabled button hovered.
 *
 * Every card is also screenshotted per theme and attached to the report, so a
 * reviewer can SEE the gallery (`pnpm exec playwright show-report`) instead of
 * trusting numbers alone.
 *
 * Adding a new chat card with buttons or links? Add it to `postGallery` — the
 * assertions are generic and need no per-card expectations.
 */
const test = createSessionTest()

// The theme the cards follow is the app theme, or the interface theme under
// `chat-cards-use-ui-theme` (styles/variables.css). The mixed cases are where
// a token that follows the wrong theme shows up.
const THEME_CASES = [
  { name: 'light', applications: 'light', interface: 'light', useUi: false, scheme: 'light' },
  { name: 'dark', applications: 'dark', interface: 'dark', useUi: false, scheme: 'dark' },
  { name: 'ui-dark over app-light', applications: 'light', interface: 'dark', useUi: true, scheme: 'dark' },
  { name: 'ui-light over app-dark', applications: 'dark', interface: 'light', useUi: true, scheme: 'light' }
]

const DARK_CARD = 'rgb(11, 10, 19)' // #0b0a13 — --chat-background, dark

/** Post one message per gallery card. Returns [{ name, id }]. */
async function postGallery (page) {
  return page.evaluate(async () => {
    const render = (name, context) =>
      foundry.applications.handlebars.renderTemplate(`systems/dcc/templates/${name}.html`, context)
    const dice = await (await new Roll('1d20 + 2').evaluate()).render()
    const crit = await new Roll('1d4').evaluate()
    const damage = await new Roll('1d8 + 1').evaluate()
    const enhanced = {
      canUserModify: true,
      isGM: true,
      flavorText: 'Attack with Longsword',
      weaponName: 'Longsword',
      isPC: true,
      weaponImg: 'icons/svg/sword.svg',
      diceHTML: dice,
      damageRollFormula: '1d8+1',
      showHitMiss: true,
      hitsAc: 14,
      properties: ['Melee', 'Two-handed']
    }
    const { buildRollRequestContent } = await import(foundry.utils.getRoute('systems/dcc/module/roll-request.mjs'))
    const actor = game.actors.find(a => a.type === 'Player') ?? { name: 'Probe' }
    const cards = [
      ['enhanced-crit', await render('chat-card-attack-enhanced', { ...enhanced, isCrit: true })],
      ['enhanced-compact-fumble', await render('chat-card-attack-enhanced', { ...enhanced, compact: true, isFumble: true })],
      ['enhanced-automated', await render('chat-card-attack-enhanced', {
        ...enhanced,
        automated: true,
        isCrit: true,
        damagePrompt: 'Damage',
        damageInlineRoll: damage.toAnchor().outerHTML,
        critInlineRoll: crit.toAnchor().outerHTML,
        critResult: 'A crushing blow staggers the foe.',
        critTableName: 'Crit Table III',
        critRollTotal: crit.total,
        twoWeaponNote: 'Two-weapon fighting: primary hand'
      })],
      ['enhanced-deed', await render('chat-card-attack-enhanced', {
        ...enhanced,
        deedDieRollResult: 4,
        deedRollSuccess: true,
        deedPromptHTML: game.dcc.buildMightyDeedPrompt({
          system: { deedDieRollResult: 4, deedTables: [{ path: 'probe', name: 'Blinding Attacks' }] }
        })
      })],
      ['plain-attack', await render('chat-card-attack-result', {
        message: { system: { damagePrompt: 'Damage', damageInlineRoll: damage.toAnchor().outerHTML } }
      })],
      // Markup from death-clock.mjs postDeathClockCard (not exported).
      ...['rollTheBody', 'rollAbilityLoss'].map(action => [`death-${action}`,
        game.i18n.format('DCC.DeathClockExpired', { name: 'Probe' }) +
        `<div class="dcc-death-clock-actions"><button type="button" data-action="${action}" data-actor-uuid="">` +
        `${game.i18n.localize(action === 'rollTheBody' ? 'DCC.RollTheBody' : 'DCC.RollAbilityLoss')}</button></div>`]),
      ['release-notes', await render('chat-card-release-notes', { message: '' })],
      ['roll-request', buildRollRequestContent([{ actor, source: '[[/check str]]' }])],
      ['roll-request-multi', buildRollRequestContent([
        { actor, source: '[[/check agl]]' },
        { actor: { name: 'Second Probe' }, source: '[[/save ref]]' }
      ])]
    ]
    const posted = []
    for (const [name, content] of cards) {
      const msg = await ChatMessage.create({ content, flags: { dcc: { contrastGallery: name } } })
      posted.push({ name, id: msg.id })
    }
    return posted
  })
}

async function removeGallery (page) {
  await page.evaluate(async () => {
    const ids = game.messages.filter(m => m.getFlag('dcc', 'contrastGallery')).map(m => m.id)
    if (ids.length) await ChatMessage.deleteDocuments(ids)
  }).catch(() => {})
}

/** Apply a theme case and wait until the gallery has actually repainted. */
async function applyTheme (page, themeCase, ids) {
  await page.evaluate(async ({ applications, interface: interfaceTheme, useUi }) => {
    const cfg = game.settings.get('core', 'uiConfig')
    globalThis.__dccSavedUiConfig ??= cfg
    globalThis.__dccSavedUseUiClass ??= document.body.classList.contains('chat-cards-use-ui-theme')
    document.body.classList.toggle('chat-cards-use-ui-theme', useUi)
    await game.settings.set('core', 'uiConfig', {
      ...cfg,
      colorScheme: { ...(cfg.colorScheme || {}), applications, interface: interfaceTheme }
    })
    ui.sidebar.changeTab('chat', 'primary')
    ui.sidebar.expand?.()
  }, themeCase)
  await expect.poll(() => page.evaluate(({ themeCase, ids, darkCard }) => {
    if (!document.body.classList.contains(`theme-${themeCase.applications}`)) return 'body theme'
    if (!document.getElementById('interface')?.classList.contains(`theme-${themeCase.interface}`)) return 'interface theme'
    for (const id of ids) {
      const msg = document.querySelector(`#chat .chat-log [data-message-id="${id}"]`)
      if (!msg) return `message ${id} not rendered`
      const cs = getComputedStyle(msg)
      const painted = themeCase.scheme === 'dark'
        ? cs.backgroundColor === darkCard && cs.backgroundImage === 'none'
        : cs.backgroundImage.includes('parchment')
      if (!painted) return `message ${id} card background`
      // Settle theme transitions now rather than racing them.
      for (const el of [msg, ...msg.querySelectorAll('*')]) for (const a of el.getAnimations()) a.finish()
    }
    return 'ok'
  }, { themeCase, ids, darkCard: DARK_CARD }), { message: `theme ${themeCase.name} applied`, timeout: 10000 }).toBe('ok')
}

async function restoreTheme (page) {
  await page.evaluate(async () => {
    if (typeof globalThis.__dccSavedUseUiClass === 'boolean') {
      document.body.classList.toggle('chat-cards-use-ui-theme', globalThis.__dccSavedUseUiClass)
      delete globalThis.__dccSavedUseUiClass
    }
    const saved = globalThis.__dccSavedUiConfig
    if (saved) {
      await game.settings.set('core', 'uiConfig', saved)
      delete globalThis.__dccSavedUiConfig
    }
  }).catch(() => {})
}

/**
 * Page-side WCAG audit of the gallery messages. Returns { flags, counts }.
 * `onlySelector` narrows the audit to matching elements (the hovered button).
 */
async function auditGallery (page, ids, onlySelector = null) {
  return page.evaluate(async ({ ids, onlySelector }) => {
    const parse = value => {
      const m = /rgba?\(([^)]+)\)/.exec(value)
      if (!m) return null
      const [r, g, b, a = 1] = m[1].trim().split(/[,\s/]+/).map(Number)
      return { r, g, b, a }
    }
    const over = (front, back) => ({
      r: front.r * front.a + back.r * (1 - front.a),
      g: front.g * front.a + back.g * (1 - front.a),
      b: front.b * front.a + back.b * (1 - front.a),
      a: 1
    })
    const channel = v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    const lum = c => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)
    const ratio = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
      return Math.round((hi + 0.05) / (lo + 0.05) * 100) / 100
    }

    // Mean color of a background image, sampled from the real file.
    const imageCache = globalThis.__dccImageMeans ??= {}
    const imageMean = async url => {
      if (!imageCache[url]) {
        const img = new Image()
        img.src = url
        await img.decode()
        const canvas = document.createElement('canvas')
        canvas.width = 64
        canvas.height = 64
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, 64, 64)
        const data = ctx.getImageData(0, 0, 64, 64).data
        const sum = [0, 0, 0]
        for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += data[i + c]
        const n = data.length / 4
        imageCache[url] = { r: sum[0] / n, g: sum[1] / n, b: sum[2] / n, a: 1 }
      }
      return imageCache[url]
    }

    // The color painted behind `el`'s content: its own fill and every
    // ancestor's, composited down to the first opaque color or image.
    const backdrop = async (el, { includeSelf = true } = {}) => {
      const layers = []
      let base = null
      for (let node = includeSelf ? el : el.parentElement; node && !base; node = node.parentElement) {
        const cs = getComputedStyle(node)
        const image = /url\(["']?([^"')]+)/.exec(cs.backgroundImage)?.[1]
        const color = parse(cs.backgroundColor)
        if (image) {
          base = await imageMean(image)
        } else if (color?.a === 1) {
          base = color
        } else if (color?.a > 0) {
          layers.push(color)
        }
      }
      if (!base) return null
      return layers.reverse().reduce((bg, layer) => over(layer, bg), base)
    }
    const effectiveOpacity = el => {
      let opacity = 1
      for (let node = el; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity)
      return opacity
    }
    // WCAG exempts inactive controls; DCC marks clicked card buttons `.disabled`.
    const inactive = el => !!el.closest(':disabled, .disabled')
    const visible = el => el.checkVisibility({ visibilityProperty: true, opacityProperty: true })

    const flags = []
    const counts = { text: 0, controls: 0 }
    for (const id of ids) {
      const msg = document.querySelector(`#chat .chat-log [data-message-id="${id}"]`)
      const card = msg.querySelector('.message-content')
      const name = game.messages.get(id)?.getFlag('dcc', 'contrastGallery')
      const cardBg = await backdrop(card)

      // SC 1.4.3 — text.
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const text = walker.currentNode.nodeValue.trim()
        const el = walker.currentNode.parentElement
        if (!text || !el || !visible(el) || inactive(el)) continue
        if (onlySelector && !el.closest(onlySelector)) continue
        // Core's die-face graphics (preexisting, see chat-card-theme.spec.js).
        if (el.closest('.dice-tooltip')) continue
        const cs = getComputedStyle(el)
        const bg = await backdrop(el)
        const fg = parse(cs.color)
        fg.a *= effectiveOpacity(el)
        const size = parseFloat(cs.fontSize)
        const large = size >= 24 || (size >= 18.66 && (parseInt(cs.fontWeight, 10) || 400) >= 700)
        const r = ratio(over(fg, bg), bg)
        counts.text++
        if (r < (large ? 3 : 4.5)) {
          flags.push({ card: name, kind: 'text', text: text.slice(0, 40), color: cs.color, ratio: r, min: large ? 3 : 4.5 })
        }
      }

      // SC 1.4.11 — control boundaries.
      for (const el of card.querySelectorAll('button, select, input, a.button, a.dcc-enricher')) {
        if (!visible(el) || inactive(el)) continue
        if (onlySelector && !el.matches(onlySelector)) continue
        const cs = getComputedStyle(el)
        const border = parse(cs.borderTopColor)
        const fill = await backdrop(el)
        const borderRatio = cs.borderTopStyle !== 'none' && parseFloat(cs.borderTopWidth) > 0
          ? ratio(over(border, fill), cardBg)
          : 0
        const r = Math.max(borderRatio, ratio(fill, cardBg))
        counts.controls++
        if (r < 3) {
          flags.push({ card: name, kind: 'control', text: el.textContent.trim().slice(0, 40), border: cs.borderTopColor, fill: cs.backgroundColor, ratio: r, min: 3 })
        }
      }
    }
    return { flags, counts }
  }, { ids, onlySelector })
}

/**
 * Screenshot every gallery card, plus one `gallery.png` sheet of all of them,
 * into test-results/ and the report — the visual check a reviewer actually
 * looks at. Core's jump-to-bottom control and notification toasts are hidden
 * so they can't cover a card.
 */
async function captureGallery (page, gallery, themeCase, testInfo) {
  // The session page is shared by later specs, so the hiding style must go.
  const hide = await page.addStyleTag({ content: '#chat .jump-to-bottom, #notifications { display: none !important }' })
  const shots = []
  try {
    for (const { name, id } of gallery) {
      const message = page.locator(`#chat .chat-log [data-message-id="${id}"]`)
      await message.evaluate(el => el.scrollIntoView({ block: 'center' }))
      const path = testInfo.outputPath(`${name}.png`)
      const png = await message.screenshot({ path, animations: 'disabled' })
      shots.push({ name, src: `data:image/png;base64,${png.toString('base64')}` })
    }
  } finally {
    await hide.evaluate(el => el.remove())
  }
  const sheet = await page.context().newPage()
  try {
    await sheet.setContent(`<body style="margin:0;padding:12px;background:#777;font:14px sans-serif;columns:300px 3;column-gap:12px">
      <h2 style="margin:0 0 8px">${themeCase.name}</h2>
      ${shots.map(s => `<figure style="margin:0 0 12px;break-inside:avoid"><figcaption>${s.name}</figcaption><img src="${s.src}"></figure>`).join('')}
    </body>`)
    const path = testInfo.outputPath('gallery.png')
    await sheet.screenshot({ path, fullPage: true })
    await testInfo.attach(`${themeCase.name} — gallery`, { path, contentType: 'image/png' })
  } finally {
    await sheet.close()
  }
}

test.describe('Chat card contrast sweep', () => {
  test.afterEach(async ({ page }) => {
    await page.mouse.move(0, 0)
    await removeGallery(page)
    await restoreTheme(page)
  })

  for (const themeCase of THEME_CASES) {
    test(`every gallery card passes WCAG contrast: ${themeCase.name}`, async ({ page }, testInfo) => {
      test.setTimeout(120000)
      await page.mouse.move(0, 0)
      const gallery = await postGallery(page)
      const ids = gallery.map(g => g.id)
      await applyTheme(page, themeCase, ids)

      // Screenshots first, so a failing audit still leaves the evidence.
      await captureGallery(page, gallery, themeCase, testInfo)

      const resting = await auditGallery(page, ids)
      // Guard against the audit silently matching nothing.
      expect(resting.counts.text, 'text nodes audited').toBeGreaterThan(40)
      expect(resting.counts.controls, 'controls audited').toBeGreaterThanOrEqual(12)
      expect(resting.flags, `contrast failures (${themeCase.name}, at rest)`).toEqual([])

      // Hover each enabled button and re-audit just that button.
      const buttons = await page.evaluate(ids => ids.flatMap(id =>
        [...document.querySelectorAll(`#chat .chat-log [data-message-id="${id}"] .message-content button:not(:disabled):not(.disabled)`)]
          .map((el, index) => ({ id, index }))), ids)
      expect(buttons.length, 'enabled buttons hovered').toBeGreaterThanOrEqual(8)
      const hoverFlags = []
      for (const { id, index } of buttons) {
        const button = page.locator(`#chat .chat-log [data-message-id="${id}"] .message-content button:not(:disabled):not(.disabled)`).nth(index)
        await button.scrollIntoViewIfNeeded()
        await button.hover()
        await button.evaluate(el => {
          el.dataset.contrastHover = ''
          for (const a of el.getAnimations()) a.finish()
        })
        const hovered = await auditGallery(page, [id], '[data-contrast-hover]')
        await button.evaluate(el => delete el.dataset.contrastHover)
        hoverFlags.push(...hovered.flags.map(f => ({ ...f, state: 'hover' })))
      }
      await page.mouse.move(0, 0)
      expect(hoverFlags, `contrast failures (${themeCase.name}, hover)`).toEqual([])
    })
  }
})

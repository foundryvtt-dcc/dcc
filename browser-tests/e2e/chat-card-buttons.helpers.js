/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect } = require('./fixtures')

// Rounded mean of Foundry v14 parchment.jpg, not a pixel-level image audit.
const PARCHMENT_BACKGROUND = 'rgb(218, 216, 205)'

async function createChatButtonProbe (page, { applications, interfaceTheme, useUi }) {
  const specimens = await page.evaluate(async ({ applications, interfaceTheme, useUi }) => {
    if (globalThis.__dccButtonProbe) throw new Error('Previous button probe teardown is still pending')
    const cfg = foundry.utils.deepClone(game.settings.get('core', 'uiConfig'))
    globalThis.__dccSavedUiConfig = cfg
    const probe = {
      config: cfg,
      hadClass: document.body.classList.contains('chat-cards-use-ui-theme'),
      ids: [],
      nodes: [],
      teardown: false
    }
    globalThis.__dccButtonProbe = probe
    probe.setup = (async () => {
      await game.settings.set('core', 'uiConfig', {
        ...cfg,
        colorScheme: { ...(cfg.colorScheme || {}), applications, interface: interfaceTheme }
      })
      if (probe.teardown) return []
      document.body.classList.toggle('chat-cards-use-ui-theme', useUi)
      const specimens = []
      const create = async (name, content, selector, count) => {
        if (probe.teardown) return
        const msg = await ChatMessage.create({ content })
        probe.ids.push(msg.id)
        if (probe.teardown) {
          await msg.delete().catch(() => {})
          return
        }
        specimens.push({ name, id: msg.id, selector, count })
      }
      const render = (template, context) => foundry.applications.handlebars.renderTemplate(`systems/dcc/templates/${template}.html`, context)
      const base = { canUserModify: true, automated: false, suppressDamage: false, flavorText: 'Button contrast probe', damageRollFormula: '1d6', diceHTML: '' }
      const clickedFlags = clicked => ({ isGM: !clicked, damageButtonClicked: clicked, critButtonClicked: clicked, fumbleButtonClicked: clicked })
      for (const [compact, isFumble] of [[false, false], [false, true], [true, false], [true, true]]) {
        const variant = { ...base, compact, isFumble, isCrit: !isFumble }
        for (const clicked of [false, true]) {
          if (probe.teardown) return specimens
          await create(`${clicked ? 'inactive' : 'enhanced'}-${compact ? 'compact' : 'normal'}-${isFumble ? 'fumble' : 'crit'}`,
            await render('chat-card-attack-enhanced', { ...variant, ...clickedFlags(clicked) }), '.enhanced-card-button', isFumble ? 1 : 2)
        }
      }
      // Exact action markup from private postDeathClockCard; no action invoked.
      for (const [action, label] of [['rollTheBody', 'DCC.RollTheBody'], ['rollAbilityLoss', 'DCC.RollAbilityLoss']]) {
        if (probe.teardown) return specimens
        await create(`death-${action}`,
          `<div class="dcc-death-clock-actions"><button type="button" data-action="${action}" data-actor-uuid="">` +
          `${game.i18n.localize(label)}</button></div>`, 'button', 1)
      }
      if (probe.teardown) return specimens
      await create('release', await render('chat-card-release-notes', { message: '' }), 'button, button > i', 6)
      if (probe.teardown) return specimens
      await create('deed', game.dcc.buildMightyDeedPrompt({
        system: { deedDieRollResult: 3, deedTables: [{ path: 'probe', name: 'Probe deed table' }] }
      }), '.deed-table-select', 1)
      if (probe.teardown) return specimens
      await create('plain', await render('chat-card-attack-result', {
        message: { system: { damagePrompt: 'Damage', damageInlineRoll: '<a class="inline-roll">3</a>', twoWeaponNote: 'Plain card probe' } }
      }), '.message-content > div, a.inline-roll', 3)
      await create('generic-chat', '<button type="button">Generic button</button><a class="button">Generic anchor</a>', 'button, a.button', 2)
      const outside = document.createElement('div')
      outside.id = 'dcc-button-scope-probe'
      outside.innerHTML = '<div class="dcc-enhanced-card"><button class="enhanced-card-button">Outside enhanced</button></div>' +
        '<div class="dcc-death-clock-actions"><button>Outside death</button></div>' +
        '<div class="chat-message"><div class="dcc-enhanced-card"><button class="enhanced-card-button">Outside content enhanced</button></div>' +
        '<div class="dcc-death-clock-actions"><button>Outside content death</button></div></div>'
      probe.nodes.push(outside)
      document.body.append(outside)
      specimens.push({ name: 'outside-scope', domId: outside.id, selector: 'button', count: 4 })
      return specimens
    })()
    return probe.setup
  }, { applications, interfaceTheme, useUi })
  const active = specimens.filter(s => /^(enhanced|death)-/.test(s.name))
  return {
    specimens,
    active,
    inactive: specimens.filter(s => s.name.startsWith('inactive-')),
    representatives: active.filter(s => ['enhanced-normal-crit', 'death-rollTheBody'].includes(s.name)),
    generic: specimens.find(s => s.name === 'generic-chat')
  }
}

// Browser reads only; contrast math runs once on the settled snapshot in Node.
function readButtonPaint (elements) {
  return (Array.isArray(elements) ? elements : [elements]).map(el => {
    const cs = getComputedStyle(el)
    const ancestors = []
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node)
      ancestors.push({ background: style.backgroundColor, image: style.backgroundImage, opacity: style.opacity, tag: node.tagName, classes: node.className })
    }
    return {
      label: el.textContent.trim(),
      color: cs.color,
      background: cs.backgroundColor,
      ancestors,
      border: `${cs.borderTopStyle} ${cs.borderTopWidth} ${cs.borderTopColor}`,
      outline: { style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor },
      opacity: cs.opacity,
      translucentAncestors: ancestors.slice(1).filter(a => a.opacity !== '1'),
      pointerEvents: cs.pointerEvents,
      disabled: el.matches(':disabled'),
      classDisabled: el.classList.contains('disabled'),
      hovered: el.matches(':hover'),
      focused: document.activeElement === el,
      transitioning: el.getAnimations().some(a => a.playState === 'running')
    }
  })
}

function measureContrast (paint, scheme) {
  const parse = value => {
    const match = /^rgba?\(([^)]+)\)$/.exec(value)
    if (!match) throw new Error(`Expected RGB/RGBA, got ${value}`)
    const [r, g, b, a = 1] = match[1].trim().split(/[,\s/]+/).map(Number)
    return { r, g, b, a }
  }
  const over = (front, back) => {
    const a = front.a + back.a * (1 - front.a)
    return { ...Object.fromEntries(['r', 'g', 'b'].map(c => [c, (front[c] * front.a + back[c] * back.a * (1 - front.a)) / a])), a }
  }
  const layers = []
  let background
  let approximateImage = false
  for (const ancestor of paint.ancestors) {
    if (ancestor.image !== 'none') {
      if (scheme !== 'light' || !ancestor.image.includes('parchment.jpg')) throw new Error(`Unexpected card background image: ${ancestor.image}`)
      background = parse(PARCHMENT_BACKGROUND) // Image paints over this ancestor's color.
      approximateImage = true
      break
    }
    const layer = parse(ancestor.background)
    if (layer.a === 1) {
      background = layer
      break
    }
    layers.push(layer)
  }
  if (!background) throw new Error('No opaque card background or parchment image found')
  const cardBackground = { ...background }
  for (const layer of layers.reverse()) background = over(layer, background)
  const channel = v => v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4
  const luminance = c => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)
  const [hi, lo] = [luminance(over(parse(paint.color), background)), luminance(background)].sort((a, b) => b - a)
  return { ...paint, contrast: (hi + 0.05) / (lo + 0.05), cardBackground, approximateImage }
}

async function settledPaint (read, count, scheme, paint, contrast) {
  let measured
  return expect.poll(async () => {
    measured = await read()
    return measured
  }, { message: `${scheme} button paint settled: ${JSON.stringify(paint)}`, timeout: 5000, intervals: [100] }).toEqual(
    Array.from({ length: count }, () => expect.objectContaining({ ...paint, transitioning: false }))
  ).then(() => contrast ? measured.map(p => measureContrast(p, scheme)) : measured).catch(error => {
    throw new Error(`${error.message}\nLast button measurements: ${JSON.stringify(measured)}`)
  })
}

async function expectChatButtonsPaint (page, specimens, scheme, paint, contrast = true) {
  const buttons = page.locator(specimens.map(s => `#chat [data-message-id="${s.id}"] .message-content ${s.selector}`).join(', '))
  return settledPaint(() => buttons.evaluateAll(readButtonPaint), specimens.reduce((n, s) => n + s.count, 0), scheme, paint, contrast)
}

async function expectButtonPaint (locator, scheme, paint, contrast = true) {
  return (await settledPaint(() => locator.evaluate(readButtonPaint), 1, scheme, paint, contrast))[0]
}

async function expectProbeTheme (page, specimens, { applications, interfaceTheme, useUi, text }) {
  const scheme = useUi ? interfaceTheme : applications
  await expect.poll(() => page.evaluate(({ applications, interfaceTheme, useUi, text, scheme, ids }) => {
    const config = game.settings.get('core', 'uiConfig')
    return ids.every(id => {
      const msg = document.querySelector(`#chat [data-message-id="${id}"]`)
      const parts = ['.message-content', '.message-header'].map(selector => msg?.querySelector(selector))
      if (parts.some(el => !el)) return false
      const card = getComputedStyle(msg)
      return parts.every(el => getComputedStyle(el).color === text) &&
        (scheme === 'dark' ? card.backgroundColor === 'rgb(11, 10, 19)' && card.backgroundImage === 'none' : card.backgroundImage.includes('parchment.jpg')) &&
        [msg, ...parts].every(el => !el.getAnimations().some(a => a.playState === 'running'))
    }) && config.colorScheme.applications === applications && config.colorScheme.interface === interfaceTheme &&
      document.body.classList.contains(`theme-${applications}`) &&
      document.getElementById('interface')?.classList.contains(`theme-${interfaceTheme}`) &&
      document.body.classList.contains('chat-cards-use-ui-theme') === useUi
  }, { applications, interfaceTheme, useUi, text, scheme, ids: specimens.filter(s => s.id).map(s => s.id) }),
  { message: 'actual settings, theme classes and header/card paint settled' }).toBe(true)
}

// Called from both finally and afterEach: the latter gets a fresh runner
// timeout if a theme poll or message creation exhausted the test's timeout.
async function restoreChatButtonProbe (page) {
  return page.evaluate(async () => {
    const probe = globalThis.__dccButtonProbe
    if (probe?.cleanup) return probe.cleanup
    if (probe) probe.teardown = true
    const cleanup = async () => {
      // A timed-out evaluate keeps running in the browser. Join its setup before
      // restoring settings, and keep its ID array alive for late create results.
      await probe?.setup?.catch(() => {})
      for (const node of probe?.nodes || []) node.remove()
      const ids = probe?.ids || []
      const saved = probe?.config || globalThis.__dccSavedUiConfig
      const hadClass = probe?.hadClass
      for (const id of ids) {
        await game.messages.get(id)?.delete().catch(() => {})
      }
      const remaining = ids.filter(id => game.messages.has(id))
      if (probe) probe.ids = remaining
      if (saved) {
        await game.settings.set('core', 'uiConfig', saved)
        if (globalThis.__dccSavedUiConfig === saved) delete globalThis.__dccSavedUiConfig
      }
      if (typeof hadClass === 'boolean') {
        document.body.classList.toggle('chat-cards-use-ui-theme', hadClass)
      }
      if (probe && !remaining.length && globalThis.__dccButtonProbe === probe) delete globalThis.__dccButtonProbe
      return {
        remaining,
        nodesRemoved: (probe?.nodes || []).every(node => !node.isConnected),
        configRestored: !saved || JSON.stringify(game.settings.get('core', 'uiConfig')) === JSON.stringify(saved),
        classRestored: typeof hadClass !== 'boolean' || document.body.classList.contains('chat-cards-use-ui-theme') === hadClass
      }
    }
    if (!probe) return cleanup()
    probe.cleanup = cleanup()
    try { return await probe.cleanup } finally { probe.cleanup = null }
  }).catch(() => {})
}

module.exports = { createChatButtonProbe, expectProbeTheme, expectChatButtonsPaint, expectButtonPaint, restoreChatButtonProbe }

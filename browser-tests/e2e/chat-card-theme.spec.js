/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Chat-card text color across the light / dark themes (issue #856).
 *
 * `.dcc` (styles/base.css) colors card bodies with `--system-primary-color`,
 * the SHEET color. Foundry stamps `theme-light` on `ol.chat-log`, which
 * re-establishes the light variable block from styles/variables.css for that
 * whole subtree — so inside the chat log `--system-primary-color` resolves to
 * the light value (#222) whatever the active theme is. Cards that set no color
 * of their own therefore rendered near-black on the dark chat background: the
 * friendly-fire card and the ability-score-log ("Luck spend") card, plus the
 * inline roll inside the former (DCC strips Foundry's light chip background from
 * inline rolls, so their text sits straight on the card).
 *
 * `styles/chat.css` now points DCC card bodies, inline rolls and content links
 * at `--chat-primary-color`, which variables.css defines on `body` precisely so
 * chat cards follow the app theme rather than the chat log's own stamp.
 *
 * The same mechanism reached two more cards whose own color declarations sat
 * above the card-body rule: the `[[/check]]` roll-link enrichers and the
 * release-notes card body. Those are covered here too, along with the
 * spell-check card's manifestation / mercurial blocks, so the fix is pinned as
 * "chat text follows the chat theme", not "these two cards do".
 *
 * Asserted against real rendered messages in both themes: the body text must
 * match the header (i.e. the theme's chat color), and in dark theme must NOT be
 * the light #222.
 */
const test = createSessionTest()

const LIGHT_TEXT = 'rgb(34, 34, 34)' // #222 — the light-theme chat/sheet color
const DARK_TEXT = 'rgb(208, 190, 170)' // #d0beaa — the dark-theme chat color
const TRANSPARENT = 'rgba(0, 0, 0, 0)'
// The two border weights from the theming contract (#861).
const BORDER_SUBTLE_LIGHT = 'rgb(181, 179, 164)' // #b5b3a4 — decorative divider
const BORDER_SUBTLE_DARK = 'rgb(61, 60, 68)' //  #3d3c44
const BORDER_MUTED_LIGHT = 'rgb(122, 121, 113)' // #7a7971 — must stay visible
const BORDER_MUTED_DARK = 'rgb(107, 106, 117)' // #6b6a75
/* Crit / fumble accents — mirror the `--chat-critical-color` /
 * `--chat-fumble-color` values in styles/variables.css. Light keeps the literal
 * `green` / `red`; dark uses lighter hues for the #0b0a13 card (#948).
 */
const CRIT_GREEN_LIGHT = 'rgb(0, 128, 0)' // `green`
const FUMBLE_RED_LIGHT = 'rgb(255, 0, 0)' // `red`
const CRIT_GREEN_DARK = 'rgb(125, 219, 99)' // #7ddb63
const FUMBLE_RED_DARK = 'rgb(255, 127, 127)' // #ff7f7f

/**
 * WCAG contrast audit over text nodes in the chat log (page-side).
 *
 * Walks every non-empty text node under each scope selector, resolves the
 * SC 1.4.3 ratio between the node's computed color and the first OPAQUE
 * background up the ancestor chain, and returns every node below the
 * threshold: 4.5:1 for normal text, 3:1 for large text (>=24px, or the
 * 18pt-bold equivalent 18.66px at weight >= 700).
 *
 * GOTCHAS baked into the callers:
 * - The scoping MUST resolve inside `#chat ol.chat-log`. `#chat-notifications`
 *   also contains an empty `ol.chat-log` that appears EARLIER in the DOM, so a
 *   bare `document.querySelector('.chat-log')` picks that one and audits
 *   nothing.
 * - The light chat card background is a parchment IMAGE
 *   (`url('/ui/parchment.jpg')`), not a backgroundColor, so the ancestor walk
 *   finds none; a caller auditing light theme passes a fallback background
 *   matching the light chat background (this audit runs on the dark theme in
 *   this spec, where the card's backgroundColor is the token value).
 * - Scopes are per-message `.message-content` roots: the header row (sender,
 *   timestamp) is core metadata we deliberately do not own.
 * - The audit re-asserts the dark uiConfig INSIDE its own evaluate and waits
 *   out the re-render: Foundry applies uiConfig changes partially
 *   asynchronously, and a late-landing restore from a previous turn-over has
 *   been observed to flip the body BACK to `theme-light` in the gap between
 *   two `page.evaluate` calls. It returns the body class it saw so the test
 *   can assert the re-arm actually took.
 */
async function auditChatCardContrast (page, scopeSelectors, fallbackBg = 'rgb(11, 10, 19)') {
  return page.evaluate(async ({ scopes, fallback }) => { // Re-assert the dark theme inside THIS evaluate — uiConfig changes land
    // partially asynchronously, so this is NOT trusted to the preceding
    // evaluate: a late-landing restore from an earlier step has been observed
    // reverting the body to `theme-light` between two evaluates. One
    // self-contained evaluate arms the theme, waits out the re-render, then
    // walks the cards it can still see.
    const cfg = game.settings.get('core', 'uiConfig')
    await game.settings.set('core', 'uiConfig', {
      ...cfg,
      colorScheme: { ...(cfg.colorScheme || {}), interface: 'dark', applications: 'dark' }
    })
    await new Promise((resolve) => setTimeout(resolve, 600))
    const parseRgb = (value) => {
      const m = /rgba?\(([^)]+)\)/.exec(value)
      if (!m) return null
      const parts = m[1].split(/[,\s/]+/).map(Number)
      return { r: parts[0], g: parts[1], b: parts[2], a: Number.isFinite(parts[3]) ? parts[3] : 1 }
    }
    const channel = (v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    const luminance = ({ r, g, b }) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    const ratio = (fg, bg) => {
      const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }
    // First ancestor (including the node's own elements) with an opaque
    // backgroundColor; otherwise the caller's fallback.
    const effectiveBackground = (el) => {
      let probe = el
      while (probe && probe !== document.documentElement) {
        const bg = parseRgb(getComputedStyle(probe).backgroundColor)
        if (bg && bg.a === 1) return bg
        probe = probe.parentElement
      }
      return parseRgb(fallback)
    }
    const flags = []
    for (const scope of scopes) {
      const root = document.querySelector(scope)
      if (!root) { flags.push({ scope, error: 'scope not found' }); continue }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const node = walker.currentNode
        const text = node.nodeValue.trim()
        if (!text) continue
        const parent = node.parentElement
        if (!parent || /^(script|style)$/i.test(parent.tagName)) continue
        // Invisible text cannot be read, so it cannot fail SC 1.4.3 (also skips
        // transient toasts).
        if (typeof parent.checkVisibility === 'function' && !parent.checkVisibility({ visibilityProperty: true })) continue
        // MANUAL EXCLUSION: `.dice-tooltip` die rows (`.roll.die.d*`). Their
        // d100 die faces measure 1.07:1 as black-on-dark — preexisting core
        // die-graphic styling rather than chat-card text, tracked separately
        // from the dark-card text fixes and deliberately NOT fixed in CSS
        // here. Excluding the zone keeps that tracked-but-unfixed item out of
        // this audit's scope; if it is ever fixed, remove this guard.
        if (parent.closest('.dice-tooltip')) continue
        const cs = getComputedStyle(parent)
        const fg = parseRgb(cs.color)
        const bg = effectiveBackground(parent)
        if (!fg || !bg) continue
        const fontSize = parseFloat(cs.fontSize)
        const weight = parseInt(cs.fontWeight, 10) || 400
        const large = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700)
        const threshold = large ? 3 : 4.5
        const r = Math.round(ratio(fg, bg) * 100) / 100
        if (r < threshold) {
          flags.push({ scope, text: text.slice(0, 40), color: cs.color, background: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, ratio: r, threshold, fontSize, weight })
        }
      }
    }
    return { flags, body: document.body.className }
  }, { scopes: scopeSelectors, fallback: fallbackBg })
}

test.describe('Chat card text color', () => {
  // This spec flips the world-level `core.uiConfig` colorScheme, and the session
  // page is shared across the whole suite. If the in-page `finally` is abandoned
  // (a Playwright timeout kills `page.evaluate` mid-flight) the world would stay
  // on whatever theme was set last, for every later spec — and the setting is
  // persisted to `worlds/*/data/settings`. Restore from the runner side too, so
  // the reset survives a timeout.
  test.afterEach(async ({ page }) => {
    await page.evaluate(async () => {
      const saved = globalThis.__dccSavedUiConfig
      if (saved) {
        await game.settings.set('core', 'uiConfig', saved)
        delete globalThis.__dccSavedUiConfig
      }
    }).catch(() => {})
  })

  test('DCC card bodies follow the chat theme in both light and dark', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const out = {}
      const cfg = game.settings.get('core', 'uiConfig')
      // Stashed so the runner-side afterEach can restore it if this evaluate is
      // abandoned before its own `finally` runs.
      globalThis.__dccSavedUiConfig = cfg
      let actor
      const msgs = []

      const measure = async (scheme) => {
        await game.settings.set('core', 'uiConfig', {
          ...cfg,
          colorScheme: { ...(cfg.colorScheme || {}), interface: scheme, applications: scheme }
        })
        // The theme swap re-renders the chat log; give it a beat to settle.
        await new Promise(resolve => setTimeout(resolve, 800))
        const read = (sel) => {
          const el = document.querySelector(sel)
          return el ? getComputedStyle(el).color : null
        }
        const readBackground = (sel) => {
          const el = document.querySelector(sel)
          return el ? getComputedStyle(el).backgroundColor : null
        }
        const readBorder = (sel) => {
          const el = document.querySelector(sel)
          if (!el) return null
          const cs = getComputedStyle(el)
          return `${cs.borderTopStyle} ${cs.borderTopWidth} ${cs.borderTopColor}`
        }
        return {
          // The header was always correct — it is the reference the card body
          // has to match.
          messageHeader: read('.chat-message .message-header'),
          abilityHeadline: read('.ability-change-card .headline'),
          abilityReason: read('.ability-change-card .reason'),
          abilityRecovery: read('.ability-change-card .recovery'),
          friendlyFireText: read('.friendly-fire p'),
          inlineRoll: read('.friendly-fire a.inline-roll'),
          inlineRollIcon: read('.friendly-fire a.inline-roll > i'),
          // The muted caption under a rolled formula. Dimmed with opacity, not
          // a fixed grey, so it stays legible in both themes.
          modifierBreakdown: read('.theme856-extras .dcc-modifier-breakdown'),
          // Crit / fumble colors are meaningful and theme-independent — the
          // card-body rule must not outrank them.
          critInlineRoll: read('.theme856-extras a.inline-roll.critical'),
          fumbleInlineRoll: read('.theme856-extras a.inline-roll.fumble'),
          critEmote: read('.theme856-extras .emote-alert.critical'),
          fumbleEmote: read('.theme856-extras .emote-alert.fumble'),
          // Cards WITHOUT a `.dcc` wrapper — the attack cards, the adapter check
          // cards and the emote path all look like this, and they are the bulk of
          // chat. A `.dcc`-scoped fix would leave every one of them dark-on-dark.
          bareInlineRoll: read('.theme856-bare p a.inline-roll'),
          bareInlineRollIcon: read('.theme856-bare p a.inline-roll > i'),
          bareContentLink: read('.theme856-bare a.content-link'),
          // The shape module/chat.js actually emits for a crit: the class is on a
          // wrapping span and the visible anchor inside carries none, so the
          // anchor has to INHERIT the span's green rather than be recolored.
          critWrapperSpan: read('.theme856-bare span.inline-roll.critical'),
          critWrapperAnchor: read('.theme856-bare span.inline-roll.critical a.inline-roll'),
          // Cards whose own color declarations sat above the card-body rule, so
          // the first pass at #856 did not reach them:
          //
          // 1. the spell-check card's manifestation / mercurial blocks. These
          //    carried `--color-text-dark-secondary`, which Foundry declares only
          //    on `body.game .app` (legacy AppV1 — the V2 sidebar chat does not
          //    match it), so the declaration was invalid and they already
          //    inherited. Measured to keep it that way: swapping in a real fixed
          //    grey would be dark-on-dark.
          spellManifestation: read('.theme856-spell .manifestation'),
          spellMercurial: read('.theme856-spell .mercurial'),
          // 2. roll-link enrichers, colored `--system-primary-color` by
          //    styles/enrichers.css with no background of their own;
          enricherLink: read('.theme856-enricher a.dcc-enricher'),
          enricherIcon: read('.theme856-enricher a.dcc-enricher > i'),
          //    The text is `inherit`, so it follows the dark card — which only
          //    works while the link has no fill of its own. Pinned here because
          //    the fill it used to name (`--system-light-bg`) was an undefined
          //    variable: giving that a light value would be #856 from the other
          //    side, light text on a light chip.
          enricherBackground: readBackground('.theme856-enricher a.dcc-enricher'),
          //    With no fill, the border IS the affordance — and it referenced a
          //    variable V14 dropped, so it rendered `none 0px` (issue #861).
          //    Static analysis cannot prove a variable resolves; only this can.
          enricherBorder: readBorder('.theme856-enricher a.dcc-enricher'),
          // A decorative divider inside a card, on the quieter of the two border
          // tokens — same #861 failure, same proof.
          weaponDescriptionBorder: readBorder('.theme856-borders .weapon-description'),
          // 3. the release-notes card body — the card root is
          //    `.dcc-release-notes-card`, not `.dcc`.
          releaseMessage: read('.theme856-release .dcc-release-message')
        }
      }

      try {
        actor = await Actor.create({ name: 'Theme856 Probe', type: 'Player' })

        // The ability-score-log card, as `logAbilityChange` announces a luck spend.
        msgs.push(await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: await foundry.applications.handlebars.renderTemplate(
            'systems/dcc/templates/chat-card-ability-change.html',
            {
              headline: 'Loses 1 Luck',
              reason: 'Luck spend',
              recovery: 'Permanent (Luck does not heal)',
              hpNote: ''
            }
          ),
          flags: { 'dcc.isAbilityScoreLog': true }
        }))

        // The friendly-fire card, in the inline shape postFriendlyFireCard builds
        // (including a real roll anchor for the d100 check).
        const roll = new Roll('1d100')
        await roll.evaluate()
        msgs.push(await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: 'Friendly Fire Check',
          rolls: [roll],
          content: '<div class="dcc chat-card friendly-fire">' +
            `<p>The missed shot was fired into a melee ${roll.toAnchor().outerHTML}</p>` +
            '</div>',
          flags: { 'dcc.isFriendlyFire': true }
        }))

        // A DCC card carrying the muted modifier breakdown plus the
        // crit/fumble variants, to pin that the card-body rule dims the former
        // without stealing the latter's meaningful colors.
        msgs.push(await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: '<div class="dcc chat-card theme856-extras">' +
            '<span class="dcc-modifier-breakdown">Strength +1</span>' +
            '<p><a class="inline-roll critical">20</a></p>' +
            '<p><a class="inline-roll fumble">1</a></p>' +
            '<p class="emote-alert critical">crit</p>' +
            '<p class="emote-alert fumble">fumble</p>' +
            '</div>'
        }))

        // A card with NO `.dcc` wrapper, carrying a real roll anchor, a content
        // link, and the crit span-wrapper shape module/chat.js emits.
        const bareRoll = new Roll('1d20')
        await bareRoll.evaluate()
        const bareAnchor = bareRoll.toAnchor().outerHTML
        msgs.push(await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          rolls: [bareRoll],
          content: '<div class="theme856-bare">' +
            `<p>emote-style roll ${bareAnchor}</p>` +
            '<a class="content-link">Some Actor</a>' +
            `<span class="inline-roll inline-result critical">${bareAnchor}</span>` +
            '</div>'
        }))

        // The spell-check card, from the real template — the manifestation and
        // mercurial blocks carry the only other color declaration in chat that
        // outranks the card-body rule.
        msgs.push(await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: '<div class="theme856-spell">' + await foundry.applications.handlebars.renderTemplate(
            'systems/dcc/templates/chat-card-spell-result.html',
            {
              manifestation: { description: 'A shimmering aura surrounds the caster' },
              mercurial: { description: 'The caster\'s hair turns white' },
              results: []
            }
          ) + '</div>'
        }))

        // Raw enricher source in the message body, exactly as the GM roll-request
        // card posts it (module/journal-enrichers.mjs) — Foundry enriches chat
        // content per-client at render, so this exercises the real link markup.
        msgs.push(await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: '<div class="theme856-enricher"><p>[[/check str]]</p></div>'
        }))

        // An enhanced-attack-card fragment, for the divider border (#861).
        msgs.push(await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: '<div class="dcc-enhanced-card theme856-borders">' +
            '<div class="weapon-description">Longsword, 1d8</div>' +
            '</div>'
        }))

        // The release-notes card, from the real template.
        msgs.push(await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: '<div class="theme856-release">' + await foundry.applications.handlebars.renderTemplate(
            'systems/dcc/templates/chat-card-release-notes.html',
            { message: 'What is new in this release' }
          ) + '</div>'
        }))
        await new Promise(resolve => setTimeout(resolve, 500))

        out.dark = await measure('dark')
        out.light = await measure('light')
      } finally {
        for (const m of msgs) { if (m) await m.delete() }
        if (actor) await actor.delete()
        await game.settings.set('core', 'uiConfig', cfg)
      }
      return out
    })

    // Every measured element resolved (a null would mean the card never rendered
    // and the assertions below would pass vacuously).
    for (const [theme, values] of Object.entries(result)) {
      for (const [key, value] of Object.entries(values)) {
        expect(value, `${theme}.${key} did not render`).not.toBeNull()
      }
    }

    // Dark theme: the whole card body matches the header instead of the
    // light-theme #222 it used to inherit.
    expect(result.dark.messageHeader).toBe(DARK_TEXT)
    expect(result.dark.abilityHeadline).toBe(DARK_TEXT)
    expect(result.dark.abilityReason).toBe(DARK_TEXT)
    expect(result.dark.abilityRecovery).toBe(DARK_TEXT)
    expect(result.dark.friendlyFireText).toBe(DARK_TEXT)
    expect(result.dark.inlineRoll).toBe(DARK_TEXT)
    expect(result.dark.inlineRollIcon).toBe(DARK_TEXT)
    expect(result.dark.modifierBreakdown).toBe(DARK_TEXT)

    // Light theme is unchanged — both variables are #222 there.
    expect(result.light.messageHeader).toBe(LIGHT_TEXT)
    expect(result.light.abilityHeadline).toBe(LIGHT_TEXT)
    expect(result.light.abilityReason).toBe(LIGHT_TEXT)
    expect(result.light.abilityRecovery).toBe(LIGHT_TEXT)
    expect(result.light.friendlyFireText).toBe(LIGHT_TEXT)
    expect(result.light.inlineRoll).toBe(LIGHT_TEXT)
    expect(result.light.inlineRollIcon).toBe(LIGHT_TEXT)
    expect(result.light.modifierBreakdown).toBe(LIGHT_TEXT)

    // Cards with no `.dcc` wrapper — the majority of chat — follow the theme too.
    // These are what a `.dcc`-scoped fix would have missed, and what the removed
    // `a.inline-roll` declaration was silently holding up.
    expect(result.dark.bareInlineRoll).toBe(DARK_TEXT)
    expect(result.dark.bareInlineRollIcon).toBe(DARK_TEXT)
    expect(result.dark.bareContentLink).toBe(DARK_TEXT)
    expect(result.light.bareInlineRoll).toBe(LIGHT_TEXT)
    expect(result.light.bareInlineRollIcon).toBe(LIGHT_TEXT)
    expect(result.light.bareContentLink).toBe(LIGHT_TEXT)

    // Cards that declared a color of their own, above the card-body rule. The
    // enricher links and the release-notes body were dark-on-dark after the first
    // pass at #856; the spell-check card's manifestation / mercurial blocks were
    // already inheriting (their declaration referenced an undefined variable) and
    // are measured so a "fix" that points them at a real grey gets caught.
    expect(result.dark.spellManifestation).toBe(DARK_TEXT)
    expect(result.dark.spellMercurial).toBe(DARK_TEXT)
    expect(result.dark.enricherLink).toBe(DARK_TEXT)
    expect(result.dark.enricherIcon).toBe(DARK_TEXT)
    expect(result.dark.releaseMessage).toBe(DARK_TEXT)
    expect(result.light.spellManifestation).toBe(LIGHT_TEXT)
    expect(result.light.spellMercurial).toBe(LIGHT_TEXT)
    expect(result.light.enricherLink).toBe(LIGHT_TEXT)
    expect(result.light.enricherIcon).toBe(LIGHT_TEXT)
    expect(result.light.releaseMessage).toBe(LIGHT_TEXT)
    expect(result.dark.enricherBackground).toBe(TRANSPARENT)
    expect(result.light.enricherBackground).toBe(TRANSPARENT)

    // Borders actually paint (#861). These referenced `--color-border-light-*`,
    // which V14 declares only under `body.game .app` — a selector nothing
    // matches — so the shorthand was invalid and computed to `border-style:
    // none`. `border-width: 0px` here means the variable stopped resolving
    // again, which no unit test can see.
    expect(result.dark.enricherBorder).toBe(`solid 1px ${BORDER_MUTED_DARK}`)
    expect(result.light.enricherBorder).toBe(`solid 1px ${BORDER_MUTED_LIGHT}`)
    expect(result.dark.weaponDescriptionBorder).toBe(`solid 1px ${BORDER_SUBTLE_DARK}`)
    expect(result.light.weaponDescriptionBorder).toBe(`solid 1px ${BORDER_SUBTLE_LIGHT}`)

    // Crit / fumble accents follow the theme tokens. The inline-roll rule is more
    // specific than `.inline-roll.critical`, so without the `:not()` exclusions
    // in styles/chat.css a natural 20 would render as ordinary body text; and
    // because it resolves to `inherit`, the anchor nested inside a crit WRAPPER
    // span picks up the span's green rather than being recolored. Light keeps
    // the literal green/red these declarations always had; dark gets the
    // lighter token values (`green` is 3.83:1 on #0b0a13).
    for (const theme of ['dark', 'light']) {
      const crit = theme === 'dark' ? CRIT_GREEN_DARK : CRIT_GREEN_LIGHT
      const fumble = theme === 'dark' ? FUMBLE_RED_DARK : FUMBLE_RED_LIGHT
      expect(result[theme].critInlineRoll, `${theme} crit inline roll`).toBe(crit)
      expect(result[theme].fumbleInlineRoll, `${theme} fumble inline roll`).toBe(fumble)
      expect(result[theme].critEmote, `${theme} crit emote`).toBe(crit)
      expect(result[theme].fumbleEmote, `${theme} fumble emote`).toBe(fumble)
      expect(result[theme].critWrapperSpan, `${theme} crit wrapper span`).toBe(crit)
      expect(result[theme].critWrapperAnchor, `${theme} crit wrapper anchor`).toBe(crit)
    }
  })

  /*
   * The mechanism of #856 did not stop at card bodies: core's
   * `@layer elements.typography` colors h1-h6 with `--color-text-emphatic`,
   * which resolves to near-black (#111) inside the chat log under the
   * `themed theme-light` stamp Foundry puts on `ol.chat-log`. So an h2 inside a
   * table-draw description ("Table 1-3: Occupation") rendered #111-on-#0b0a13,
   * ratio 1.04. Core-authored welcome cards (`.nue`, "Getting Started") h3s
   * failed the same way.
   *
   * This test draws a real table from the compendium against the live chat log
   * and, on the dark theme, also runs the full text-node contrast audit over
   * the resulting messages (thresholds 4.5:1 / 3:1 large).
   */
  test('table-draw headings match the chat color and card text passes a WCAG audit', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const out = { dark: {}, light: {} }
      const cfg = game.settings.get('core', 'uiConfig')
      globalThis.__dccSavedUiConfig = cfg
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const setScheme = async (scheme) => {
        await game.settings.set('core', 'uiConfig', {
          ...cfg,
          colorScheme: { ...(cfg.colorScheme || {}), interface: scheme, applications: scheme }
        })
        await sleep(800)
      }
      const colors = (sel, tags) => {
        // GOTCHA: each rendered message ALSO flash-renders as a toast in
        // `#chat-notifications`, which sits EARLIER in the DOM carrying the
        // same data-message-id — a bare `document.querySelector` would measure
        // that transient toast copy (light-styled) instead of the sidebar
        // card. Always resolve inside `#chat`.
        const root = document.querySelector('#chat ' + sel)
        if (!root) return null
        const out_ = {}
        for (const tag of tags) {
          const el = root.querySelector(tag)
          if (el) out_[tag] = getComputedStyle(el).color
        }
        return out_
      }

      /*
       * The same card shapes the #856 test above covers — its duplication is
       * deliberate: each test owns its create/delete lifecycle, and the dark
       * audit here wants ALL card families inside one zero-flag assertion.
       */
      const createAuditMessages = async (actor) => {
        const created = []
        created.push(await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: await foundry.applications.handlebars.renderTemplate(
            'systems/dcc/templates/chat-card-ability-change.html',
            { headline: 'Loses 1 Luck', reason: 'Luck spend', recovery: 'Permanent (Luck does not heal)', hpNote: '' }
          ),
          flags: { 'dcc.isAbilityScoreLog': true }
        }))
        const ffRoll = new Roll('1d100')
        await ffRoll.evaluate()
        created.push(await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: 'Friendly Fire Check',
          rolls: [ffRoll],
          content: '<div class="dcc chat-card friendly-fire">' +
            `<p>The missed shot was fired into a melee ${ffRoll.toAnchor().outerHTML}</p>` +
            '</div>',
          flags: { 'dcc.isFriendlyFire': true }
        }))
        created.push(await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: '<div class="dcc chat-card theme856-audit-extras">' +
            '<span class="dcc-modifier-breakdown">Strength +1</span>' +
            '<p><a class="inline-roll critical">20</a></p>' +
            '<p><a class="inline-roll fumble">1</a></p>' +
            '<p class="emote-alert critical">crit</p>' +
            '<p class="emote-alert fumble">fumble</p>' +
            '</div>'
        }))
        const bareRoll = new Roll('1d20')
        await bareRoll.evaluate()
        const bareAnchor = bareRoll.toAnchor().outerHTML
        created.push(await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          rolls: [bareRoll],
          content: '<div class="theme856-audit-bare">' +
            `<p>emote-style roll ${bareAnchor}</p>` +
            '<a class="content-link">Some Actor</a>' +
            `<span class="inline-roll inline-result critical">${bareAnchor}</span>` +
            '</div>'
        }))
        created.push(await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: '<div class="theme856-audit-spell">' + await foundry.applications.handlebars.renderTemplate(
            'systems/dcc/templates/chat-card-spell-result.html',
            { manifestation: { description: 'A shimmering aura surrounds the caster' }, mercurial: { description: "The caster's hair turns white" }, results: [] }
          ) + '</div>'
        }))
        created.push(await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: '<div class="theme856-audit-enricher"><p>[[/check str]]</p></div>'
        }))
        created.push(await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: '<div class="dcc-enhanced-card theme856-audit-borders">' +
            '<div class="weapon-description">Longsword, 1d8</div>' +
            '</div>'
        }))
        created.push(await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: '<div class="theme856-audit-release">' + await foundry.applications.handlebars.renderTemplate(
            'systems/dcc/templates/chat-card-release-notes.html',
            { message: 'What is new in this release' }
          ) + '</div>'
        }))
        return created
      }

      try {
        // A throwaway actor for the card speakers — same shape the #856 test
        // uses; nothing selects tokens by it.
        const auditActor = await Actor.create({ name: 'ThemeAudit Probe', type: 'Player' })
        const extraMsgs = await createAuditMessages(auditActor)
        const docs = await game.packs.get('dcc-core-book.dcc-core-tables').getDocuments()
        const table = docs.find((d) => d.name === 'Table 1-3: Occupation')
        if (!table) throw new Error('Table 1-3: Occupation not found in dcc-core-book.dcc-core-tables')

        await setScheme('dark')
        const idsBefore = new Set(game.messages.contents.map((m) => m.id))
        await table.draw()
        await sleep(500)
        const tableMsgId = game.messages.contents.map((m) => m.id).find((id) => !idsBefore.has(id))

        // A probe card mirroring the spell-check card's number-mod block
        // (`.spell-check-mod .critical/.fumble`) and a bare h3 like the core
        // welcome/onboarding cards (`.nue` "Getting Started") carry. Hand-built
        // rather than driving a real spell check (needs an actor + rolls); the
        // selectors these styles key on are what matters.
        const probeMsg = await ChatMessage.create({
          content:
          '<div class="table-draw dcc-theme-audit-probe">' +
            '<div class="table-description"><h2>Probe Description</h2></div>' +
            '<div class="spell-check-mod"><h4>+5</h4>' +
            '<p class="critical">critical</p><p class="fumble">fumble</p></div>' +
            '</div>'
        })
        const welcomeMsg = await ChatMessage.create({ content: '<h3>Getting Started</h3>' })
        await sleep(500)
        const probeMsgId = probeMsg.id
        const welcomeMsgId = welcomeMsg.id

        out.dark.tableHeadings = colors(`[data-message-id="${tableMsgId}"] .table-draw`, ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
        out.dark.probeHeadings = colors(`[data-message-id="${probeMsgId}"] .table-draw`, ['h2', 'h4'])
        out.dark.spellModCrit = colors(`[data-message-id="${probeMsgId}"] .spell-check-mod`, ['.critical'])
        out.dark.spellModFumble = colors(`[data-message-id="${probeMsgId}"] .spell-check-mod`, ['.fumble'])
        out.dark.welcomeH3 = colors(`[data-message-id="${welcomeMsgId}"] .message-content`, ['h3'])
        // Stash the audit scopes AND the ids to clean up: the Node-side
        // `auditChatCardContrast` helper
        // runs in a second evaluate AFTER this one returns, so the messages
        // must still be in the log then — deletion is deferred to stage 2.
        // Same `#chat-notifications` gotcha as `colors` above: scope the audit
        // roots inside `#chat` so we walk the sidebar cards, not the transient
        // toasts (which render light-styled on a black background and would
        // fabricate flags).
        globalThis.__dccAuditScopes = [
          `#chat [data-message-id="${tableMsgId}"] .message-content`,
          `#chat [data-message-id="${probeMsgId}"] .message-content`,
          ...extraMsgs.map((m) => `#chat [data-message-id="${m.id}"] .message-content`)
        ]
        globalThis.__dccAuditMsgs = [tableMsgId, probeMsgId, welcomeMsgId, ...extraMsgs.map((m) => m.id)]
        globalThis.__dccAuditActorId = auditActor.id

        // Light theme: the same rendered cards must keep their pre-change
        // colors — the token light values are the same literals, so this only
        // changes if someone breaks the parity.
        await setScheme('light')
        out.light.tableHeadings = colors(`[data-message-id="${tableMsgId}"] .table-draw`, ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
        out.light.probeHeadings = colors(`[data-message-id="${probeMsgId}"] .table-draw`, ['h2', 'h4'])
        out.light.spellModCrit = colors(`[data-message-id="${probeMsgId}"] .spell-check-mod`, ['.critical'])
        out.light.spellModFumble = colors(`[data-message-id="${probeMsgId}"] .spell-check-mod`, ['.fumble'])
        out.light.welcomeH3 = colors(`[data-message-id="${welcomeMsgId}"] .message-content`, ['h3'])

        return out
      } catch (err) {
        // Failure cleanup. On success the Node side audits first and deletes
        // the cards + actor in stage 2 (its try/finally); the suite afterEach
        // restores the saved uiConfig either way. The ids were stashed for
        // exactly this — id-recognized messages, no return-value shape
        // dependence.
        for (const id of globalThis.__dccAuditMsgs || []) {
          const m = game.messages.get(id)
          if (m) await m.delete().catch(() => {})
        }
        if (globalThis.__dccAuditActorId) await game.actors.get(globalThis.__dccAuditActorId)?.delete().catch(() => {})
        delete globalThis.__dccAuditScopes
        delete globalThis.__dccAuditMsgs
        delete globalThis.__dccAuditActorId
        await game.settings.set('core', 'uiConfig', cfg)
        throw err
      }
    })

    /*
     * Stage 2 — the cards were kept alive for the audit. The audit delete step
     * AND the Node-side audit itself live in a try/finally so the probe/table
     * cards and the globalThis stashes cannot outlive this test if the audit
     * evaluate rejects.
     * Scope gotcha: this is under `#chat` — `#chat-notifications` also renders
     * an (empty) `ol.chat-log` EARLIER in the DOM, and a bare `.chat-log`
     * lookup would hit that one and audit nothing. The light chat card
     * background is a parchment IMAGE rather than a backgroundColor, so when a
     * light-theme audit is ever added here it must pass a parchment-toned
     * fallback; this audit runs on the dark theme, whose fallback is the
     * `--chat-background` token value #0b0a13. The audit re-asserts the dark
     * scheme inside its own evaluate (see the helper comment — a late-landing
     * restore from an earlier step has been observed flipping the body back to
     * theme-light between evaluates).
     */
    try {
      const scopes = await page.evaluate(() => globalThis.__dccAuditScopes)
      const audit = await auditChatCardContrast(page, scopes)
      result.dark.flags = audit.flags
      result.dark.auditBody = audit.body
    } finally {
      await page.evaluate(async () => {
        for (const id of globalThis.__dccAuditMsgs || []) {
          const m = game.messages.get(id)
          if (m) await m.delete().catch(() => {})
        }
        if (globalThis.__dccAuditActorId) {
          await game.actors.get(globalThis.__dccAuditActorId)?.delete().catch(() => {})
        }
        delete globalThis.__dccAuditScopes
        delete globalThis.__dccAuditMsgs
        delete globalThis.__dccAuditActorId
      }).catch(() => {})
    }

    // Assert the required headings actually rendered so the loops below cannot
    // pass vacuously. The occupation table's card carries an h2 inside the
    // description and NO h1 (drawn table cards are body text plus the
    // description heading) — the probe card contributes the h4.
    expect(result.dark.tableHeadings).not.toBeNull()
    expect(result.dark.tableHeadings.h2, 'drawn table h2 rendered').toBeTruthy()
    expect(result.dark.probeHeadings.h4, 'probe h4 rendered').toBeTruthy()
    expect(result.light.tableHeadings.h2).toBeTruthy()
    expect(result.light.probeHeadings.h4).toBeTruthy()
    // The audit's own re-arm of the dark theme must have actually landed —
    // otherwise its flags would audit an arbitrary theme and the pass is
    // meaningless.
    expect(result.dark.auditBody).toContain('theme-dark')

    const chat = (theme, headings) => {
      for (const [tag, color] of Object.entries(headings)) {
        expect(color, `${theme} table-draw ${tag}`).toBe(theme === 'dark' ? DARK_TEXT : LIGHT_TEXT)
      }
    }
    chat('dark', result.dark.tableHeadings)
    chat('dark', result.dark.probeHeadings)
    chat('light', result.light.tableHeadings)
    chat('light', result.light.probeHeadings)

    // Welcome-card style h3 follows the chat color in both themes.
    expect(result.dark.welcomeH3.h3).toBe(DARK_TEXT)
    expect(result.light.welcomeH3.h3).toBe(LIGHT_TEXT)

    // The spell-check mod block's crit/fumble accents follow the tokens.
    expect(result.dark.spellModCrit['.critical']).toBe(CRIT_GREEN_DARK)
    expect(result.dark.spellModFumble['.fumble']).toBe(FUMBLE_RED_DARK)
    expect(result.light.spellModCrit['.critical']).toBe(CRIT_GREEN_LIGHT)
    expect(result.light.spellModFumble['.fumble']).toBe(FUMBLE_RED_LIGHT)

    // Zero contrast flags across every text node of the drawn table and the
    // probe card, against the dark chat background.
    expect(result.dark.flags, `contrast flags: ${JSON.stringify(result.dark.flags)}`).toEqual([])
  })

  /*
   * With `chatCardsUseAppTheme` off, `chat-cards-use-ui-theme` on body makes the
   * card follow the INTERFACE theme. The crit/fumble accents must follow it too,
   * or a mixed scheme pairs one theme's accent with the other's card — app-dark /
   * UI-light would put the light-green #7ddb63 on parchment. Same for the
   * dark-theme chip strip on bare (non-`.dcc`) content links.
   */
  test('crit/fumble accents and link chips follow the UI theme under chat-cards-use-ui-theme', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const out = {}
      const cfg = game.settings.get('core', 'uiConfig')
      globalThis.__dccSavedUiConfig = cfg
      const hadClass = document.body.classList.contains('chat-cards-use-ui-theme')
      document.body.classList.add('chat-cards-use-ui-theme')
      let msg
      const measure = async (applications, ui) => {
        await game.settings.set('core', 'uiConfig', {
          ...cfg,
          colorScheme: { ...(cfg.colorScheme || {}), interface: ui, applications }
        })
        await new Promise(resolve => setTimeout(resolve, 800))
        const read = (sel) => {
          const el = document.querySelector(`#chat [data-message-id="${msg.id}"] ${sel}`)
          return el ? getComputedStyle(el).color : null
        }
        const link = document.querySelector(`#chat [data-message-id="${msg.id}"] .message-content > a.content-link`)
        return {
          interfaceClass: document.getElementById('interface')?.className,
          crit: read('.emote-alert.critical'),
          fumble: read('.emote-alert.fumble'),
          linkBackground: link ? getComputedStyle(link).backgroundColor : null
        }
      }
      try {
        msg = await ChatMessage.create({
          content: '<div class="dcc chat-card theme948-ui-theme">' +
            '<p class="emote-alert critical">crit</p>' +
            '<p class="emote-alert fumble">fumble</p>' +
            '</div>' +
            // Outside the `.dcc` wrapper, which strips the chip in both themes.
            '<a class="content-link">Probe Link</a>'
        })
        out.appDarkUiLight = await measure('dark', 'light')
        out.appLightUiDark = await measure('light', 'dark')
      } finally {
        if (!hadClass) document.body.classList.remove('chat-cards-use-ui-theme')
        await msg?.delete().catch(() => {})
        await game.settings.set('core', 'uiConfig', cfg)
      }
      return out
    })

    const debug = JSON.stringify(result)
    expect(result.appDarkUiLight.crit, debug).toBe(CRIT_GREEN_LIGHT)
    expect(result.appDarkUiLight.fumble, debug).toBe(FUMBLE_RED_LIGHT)
    expect(result.appLightUiDark.crit, debug).toBe(CRIT_GREEN_DARK)
    expect(result.appLightUiDark.fumble, debug).toBe(FUMBLE_RED_DARK)
    // Light card keeps core's chip; dark card strips it.
    expect(result.appDarkUiLight.linkBackground, debug).toBeTruthy()
    expect(result.appDarkUiLight.linkBackground, debug).not.toBe(TRANSPARENT)
    expect(result.appLightUiDark.linkBackground, debug).toBe(TRANSPARENT)
  })
})

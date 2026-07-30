/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Chat-card text color across the light / dark themes (issue #856).
 *
 * `.dcc` (styles/_base.scss) colors card bodies with `--system-primary-color`,
 * the SHEET color. Foundry stamps `theme-light` on `ol.chat-log`, which
 * re-establishes the light variable block from styles/variables.css for that
 * whole subtree — so inside the chat log `--system-primary-color` resolves to
 * the light value (#222) whatever the active theme is. Cards that set no color
 * of their own therefore rendered near-black on the dark chat background: the
 * friendly-fire card and the ability-score-log ("Luck spend") card, plus the
 * inline roll inside the former (DCC strips Foundry's light chip background from
 * inline rolls, so their text sits straight on the card).
 *
 * `styles/_chat.scss` now points DCC card bodies, inline rolls and content links
 * at `--chat-primary-color`, which variables.css defines on `body` precisely so
 * chat cards follow the app theme rather than the chat log's own stamp.
 *
 * Asserted against real rendered messages in both themes: the body text must
 * match the header (i.e. the theme's chat color), and in dark theme must NOT be
 * the light #222.
 */
const test = createSessionTest()

const LIGHT_TEXT = 'rgb(34, 34, 34)' // #222 — the light-theme chat/sheet color
const DARK_TEXT = 'rgb(208, 190, 170)' // #d0beaa — the dark-theme chat color
const CRIT_GREEN = 'rgb(0, 128, 0)'
const FUMBLE_RED = 'rgb(255, 0, 0)'

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
          critWrapperAnchor: read('.theme856-bare span.inline-roll.critical a.inline-roll')
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

    // Crit / fumble stay green / red in BOTH themes. The inline-roll rule is more
    // specific than `.inline-roll.critical`, so without the `:not()` exclusions
    // in styles/_chat.scss a natural 20 would render as ordinary body text; and
    // because it resolves to `inherit`, the anchor nested inside a crit WRAPPER
    // span picks up the span's green rather than being recolored.
    for (const theme of ['dark', 'light']) {
      expect(result[theme].critInlineRoll, `${theme} crit inline roll`).toBe(CRIT_GREEN)
      expect(result[theme].fumbleInlineRoll, `${theme} fumble inline roll`).toBe(FUMBLE_RED)
      expect(result[theme].critEmote, `${theme} crit emote`).toBe(CRIT_GREEN)
      expect(result[theme].fumbleEmote, `${theme} fumble emote`).toBe(FUMBLE_RED)
      expect(result[theme].critWrapperSpan, `${theme} crit wrapper span`).toBe(CRIT_GREEN)
      expect(result[theme].critWrapperAnchor, `${theme} crit wrapper anchor`).toBe(CRIT_GREEN)
    }
  })
})

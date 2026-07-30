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

test.describe('Chat card text color', () => {
  test('DCC card bodies follow the chat theme in both light and dark', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const out = {}
      const cfg = game.settings.get('core', 'uiConfig')
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
          inlineRollIcon: read('.friendly-fire a.inline-roll > i')
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

    // Light theme is unchanged — both variables are #222 there.
    expect(result.light.messageHeader).toBe(LIGHT_TEXT)
    expect(result.light.abilityHeadline).toBe(LIGHT_TEXT)
    expect(result.light.abilityReason).toBe(LIGHT_TEXT)
    expect(result.light.abilityRecovery).toBe(LIGHT_TEXT)
    expect(result.light.friendlyFireText).toBe(LIGHT_TEXT)
    expect(result.light.inlineRoll).toBe(LIGHT_TEXT)
    expect(result.light.inlineRollIcon).toBe(LIGHT_TEXT)
  })
})

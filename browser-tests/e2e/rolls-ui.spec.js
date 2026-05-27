/* eslint-disable no-undef -- Browser globals (game, Actor, ui) used in page.evaluate callbacks */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Basic UI smoke tests: open a character sheet, click a roll control, and
 * assert a chat card with a roll lands. This is the click-through layer the
 * other specs don't cover — `adapter-dispatch.spec.js` drives the DCCActor
 * roll *methods* directly and asserts dispatch; here we exercise the actual
 * sheet DOM → action → chat path a player uses.
 *
 * Rolls are forced direct (no modifier dialog) by turning off the
 * `showRollModifierByDefault` setting in beforeEach, so a plain click rolls
 * immediately. Ability + save controls live on the main sheet tab of every
 * Player and are the most stable smoke targets; weapon/skill rolls need item
 * or class fixtures and can be layered on later.
 *
 * Setup: see docs/dev/TESTING.md#browser-tests-playwright. TL;DR:
 *   nvm use 24 && npx @foundryvtt/foundryvtt-cli launch --world=v14
 *   cd browser-tests/e2e && npm test -- rolls-ui.spec.js
 */

const consoleErrors = []
const test = createSessionTest({
  onConsole: msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) }
})

test.describe('DCC Rolls — UI smoke', () => {
  test.beforeEach(async ({ page }) => {
    // World hygiene + force direct rolls (no roll-modifier dialog) so a plain
    // click on a roll control produces a chat card deterministically.
    await page.evaluate(async () => {
      for (const app of Object.values(ui.windows)) { try { await app.close() } catch {} }
      document.querySelectorAll('#notifications .notification').forEach(n => n.remove())
      for (const a of game.actors.filter(a => a.name.startsWith('SMOKE '))) { try { await a.delete() } catch {} }
      try { await game.settings.set('dcc', 'showRollModifierByDefault', false) } catch {}
    }).catch(() => {})
    consoleErrors.length = 0
  })

  test.afterEach(async ({ page }) => {
    await page.evaluate(async () => {
      for (const app of Object.values(ui.windows)) { try { await app.close() } catch {} }
      for (const a of game.actors.filter(a => a.name.startsWith('SMOKE '))) { try { await a.delete() } catch {} }
    }).catch(() => {})
  })

  /** Create a Player, open its sheet, and wait for the body to render. */
  async function openSmokeSheet (page, name) {
    await page.evaluate(async (n) => {
      await Actor.create({
        name: n,
        type: 'Player',
        system: {
          abilities: {
            str: { value: 14 },
            agl: { value: 12 },
            sta: { value: 13 },
            per: { value: 10 },
            int: { value: 11 },
            lck: { value: 9 }
          }
        }
      })
    }, name)
    await page.click('button[data-tab="actors"]')
    await page.waitForSelector('#actors.active', { timeout: 5000 })
    await page.click(`.entry-name:has-text("${name}")`)
    await page.waitForSelector('.dcc.actor.sheet', { timeout: 10000 })
    await page.waitForSelector('.dcc.actor.sheet [data-action]', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(750)
  }

  /** Click a roll control and assert a new chat message carrying a roll appears. */
  async function clickRollAndExpectChat (page, selector, label) {
    const before = await page.evaluate(() => game.messages.size)
    await page.locator(selector).first().click()
    await page.waitForFunction(
      n => game.messages.size > n,
      before,
      { timeout: 10000 }
    )
    const last = await page.evaluate(() => {
      const m = game.messages.contents[game.messages.size - 1]
      return {
        hasRolls: (m?.rolls?.length ?? 0) > 0,
        contentLen: (m?.content ?? '').length,
        flavor: m?.flavor ?? ''
      }
    })
    expect(
      last.hasRolls || last.contentLen > 0,
      `${label}: expected a chat card with roll content (flavor="${last.flavor}")`
    ).toBeTruthy()
  }

  test('ability check from the sheet posts a chat card', async ({ page }) => {
    await openSmokeSheet(page, 'SMOKE Ability')
    await clickRollAndExpectChat(
      page,
      '.dcc.actor.sheet .ability-box[data-ability="str"] [data-action="rollAbilityCheck"]',
      'Strength check'
    )
  })

  test('saving throw from the sheet posts a chat card', async ({ page }) => {
    await openSmokeSheet(page, 'SMOKE Save')
    await clickRollAndExpectChat(
      page,
      '.dcc.actor.sheet .saving-throw-box[data-save="ref"] [data-action="rollSavingThrow"]',
      'Reflex save'
    )
  })
})

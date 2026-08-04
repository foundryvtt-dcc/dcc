/* eslint-disable no-undef -- Browser globals (game, Actor, Scene, ui) used in page.evaluate callbacks */
const { expect, createSessionTest, openActorSheet, significantConsoleErrors } = require('./fixtures')

/**
 * Party Sheet E2E tests (#789 — Roll Party Initiative).
 *
 * Drives the party sheet DOM → data-action path for the party-header
 * Roll Initiative button:
 *   - the button renders in the party-name header row
 *   - clicking it adds the party token to the combat tracker with a rolled
 *     initiative, using the BEST member's initiative formula (highest derived
 *     init bonus)
 *   - the no-token guard warns instead of silently doing nothing
 *
 * Unit coverage for best-member selection / tie-breaks / the other guards
 * lives in module/__tests__/party-sheet.test.js.
 *
 * Probe actors are prefixed `PARTY `. Combats are deleted before and after
 * each test — the shared session's world is reused across specs.
 */

const consoleErrors = []
const test = createSessionTest({
  onConsole: msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) }
})

/** Delete probe actors, combats, and open windows left over from a test. */
async function cleanProbeState (page) {
  await page.evaluate(async () => {
    // ApplicationV2 windows (the party sheet) live in foundry.applications.instances,
    // AppV1 windows in ui.windows — close both. Only close FRAMED AppV2 apps:
    // the sidebar/hotbar/etc. are frameless instances in the same registry and
    // closing them breaks the session. The probe scene is deliberately left in
    // place (deleting a viewed scene re-inits the canvas; see fixtures.js).
    for (const app of [...foundry.applications.instances.values()]) {
      try { if (app.hasFrame) await app.close() } catch {}
    }
    for (const app of Object.values(ui.windows)) { try { await app.close() } catch {} }
    document.querySelectorAll('#notifications .notification').forEach(n => n.remove())
    for (const c of [...game.combats.contents]) { try { await c.delete() } catch {} }
    for (const a of game.actors.filter(a => /^PARTY /.test(a.name))) { try { await a.delete() } catch {} }
  }).catch(() => {})
}

/**
 * Create two Player members (Alice agl 17 → init +2 is the best, Bob agl 8 →
 * init -1) and a Party actor containing both, via the default creation path —
 * the preCreate hook must link the party prototype token (#789). Returns
 * their ids and the resulting actorLink so the test can assert the hook ran.
 */
async function createParty (page) {
  return await page.evaluate(async () => {
    const alice = await Actor.create({
      name: 'PARTY Alice',
      type: 'Player',
      system: { abilities: { agl: { value: 17 } } }
    })
    const bob = await Actor.create({
      name: 'PARTY Bob',
      type: 'Player',
      system: { abilities: { agl: { value: 8 } } }
    })
    const party = await Actor.create({
      name: 'PARTY Test Party',
      type: 'Party',
      flags: { dcc: { partyMembers: [{ id: bob.id }, { id: alice.id }] } }
    })
    return {
      aliceId: alice.id,
      bobId: bob.id,
      partyId: party.id,
      partyActorLink: party.prototypeToken.actorLink
    }
  })
}

test.describe('Party Sheet — Roll Party Initiative', () => {
  test.beforeEach(async ({ page }) => {
    await cleanProbeState(page)
    consoleErrors.length = 0
  })

  test.afterEach(async ({ page }) => {
    await cleanProbeState(page)
    const errors = significantConsoleErrors(consoleErrors)
    expect(errors, `Console errors detected: ${errors.join('\n')}`).toHaveLength(0)
  })

  test('button rolls initiative for the party token using the best member formula', async ({ page }) => {
    const { partyId, partyActorLink } = await createParty(page)

    // The preCreate hook links party prototype tokens by default (#789) —
    // without this, core's Actor#rollInitiative would skip the synthetic
    // token actor and the button would silently not roll.
    expect(partyActorLink).toBe(true)

    // Ensure a viewed scene, then place a party token from its prototype
    // (mirrors dragging the actor onto the map) and wait for its placeable —
    // getActiveTokens() reads canvas placeables.
    await page.evaluate(async (pid) => {
      if (!game.canvas?.ready || !game.canvas?.scene) {
        const scene = await Scene.create({
          name: 'DCC Party Probe',
          width: 3000,
          height: 3000,
          grid: { type: 1, size: 100, distance: 5, units: 'ft' }
        })
        await scene.view()
      }
      const party = game.actors.get(pid)
      const tokenData = (await party.getTokenDocument({ x: 1000, y: 1000 })).toObject()
      const [doc] = await game.canvas.scene.createEmbeddedDocuments('Token', [tokenData])
      const deadline = Date.now() + 4000
      while (Date.now() < deadline && !game.canvas.tokens.get(doc.id)) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }, partyId)

    await openActorSheet(page, 'PARTY Test Party')
    const button = page.locator('.dcc.actor.party a[data-action="rollPartyInitiative"]')
    await expect(button).toBeVisible()

    // Record the latest initiative chat card so a stale one from an earlier
    // spec can't satisfy the wait below. In-page click — overlays can hang
    // Playwright pointer clicks (see docs/dev/TESTING.md); the reused session
    // may have chat notifications up.
    const baselineMessageId = await page.evaluate(() => {
      const last = game.messages.contents.findLast(m => m.getFlag('core', 'initiativeRoll'))
      document.querySelector('.dcc.actor.party a[data-action="rollPartyInitiative"]').click()
      return last?.id ?? null
    })

    // Poll for the rolled combatant AND a NEW initiative chat card —
    // ChatMessage.create is fire-and-forget, never read it un-polled.
    await page.waitForFunction(({ pid, baselineId }) => {
      const combat = game.combats.contents[0]
      const combatant = combat?.combatants.find(c => c.actor?.id === pid)
      const initMessage = game.messages.contents.findLast(m => m.getFlag('core', 'initiativeRoll'))
      return !!combatant && combatant.initiative !== null &&
        !!initMessage && initMessage.id !== baselineId
    }, { pid: partyId, baselineId: baselineMessageId }, { timeout: 15000 })

    const result = await page.evaluate((pid) => {
      const combat = game.combats.contents[0]
      const combatant = combat.combatants.find(c => c.actor?.id === pid)
      const initMessage = game.messages.contents.findLast(m => m.getFlag('core', 'initiativeRoll'))
      return {
        initiative: combatant.initiative,
        formula: initMessage?.rolls?.[0]?.formula ?? ''
      }
    }, partyId)

    expect(typeof result.initiative).toBe('number')
    // Best member is Alice: agl 17 → derived init bonus +2 (Bob is -1).
    expect(result.formula).toMatch(/1d20\s*\+\s*2/)
  })

  test('warns instead of rolling when the party has no token in the scene', async ({ page }) => {
    await createParty(page)
    await openActorSheet(page, 'PARTY Test Party')

    const result = await page.evaluate(async () => {
      const warns = []
      const originalWarn = ui.notifications.warn
      ui.notifications.warn = (message) => { warns.push(String(message)) }
      try {
        document.querySelector('.dcc.actor.party a[data-action="rollPartyInitiative"]').click()
        // The handler is async; give the guard a beat to fire.
        const deadline = Date.now() + 3000
        while (Date.now() < deadline && warns.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      } finally {
        ui.notifications.warn = originalWarn
      }
      return {
        warns,
        combats: game.combats.size,
        expectedWarning: game.i18n.localize('DCC.PartyNoTokenWarning')
      }
    })

    expect(result.warns).toContain(result.expectedWarning)
    expect(result.combats).toBe(0)
  })
})

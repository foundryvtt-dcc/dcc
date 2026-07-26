/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest, assertFoundryUp } = require('./fixtures')

const test = createSessionTest()

/**
 * Actor importer E2E tests (#817).
 *
 * Drives `createActors` (module/parser.js) end-to-end against the live
 * dcc-core-book compendium packs, using real current Purple Sorcerer JSON
 * output. Purple Sorcerer appends prices to equipment names ("Backpack
 * (2 gp)") and uses different punctuation than the pack names ("Rope - 50'"
 * vs "Rope, 50’"), and containers could never remap because the importer
 * creates all goods as generic equipment items. This spec pins the whole
 * pipeline: price stripping, normalized pack matching, container remap, and
 * price retention on unmatched items.
 *
 * Setup: see docs/dev/TESTING.md#browser-tests-playwright. TL;DR:
 *   npx @foundryvtt/foundryvtt-cli launch --world=v14
 *   cd browser-tests/e2e && npm test -- actor-import.spec.js
 */

test.describe('DCC Actor Importer', () => {
  test.beforeAll(async () => {
    await assertFoundryUp()
  })

  test.beforeEach(async ({ page }) => {
    // World-state hygiene (session page is reused across tests): close stray
    // windows, drop notification banners, and purge probe actors left behind
    // by failed prior runs.
    await page.evaluate(async () => {
      for (const app of Object.values(foundry.applications.instances ?? {})) {
        if (app?.close) await app.close().catch(() => {})
      }
      document.querySelectorAll('#notifications .notification').forEach(n => n.remove())
      const stale = game.actors.filter(a => a.name.startsWith('P817'))
      for (const actor of stale) await actor.delete().catch(() => {})
    })
  })

  test('imports Purple Sorcerer JSON with priced goods, remapping to compendium items (#817)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { default: parser } = await import('../../../../../../../../systems/dcc/module/parser.js')
      const observed = {}
      let actor
      try {
        // Real (abridged) Purple Sorcerer zero-level JSON, current output
        // format: prices appended to equipment names, PS punctuation.
        const psJson = JSON.stringify({
          characters: [{
            name: 'P817 Import Probe',
            occTitle: 'Ostler',
            strengthScore: '7',
            agilityScore: '16',
            staminaScore: '9',
            personalityScore: '12',
            intelligenceScore: '11',
            luckScore: '11',
            armorClass: '12',
            hitPoints: '1',
            weapon: 'Staff',
            attackMod: '-1',
            attackDamage: '1d4-1',
            speed: '30',
            initiative: '2',
            saveReflex: '2',
            saveFort: '0',
            saveWill: '0',
            equipment: "Rope - 50' (25 cp)",
            equipment2: 'Backpack (2 gp)',
            equipment3: 'Rations (1 day) (5 cp)',
            tradeGood: 'Jar of honey (25 gp)',
            startingFunds: '34 cp',
            languages: 'Common'
          }]
        })

        const actors = await parser.createActors('Player', null, psJson)
        observed.actorCount = actors.length
        actor = actors[0]

        const byName = (name) => actor.items.find(i => i.name === name)

        // "Rope - 50' (25 cp)" → matched to the pack's "Rope, 50’" despite
        // the price suffix, hyphen-vs-comma, and straight-vs-curly apostrophe.
        const rope = byName('Rope, 50’')
        observed.rope = rope ? { type: rope.type, cp: rope.system.value.cp } : null

        // "Backpack (2 gp)" → the pack's Backpack, imported as a CONTAINER
        // with the compendium price (2 gp) — the core bug in #817.
        const backpack = byName('Backpack')
        observed.backpack = backpack ? { type: backpack.type, gp: backpack.system.value.gp } : null

        // "Rations (1 day) (5 cp)" → name-mapped to "Rations, per day".
        const rations = byName('Rations, per day')
        observed.rations = rations ? { type: rations.type } : null

        // Trade goods aren't in any pack: stays generic equipment, but keeps
        // the parsed price instead of it being baked into the name.
        const honey = byName('Jar of honey')
        observed.honey = honey ? { type: honey.type, gp: honey.system.value.gp } : null
        observed.hasPricedNames = actor.items.some(i => / \(\d+ (?:pp|ep|gp|sp|cp)\)/.test(i.name))
      } finally {
        if (actor) await actor.delete().catch(() => {})
      }
      return observed
    })

    expect(result.actorCount).toBe(1)
    // Compendium price (25 cp) comes along with the remapped item
    expect(result.rope).toEqual({ type: 'equipment', cp: '25' })
    expect(result.backpack).toEqual({ type: 'container', gp: '2' })
    expect(result.rations).toEqual({ type: 'equipment' })
    expect(result.honey).toEqual({ type: 'equipment', gp: '25' })
    expect(result.hasPricedNames).toBe(false)
  })
})

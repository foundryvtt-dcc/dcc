/* eslint-disable no-undef -- Browser globals (game, Actor, Item) used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Custom-class level data — world-item fallback (module/actor-level-change.js)
 * end-to-end against live Foundry. Mirrors the crit/fumble table resolvers'
 * `game.tables` fallback: the level-up dialog's `_lookupLevelItem` resolves a
 * `{class}-{level}` level item from the registered `CONFIG.DCC.levelDataPacks`
 * first, then falls back to an UNREGISTERED `level`-type Item sitting loose in
 * the world's Items sidebar. This proves a homebrew class works with no pack
 * registration at all, using the live-served module so the deployed code path
 * is what is exercised. Uses a `level`-name prefix (`e2e-bloodwitch`) that no
 * shipped pack claims, so the world item is the only possible match.
 */
const test = createSessionTest()

test.describe('Custom class level-data world-item fallback', () => {
  test('_lookupLevelItem resolves an unregistered world level item by name', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { default: DCCActorLevelChange } =
        await import('../../../../../../../../systems/dcc/module/actor-level-change.js')

      let worldItem, decoyItem, actor
      try {
        // A `level` item in the world Items sidebar — NOT inside any registered
        // levelDataPack. Named per the {class}-{level} convention (lowercased).
        worldItem = await Item.create({
          name: 'e2e-bloodwitch-1',
          type: 'level',
          system: { levelData: 'system.attributes.hitDice.value=1d30' }
        })
        // A same-named non-`level` item that the type filter must skip.
        decoyItem = await Item.create({ name: 'e2e-bloodwitch-1', type: 'weapon' })

        actor = await Actor.create({ name: 'P_LevelFallback', type: 'Player' })
        const dialog = new DCCActorLevelChange({ document: actor })

        const found = await dialog._lookupLevelItem('e2e-bloodwitch', 1)
        const spaced = await dialog._lookupLevelItem('e2e bloodwitch', 1) // spaces → hyphens
        const miss = await dialog._lookupLevelItem('e2e-nosuchclass', 1)

        return {
          worldItemId: worldItem.id,
          foundId: found?.id ?? null,
          foundType: found?.type ?? null,
          foundLevelData: found?.system?.levelData ?? null,
          spacedId: spaced?.id ?? null,
          missIsEmptyObject:
            miss && typeof miss === 'object' && Object.keys(miss).length === 0
        }
      } finally {
        await actor?.delete()
        await worldItem?.delete()
        await decoyItem?.delete()
      }
    })

    // The world item is resolved even though it was never registered.
    expect(result.foundId).toBe(result.worldItemId)
    expect(result.foundType).toBe('level')
    expect(result.foundLevelData).toContain('1d30')
    // Class names with spaces normalize to the hyphenated item name.
    expect(result.spacedId).toBe(result.worldItemId)
    // No match anywhere still returns the empty-object sentinel.
    expect(result.missIsEmptyObject).toBe(true)
  })

  test('levelling up rolls one hit die + Stamina per level, minimum 1 each (#983)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { default: DCCActorLevelChange } =
        await import('../../../../../../../../systems/dcc/module/actor-level-change.js')

      const items = []
      let actor, dialog
      const savedUniform = CONFIG.Dice.randomUniform
      try {
        for (const level of [2, 3]) {
          items.push(await Item.create({
            name: `e2e-hpwitch-${level}`,
            type: 'level',
            system: { levelData: 'system.attributes.hitDice.value=1d6' }
          }))
        }
        // Stamina 5 is a -2 modifier: a 1 on the hit die would be -1 HP
        // without the minimum, and the old single expression rolled
        // 2d6-4 for two levels
        actor = await Actor.create({
          name: 'P_LevelHp',
          type: 'Player',
          system: {
            class: { className: 'e2e-hpwitch' },
            details: { level: { value: 1 } },
            abilities: { sta: { value: 5, max: 5 } },
            attributes: { hp: { value: 10, max: 10 } }
          }
        })
        const staMod = actor.system.abilities.sta.mod

        dialog = new DCCActorLevelChange({ document: actor })
        await dialog.render(true)
        dialog.currentLevel = 3
        await dialog._updateLevelUpDisplay()
        const formula = dialog.newHitPointsExpression

        // Every hit die lands on 1
        CONFIG.Dice.randomUniform = () => 0.9
        const before = game.messages.contents.length
        dialog.element.requestSubmit()

        let updated = false
        for (let i = 0; i < 100 && !updated; i++) {
          await new Promise(resolve => setTimeout(resolve, 50))
          updated = actor.system.details.level.value === 3
        }
        CONFIG.Dice.randomUniform = savedUniform

        const hpMessage = game.messages.contents.slice(before).find(m => m.rolls?.length)
        const hpRoll = hpMessage?.rolls[0]
        return {
          staMod,
          formula,
          level: actor.system.details.level.value,
          hp: actor.system.attributes.hp.value,
          hpMax: actor.system.attributes.hp.max,
          rollFormula: hpRoll?.formula ?? null,
          rollTotal: hpRoll?.total ?? null,
          dice: hpRoll?.dice.flatMap(d => d.results.map(r => r.result)) ?? null
        }
      } finally {
        CONFIG.Dice.randomUniform = savedUniform
        await dialog?.close()
        await actor?.delete()
        for (const item of items) await item.delete()
      }
    })

    expect(result.staMod).toBe(-2)
    expect(result.formula).toBe('max(1, 1d6-2) + max(1, 1d6-2)')
    expect(result.level).toBe(3)
    // Two levels, each 1 - 2 raised to the minimum of 1
    expect(result.dice).toEqual([1, 1])
    expect(result.rollTotal).toBe(2)
    expect(result.hp).toBe(12)
    expect(result.hpMax).toBe(12)
  })
})

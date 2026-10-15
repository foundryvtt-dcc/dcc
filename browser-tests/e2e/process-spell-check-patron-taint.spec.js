/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Patron taint through the stable `game.dcc.processSpellCheck` API (#981).
 *
 * XCC's class sheets cast through `processSpellCheck` rather than the
 * adapter, so it must follow the same lib rule: on acquisition the chance
 * resets to 1% and the patron's taint table is rolled; on a miss the chance
 * goes up by 1%.
 *
 * Dice are forced by patching DiceTerm.prototype._roll by die size.
 */
const test = createSessionTest()

const scenarioFn = `async ({ chance, d100, d6 }) => {
  const observed = {}
  const tag = Math.random().toString(36).slice(2, 8)
  const patron = 'P981 Patron ' + tag
  let actor, resultsTable, taintTable
  const proto = foundry.dice.terms.DiceTerm.prototype
  const origRoll = proto._roll
  try {
    resultsTable = await RollTable.create({
      name: 'P981 Results ' + tag,
      formula: '1d20',
      results: Array.from({ length: 30 }, (_, i) => ({
        type: CONST.TABLE_RESULT_TYPES.TEXT,
        range: [i + 1, i + 1],
        description: 'p981 result ' + (i + 1),
        weight: 1
      }))
    })
    taintTable = await RollTable.create({
      name: 'Patron Taint: ' + patron,
      formula: '1d6',
      results: Array.from({ length: 6 }, (_, i) => ({
        type: CONST.TABLE_RESULT_TYPES.TEXT,
        range: [i + 1, i + 1],
        description: 'p981 taint row ' + (i + 1),
        weight: 1
      }))
    })
    actor = await Actor.create({
      type: 'Player',
      name: 'P981 Wizard ' + tag,
      system: {
        class: { className: 'Wizard', patron, patronTaintChance: chance + '%' },
        details: { sheetClass: 'Wizard' }
      }
    })
    const [item] = await actor.createEmbeddedDocuments('Item', [{
      type: 'spell',
      name: 'Invoke Patron',
      system: { level: 1, config: { castingMode: 'wizard' } }
    }])

    proto._roll = async function () {
      if (this.faces === 100) return d100
      if (this.faces === 6) return d6
      return 12
    }
    const roll = new Roll('1d20')
    await roll.evaluate()
    const start = Date.now()
    await game.dcc.processSpellCheck(actor, { roll, item, rollTable: resultsTable, flavor: 'P981 cast' })
    proto._roll = origRoll

    for (let i = 0; i < 80 && !observed.card; i++) {
      const message = game.messages.contents.findLast((m) =>
        m.timestamp >= start && (m.content || '').includes('p981 result'))
      if (message) observed.card = message.content
      else await new Promise((resolve) => setTimeout(resolve, 25))
    }
    observed.chance = actor.system.class.patronTaintChance
  } finally {
    proto._roll = origRoll
    if (actor) await actor.delete().catch(() => {})
    if (resultsTable) await resultsTable.delete().catch(() => {})
    if (taintTable) await taintTable.delete().catch(() => {})
  }
  return observed
}`

async function runScenario (page, args) {
  return page.evaluate(async ({ src, args }) => {
    // eslint-disable-next-line no-eval
    const scenario = eval(`(${src})`)
    return scenario(args)
  }, { src: scenarioFn, args })
}

test.describe('processSpellCheck patron taint (#981)', () => {
  test('acquiring taint resets the chance to 1% and rolls the patron taint table', async ({ page }) => {
    const observed = await runScenario(page, { chance: 5, d100: 1, d6: 2 })

    expect(observed.chance).toBe('1%')
    expect(observed.card).toContain('p981 taint row 2')
    expect(observed.card).toContain('Patron Taint chance reset to: 1%')
  })

  test('missing the check raises the chance by 1%', async ({ page }) => {
    const observed = await runScenario(page, { chance: 3, d100: 50, d6: 2 })

    expect(observed.chance).toBe('4%')
    expect(observed.card).toContain('Patron Taint chance increased to: 4%')
    expect(observed.card).not.toContain('p981 taint row')
  })
})

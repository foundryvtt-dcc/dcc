/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Cleric disapproval roll (issue #961).
 *
 * RAW (core rulebook, Table 5-7): roll 1d4 per point of the natural
 * spell-check roll, reduced by the cleric's Luck modifier. Every caller
 * shares `DCCActor.rollDisapproval`, which rolls the dice in Foundry and
 * resolves them through the lib's `rollDisapproval`. A cleric spell cast
 * used to roll 1d4 × range inside the lib instead, and raised the range
 * twice for an in-range natural above 1.
 *
 * Dice are forced by patching DiceTerm.prototype._roll, so every die in a
 * patched call returns the same face.
 */
const test = createSessionTest()

const scenarioFn = `async ({ mode, disapproval, luck, face, natural }) => {
  const observed = {}
  const tableName = 'P961 Disapproval ' + Math.random().toString(36).slice(2, 8)
  const priorAutomate = game.settings.get('dcc', 'automateClericDisapproval')
  let actor, table
  try {
    await game.settings.set('dcc', 'automateClericDisapproval', true)
    table = await RollTable.create({
      name: tableName,
      formula: '1d20',
      results: Array.from({ length: 20 }, (_, i) => ({
        type: CONST.TABLE_RESULT_TYPES.TEXT,
        range: [i + 1, i + 1],
        description: 'p961 row ' + (i + 1),
        weight: 1
      }))
    })
    actor = await Actor.create({
      type: 'Player',
      name: 'P961 Cleric',
      system: {
        abilities: { lck: { value: luck, max: luck } },
        class: { className: 'Cleric', disapproval, disapprovalTable: tableName },
        details: { sheetClass: 'Cleric' }
      }
    })

    const proto = foundry.dice.terms.DiceTerm.prototype
    const origRoll = proto._roll
    try {
      if (mode === 'cast') {
        const [spell] = await actor.createEmbeddedDocuments('Item', [{
          type: 'spell',
          name: 'P961 Blessing',
          system: { level: 1, config: { castingMode: 'cleric' } }
        }])
        // The d20 lands on the natural; the disapproval d4s on the face.
        proto._roll = async function () { return this.faces === 20 ? natural : face }
        await spell.rollSpellCheck()
      } else {
        proto._roll = async function () { return face }
        await actor.rollDisapproval(natural)
      }
    } finally {
      proto._roll = origRoll
    }

    for (let i = 0; i < 80; i++) {
      const message = game.messages.contents.findLast((m) =>
        m.speaker?.actor === actor.id && m.getFlag('dcc', 'RollType') === 'Disapproval')
      if (message && (mode !== 'cast' || actor.system.class.disapproval !== disapproval)) {
        observed.lib = message.getFlag('dcc', 'libDisapproval')
        observed.flavor = message.flavor
        observed.total = message.rolls?.[0]?.total
        observed.formula = message.rolls?.[0]?.formula
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    // Let any second range bump land before reading the range.
    await new Promise((resolve) => setTimeout(resolve, 250))
    observed.range = actor.system.class.disapproval
    observed.luckMod = actor.system.abilities.lck.mod
  } finally {
    await game.settings.set('dcc', 'automateClericDisapproval', priorAutomate)
    if (actor) await actor.delete().catch(() => {})
    if (table) await table.delete().catch(() => {})
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

test.describe('Cleric disapproval roll (#961)', () => {
  test('a cleric spell cast rolls (natural)d4 minus Luck and raises the range once', async ({ page }) => {
    // Natural 3 inside range 4, Luck 16 (+2), every d4 shows 3: 9 − 2 = 7.
    const observed = await runScenario(page, { mode: 'cast', disapproval: 4, luck: 16, face: 3, natural: 3 })

    expect(observed.luckMod).toBe(2)
    expect(observed.lib).toMatchObject({ roll: 7, formula: '3d4', luckModifier: 2, description: 'p961 row 7' })
    expect(observed.total).toBe(7)
    expect(observed.flavor).toContain('p961 row 7')
    expect(observed.range).toBe(5) // 4 → 5, not 6
  })

  test('Luck pushing the roll below 1 still draws row 1', async ({ page }) => {
    // Natural 1, Luck 18 (+3), the d4 shows 1: 1 − 3 = −2 → row 1.
    const observed = await runScenario(page, { mode: 'direct', disapproval: 1, luck: 18, face: 1, natural: 1 })

    expect(observed.luckMod).toBe(3)
    expect(observed.total).toBe(-2)
    expect(observed.lib).toMatchObject({ roll: -2, formula: '1d4', luckModifier: 3, description: 'p961 row 1' })
    expect(observed.flavor).toContain('p961 row 1')
  })
})

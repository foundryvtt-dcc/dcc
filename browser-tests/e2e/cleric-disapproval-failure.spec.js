/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Cleric disapproval-range auto-failure (issue #874).
 *
 * DCC RAW (core rulebook, cleric magic): "any natural roll within that
 * range automatically fails ... even though a roll of 13 would normally
 * mean success on 1st-level spells." The spell-result card previously
 * looked up the result row by the check TOTAL, so a cleric whose
 * disapproval range had grown could roll a natural 4 (+8 = 12), get the
 * red auto-failure highlight on the total, and still see the successful
 * 12-13 manifestation row — a self-contradictory card. The card must
 * show the failure row plus the explanatory banner instead.
 *
 * The natural roll is forced by patching DiceTerm.prototype._roll for
 * the duration of the cast (forceFumble only covers natural 1).
 */
const test = createSessionTest()

/** Cast a cleric spell with a forced natural roll and capture the card. */
const castWithNaturalFn = `async ({ disapproval, natural }) => {
  const observed = {}
  let actor, table
  try {
    table = await RollTable.create({
      name: 'P874 Paralysis',
      formula: '1d20',
      results: [
        { type: CONST.TABLE_RESULT_TYPES.TEXT, range: [1, 11], description: 'e2e failure row', weight: 1 },
        { type: CONST.TABLE_RESULT_TYPES.TEXT, range: [12, 33], description: 'e2e success row', weight: 1 }
      ]
    })

    actor = await Actor.create({
      type: 'Player',
      name: 'P874 Cleric',
      system: {
        class: { className: 'Cleric', disapproval },
        details: { sheetClass: 'Cleric' }
      }
    })
    await actor.update({ 'system.class.spellCheckOverride': '+8' })
    const [spell] = await actor.createEmbeddedDocuments('Item', [{
      type: 'spell',
      name: 'P874 Paralysis',
      system: {
        level: 1,
        config: { castingMode: 'cleric' },
        results: { table: 'P874 Paralysis', collection: '' }
      }
    }])

    const proto = foundry.dice.terms.DiceTerm.prototype
    const origRoll = proto._roll
    proto._roll = async function () { return natural }
    try {
      await spell.rollSpellCheck()
    } finally {
      proto._roll = origRoll
    }

    // The spell-result ChatMessage.create is awaited by rollSpellCheck, but
    // poll briefly anyway to dodge any render race (see e2e-chat-message-race).
    for (let i = 0; i < 40; i++) {
      const message = game.messages.contents[game.messages.contents.length - 1]
      if (message?.getFlag('dcc', 'SpellCheck')) {
        observed.content = message.content
        const roll = message.rolls?.[0]
        observed.natural = roll?.dice?.[0]?.total
        observed.total = roll?.total
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  } finally {
    if (actor) await actor.delete().catch(() => {})
    if (table) await table.delete().catch(() => {})
  }
  return observed
}`

test.describe('Cleric disapproval-range auto-failure (#874)', () => {
  test('natural roll inside the disapproval range shows the failure row and banner despite a successful total', async ({ page }) => {
    const observed = await page.evaluate(async (castWithNaturalSrc) => {
      // eslint-disable-next-line no-eval
      const castWithNatural = eval(`(${castWithNaturalSrc})`)
      return castWithNatural({ disapproval: 4, natural: 4 })
    }, castWithNaturalFn)

    expect(observed.natural).toBe(4)
    expect(observed.total).toBe(12) // would hit the 12-33 success row by total
    expect(observed.content).toContain('e2e failure row')
    expect(observed.content).not.toContain('e2e success row')
    expect(observed.content).toContain('Automatic failure! Natural roll within disapproval range.')
  })

  test('the same roll with disapproval range 1 keeps the success row and no banner', async ({ page }) => {
    const observed = await page.evaluate(async (castWithNaturalSrc) => {
      // eslint-disable-next-line no-eval
      const castWithNatural = eval(`(${castWithNaturalSrc})`)
      return castWithNatural({ disapproval: 1, natural: 4 })
    }, castWithNaturalFn)

    expect(observed.natural).toBe(4)
    expect(observed.total).toBe(12)
    expect(observed.content).toContain('e2e success row')
    expect(observed.content).not.toContain('e2e failure row')
    expect(observed.content).not.toContain('Automatic failure!')
  })
})

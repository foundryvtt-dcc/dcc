/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Manifestation table resolution (issue #799).
 *
 * `rollManifestation` historically reconstructed the table name as
 * `${this.name} Manifestation`, which breaks in Babele worlds where the
 * spell's display name is translated but the side-effect table is not.
 * These tests drive the two fixes end-to-end against live Foundry:
 *  - the name fallback also tries the untranslated original name Babele
 *    records in `flags.babele.originalName`
 *  - an explicit `system.manifestation.table` reference resolves the table
 *    language-independently, mirroring `system.results.table`
 */
const test = createSessionTest()

/** Poll an item system path until it holds the expected/matching value. */
const waitForValueFn = `async (item, path, matches) => {
  const read = () => path.split('.').reduce((o, k) => o?.[k], item.system)
  for (let i = 0; i < 40; i++) {
    if (matches(read())) return read()
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return read()
}`

test.describe('Spell manifestation table resolution', () => {
  test('a Babele-translated spell resolves its untranslated manifestation table', async ({ page }) => {
    const result = await page.evaluate(async (waitForValueSrc) => {
      // eslint-disable-next-line no-eval
      const waitForValue = eval(`(${waitForValueSrc})`)
      const observed = {}
      let actor, table
      try {
        // World table named for the UNTRANSLATED spell name — exactly what
        // ships untranslated in dcc-core-book's side-effects pack.
        table = await RollTable.create({
          name: 'P799 Sleep Manifestation',
          formula: '1d4',
          results: [{ type: CONST.TABLE_RESULT_TYPES.TEXT, range: [1, 4], description: 'e2e caster snores gently', weight: 1 }]
        })

        actor = await Actor.create({ type: 'Player', name: 'P799_BabeleProbe' })
        // The spell as Babele presents it: translated display name, original
        // name preserved under flags.babele.
        const [spell] = await actor.createEmbeddedDocuments('Item', [{
          type: 'spell',
          name: 'P799 Schlaf',
          flags: { babele: { originalName: 'P799 Sleep', translated: true } }
        }])

        await spell.rollManifestation()
        const value = await waitForValue(spell, 'manifestation.value', (v) => Number(v) >= 1)
        observed.value = Number(value)
        observed.description = spell.system.manifestation.description
      } finally {
        if (actor) await actor.delete().catch(() => {})
        if (table) await table.delete().catch(() => {})
      }
      return observed
    }, waitForValueFn)

    // The roll landed on the 1d4 table resolved via the original name —
    // before the fix this warned "no manifestation" and stowed nothing.
    expect(result.value).toBeGreaterThanOrEqual(1)
    expect(result.value).toBeLessThanOrEqual(4)
    expect(result.description).toContain('snores gently')
  })

  test('an explicit system.manifestation.table reference resolves regardless of names', async ({ page }) => {
    const result = await page.evaluate(async (waitForValueSrc) => {
      // eslint-disable-next-line no-eval
      const waitForValue = eval(`(${waitForValueSrc})`)
      const observed = {}
      let actor, table
      try {
        // Table name shares nothing with the spell name — only the explicit
        // reference can resolve it.
        table = await RollTable.create({
          name: 'P799 Homebrew Side Effects',
          formula: '1d4',
          results: [{ type: CONST.TABLE_RESULT_TYPES.TEXT, range: [1, 4], description: 'e2e sparks drift upward', weight: 1 }]
        })

        actor = await Actor.create({ type: 'Player', name: 'P799_RefProbe' })
        const [spell] = await actor.createEmbeddedDocuments('Item', [{
          type: 'spell',
          name: 'P799 Unrelated Spell Name',
          system: { manifestation: { table: 'P799 Homebrew Side Effects' } }
        }])

        await spell.rollManifestation()
        const value = await waitForValue(spell, 'manifestation.value', (v) => Number(v) >= 1)
        observed.value = Number(value)
        observed.description = spell.system.manifestation.description
      } finally {
        if (actor) await actor.delete().catch(() => {})
        if (table) await table.delete().catch(() => {})
      }
      return observed
    }, waitForValueFn)

    expect(result.value).toBeGreaterThanOrEqual(1)
    expect(result.value).toBeLessThanOrEqual(4)
    expect(result.description).toContain('sparks drift upward')
  })
})

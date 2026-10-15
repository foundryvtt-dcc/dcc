/* eslint-disable no-undef -- Foundry globals used in page.evaluate callbacks */
const { expect, createSessionTest } = require('./fixtures')

const test = createSessionTest()

test('party aggregate reads live world actor HP without persisting it', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const created = []
    try {
      for (const [name, value, max] of [['First', 5, 8], ['Second', 2, 4]]) {
        created.push(await Actor.create({
          name: `PARTY TOKEN ${name}`,
          type: 'Player',
          system: { attributes: { hp: { value, max } } }
        }))
      }
      const [first, second] = created
      const party = await Actor.create({
        name: 'PARTY TOKEN Aggregate',
        type: 'Party',
        flags: { dcc: { partyMembers: [{ id: first.id }, { id: second.id }, { id: first.id }] } }
      })
      created.push(party)
      const before = party.system.aggregate
      await first.update({ 'system.attributes.hp.value': 2 })
      return {
        before,
        after: party.system.aggregate,
        persisted: Object.hasOwn(party.toObject().system, 'aggregate')
      }
    } finally {
      for (const actor of created.reverse()) await actor.delete()
    }
  })

  expect(result.before).toEqual({ hp: { value: 7, max: 12 } })
  expect(result.after).toEqual({ hp: { value: 4, max: 12 } })
  expect(result.persisted).toBe(false)
})

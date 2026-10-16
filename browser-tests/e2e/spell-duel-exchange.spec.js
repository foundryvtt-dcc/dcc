/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Spell duel exchanges resolved through the lib (#982), against the
 * dcc-core-book Tables 4-5 to 4-7 active in the E2E world.
 *
 * Dice are forced by patching DiceTerm.prototype._roll by die size.
 */
const test = createSessionTest()

const scenarioFn = `async ({ attackerCheck, defenderCheck, defenderMomentum, faces, options }) => {
  const observed = {}
  const SpellDuel = game.dcc.SpellDuel
  const tag = Math.random().toString(36).slice(2, 8)
  const proto = foundry.dice.terms.DiceTerm.prototype
  const origRoll = proto._roll
  let attacker, defender
  try {
    await SpellDuel.endDuel()
    attacker = await Actor.create({ type: 'Player', name: 'SD982 Attacker ' + tag })
    defender = await Actor.create({ type: 'Player', name: 'SD982 Defender ' + tag })
    await SpellDuel.addParticipant(attacker)
    await SpellDuel.addParticipant(defender)
    SpellDuel.participants.find(p => p.actorId === defender.id).momentum = defenderMomentum

    proto._roll = async function () { return faces[this.faces] ?? 1 }
    const start = Date.now()
    await SpellDuel.resolveExchange(attacker.id, attackerCheck, defender.id, defenderCheck, options)
    proto._roll = origRoll

    observed.attackerMomentum = SpellDuel.participants.find(p => p.actorId === attacker.id).momentum
    observed.defenderMomentum = SpellDuel.participants.find(p => p.actorId === defender.id).momentum
    const messages = game.messages.contents.filter((m) => m.timestamp >= start)
    observed.rollFlavors = messages.filter((m) => m.rolls?.length).map((m) => m.flavor)
    observed.card = messages.filter((m) => !m.rolls?.length).map((m) => m.content).at(-1)
  } finally {
    proto._roll = origRoll
    await SpellDuel.endDuel().catch(() => {})
    if (attacker) await attacker.delete().catch(() => {})
    if (defender) await defender.delete().catch(() => {})
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

test.describe('Spell duel exchange (#982)', () => {
  test('a defender who wins while ahead adds the momentum lead to the counterspell roll', async ({ page }) => {
    // Defender 16 vs attacker 13 is a d5 on Table 4-5. Defender momentum
    // 12 -> 13 vs 10, so the d5's 2 becomes 5 on the Defender High column.
    const observed = await runScenario(page, {
      attackerCheck: 13, defenderCheck: 16, defenderMomentum: 12, faces: { 5: 2 }, options: {}
    })

    expect(observed.defenderMomentum).toBe(13)
    expect(observed.attackerMomentum).toBe(10)
    expect(observed.rollFlavors).toEqual(['Counterspell Power (d5)'])
    expect(observed.card).toContain('= 2 (+3) = 5')
    expect(observed.card).toContain('Mutual cancellation')
  })

  test('tied checks roll a d10 Phlogiston Disturbance and change no momentum', async ({ page }) => {
    const observed = await runScenario(page, {
      attackerCheck: 15, defenderCheck: 15, defenderMomentum: 10, faces: { 10: 4 }, options: {}
    })

    expect(observed.attackerMomentum).toBe(10)
    expect(observed.defenderMomentum).toBe(10)
    expect(observed.rollFlavors).toEqual(['Phlogiston Disturbance (Table 4-7)'])
    expect(observed.card).toContain('Time slows')
  })

  test('a check below the spell level minimum stops the comparison', async ({ page }) => {
    // 13 fails a level 2 spell (needs 14)
    const observed = await runScenario(page, {
      attackerCheck: 16, defenderCheck: 13, defenderMomentum: 10, faces: {}, options: { defenderLevel: 2 }
    })

    expect(observed.rollFlavors).toEqual([])
    expect(observed.attackerMomentum).toBe(10)
    expect(observed.card).toContain('below the minimum spell check')
  })

  test('the resolve dialog asks for spell levels and same-patron invocations', async ({ page }) => {
    const fields = await page.evaluate(async () => {
      const SpellDuel = game.dcc.SpellDuel
      const actors = []
      try {
        await SpellDuel.endDuel()
        for (const name of ['SD982 Dialog A', 'SD982 Dialog B']) {
          const a = await Actor.create({ type: 'Player', name })
          actors.push(a)
          await SpellDuel.addParticipant(a)
        }
        await SpellDuel.promptResolveExchange()
        const form = [...document.querySelectorAll('dialog, .application')]
          .map((el) => el.querySelector('form [name="attackerLevel"]')?.form)
          .find(Boolean)
        const names = form ? ['attackerLevel', 'defenderLevel', 'samePatron'].map((n) => form.elements[n]?.type ?? null) : null
        const app = foundry.applications.instances
          ? [...foundry.applications.instances.values()].find((a) => a.element?.contains(form))
          : null
        await app?.close()
        return names
      } finally {
        await SpellDuel.endDuel().catch(() => {})
        for (const a of actors) await a.delete().catch(() => {})
      }
    })

    expect(fields).toEqual(['number', 'number', 'checkbox'])
  })
})

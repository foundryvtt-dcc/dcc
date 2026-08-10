import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../__mocks__/foundry.js'

vi.mock('../ability-score-log.js', () => ({
  logAbilityChange: vi.fn(async () => ({}))
}))

const { default: ApplyDamageDialog } = await import('../apply-damage-dialog.js')
const { logAbilityChange } = await import('../ability-score-log.js')

// The private static submit handler is reachable through the form config,
// exactly how ApplicationV2 invokes it (bound to the dialog instance).
const submit = ApplyDamageDialog.DEFAULT_OPTIONS.form.handler

/** Invoke the submit handler with a stubbed dialog instance. */
async function runSubmit (options, formValues) {
  const self = { options, title: 'Apply Damage' }
  const event = { preventDefault: vi.fn() }
  await submit.call(self, event, {}, { object: formValues })
  return event
}

function makeTarget () {
  return { applyDamage: vi.fn(async () => {}) }
}

describe('ApplyDamageDialog (apply-time damage adjustment, issue #401)', () => {
  beforeEach(() => {
    logAbilityChange.mockClear()
  })

  it('applies the edited amount to each target with the dialog multiplier', async () => {
    const targets = [makeTarget(), makeTarget()]

    await runSubmit({ amount: 5, multiplier: 1, targets, luckActor: null }, { amount: '3' })

    for (const target of targets) {
      expect(target.applyDamage).toHaveBeenCalledWith(3, 1)
    }
  })

  it('applies healing with a -1 multiplier', async () => {
    const target = makeTarget()

    await runSubmit({ amount: 4, multiplier: -1, targets: [target], luckActor: null }, { amount: '6' })

    expect(target.applyDamage).toHaveBeenCalledWith(6, -1)
  })

  it('does not apply anything when the amount is zero or not a number', async () => {
    const target = makeTarget()

    await runSubmit({ amount: 5, multiplier: 1, targets: [target], luckActor: null }, { amount: '0' })
    await runSubmit({ amount: 5, multiplier: 1, targets: [target], luckActor: null }, { amount: 'x' })

    expect(target.applyDamage).not.toHaveBeenCalled()
  })

  it('records a Luck spend against the roller through the ability score log', async () => {
    const target = makeTarget()
    const luckActor = { name: 'Roller' }

    await runSubmit({ amount: 5, multiplier: 1, targets: [target], luckActor }, { amount: '7', luckSpend: '2' })

    expect(logAbilityChange).toHaveBeenCalledWith(luckActor, {
      ability: 'lck',
      change: -2,
      type: 'luckSpend',
      source: 'Apply Damage'
    }, { announce: true })
    expect(target.applyDamage).toHaveBeenCalledWith(7, 1)
  })

  it('does not log a Luck spend when none was entered or no roller is known', async () => {
    const target = makeTarget()

    await runSubmit({ amount: 5, multiplier: 1, targets: [target], luckActor: { name: 'R' } }, { amount: '5', luckSpend: '0' })
    await runSubmit({ amount: 5, multiplier: 1, targets: [target], luckActor: null }, { amount: '5', luckSpend: '3' })

    expect(logAbilityChange).not.toHaveBeenCalled()
  })

  it('titles itself Apply Damage or Apply Healing based on the multiplier', () => {
    const damageDialog = new ApplyDamageDialog({ amount: 5, multiplier: 1, targets: [], luckActor: null })
    const healingDialog = new ApplyDamageDialog({ amount: 5, multiplier: -1, targets: [], luckActor: null })

    // The i18n mock strips the DCC. prefix when localizing
    expect(damageDialog.title).toBe('ChatContextDamage')
    expect(healingDialog.title).toBe('ChatContextHealing')
  })
})

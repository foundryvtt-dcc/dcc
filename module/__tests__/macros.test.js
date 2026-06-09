/**
 * Unit coverage for the hotbar macro factories extracted from
 * `module/dcc.js` into `module/macros.mjs`.
 *
 * Each factory is pure modulo a few Foundry globals (`game`, `CONFIG`,
 * `ChatMessage`, `ui`, `Macro`), which we stub here so the assertions
 * don't need a live Foundry boot.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  MACRO_FACTORIES,
  _createDCCAbilityMacro,
  _createDCCActionDiceMacro,
  _createDCCApplyDisapprovalMacro,
  _createDCCAttackBonusMacro,
  _createDCCHitDiceMacro,
  _createDCCInitiativeMacro,
  _createDCCItemMacro,
  _createDCCLuckDieMacro,
  _createDCCRollDisapprovalMacro,
  _createDCCSaveMacro,
  _createDCCSkillMacro,
  _createDCCSpellCheckMacro,
  _createDCCWeaponMacro,
  createDCCMacro,
  getMacroActor,
  getMacroOptions,
  rollDCCWeaponMacro
} from '../macros.mjs'

const savedGlobals = {}

function snapshotGlobals () {
  savedGlobals.game = globalThis.game
  savedGlobals.CONFIG = globalThis.CONFIG
  savedGlobals.ChatMessage = globalThis.ChatMessage
  savedGlobals.ui = globalThis.ui
  savedGlobals.Macro = globalThis.Macro
}

function restoreGlobals () {
  globalThis.game = savedGlobals.game
  globalThis.CONFIG = savedGlobals.CONFIG
  globalThis.ChatMessage = savedGlobals.ChatMessage
  globalThis.ui = savedGlobals.ui
  globalThis.Macro = savedGlobals.Macro
}

function installFoundryStubs ({ i18n = {}, dcc = {}, settings = {}, actors = {}, macros = {}, user = {}, dccCfg = {} } = {}) {
  globalThis.CONFIG = {
    DCC: {
      abilities: { str: 'DCC.AbilityStr', agl: 'DCC.AbilityAgl' },
      saves: { ref: 'DCC.SaveRef', frt: 'DCC.SaveFrt', wil: 'DCC.SaveWil' },
      macroImages: {
        default: 'default.svg',
        ability: 'ability.svg',
        abilityRollUnder: 'ability-under.svg',
        str: 'str.svg',
        agl: 'agl.svg',
        initiative: 'initiative.svg',
        hitDice: 'hitDice.svg',
        defaultDice: 'defaultDice.svg',
        savingThrow: 'savingThrow.svg',
        ref: 'ref.svg',
        skillCheck: 'skillCheck.svg',
        luckDie: 'luckDie.svg',
        spellCheck: 'spellCheck.svg',
        attackBonus: 'attackBonus.svg',
        backstab: 'backstab.svg',
        applyDisapproval: 'applyDisapproval.svg',
        rollDisapproval: 'rollDisapproval.svg'
      },
      defaultItemImages: {
        default: 'item.webp',
        weapon: 'weapon.webp',
        spell: 'spell.webp'
      },
      ...dccCfg
    }
  }
  globalThis.game = {
    i18n: {
      localize: (k) => `loc:${k}`,
      format: (k, ctx = {}) => `fmt:${k}:${JSON.stringify(ctx)}`,
      ...i18n
    },
    actors: { get: vi.fn(), tokens: {}, ...actors },
    macros: { contents: [] },
    user: { assignHotbarMacro: vi.fn(async () => {}) },
    settings: { get: vi.fn(() => false), ...settings },
    dcc: {
      DiceChain: { getPrimaryDie: (d) => d },
      KeyState: { ctrlKey: false },
      ...dcc
    },
    ...(macros ? { macros: { contents: [], ...macros } } : {}),
    ...(user ? { user: { assignHotbarMacro: vi.fn(async () => {}), ...user } } : {})
  }
  globalThis.ChatMessage = { getSpeaker: vi.fn(() => ({ token: null, actor: null })) }
  globalThis.ui = { notifications: { warn: vi.fn(() => 'warn-result') } }
  globalThis.Macro = { create: vi.fn(async (cfg) => ({ ...cfg, id: 'created-id' })) }
}

beforeEach(() => {
  snapshotGlobals()
  installFoundryStubs()
})

afterEach(() => {
  restoreGlobals()
})

describe('_createDCCAbilityMacro', () => {
  test('returns null-ish when data.type does not match', () => {
    expect(_createDCCAbilityMacro({ type: 'Save', data: {} })).toBeUndefined()
  })

  test('builds a roll-over ability macro', () => {
    const macro = _createDCCAbilityMacro({
      type: 'Ability',
      actorId: 'A1',
      data: { abilityId: 'str', rollUnder: false }
    })
    expect(macro.name).toBe('loc:DCC.AbilityStr')
    expect(macro.img).toBe('str.svg') // CONFIG.DCC.macroImages[str], not the 'ability' fallback
    expect(macro.command).toContain("game.dcc.getMacroActor('A1')")
    expect(macro.command).toContain('rollAbilityCheck("str"')
    expect(macro.command).toContain('rollUnder: false')
  })

  test('roll-under variant wraps the name and uses the abilityRollUnder fallback', () => {
    const macro = _createDCCAbilityMacro({
      type: 'Ability',
      actorId: 'A1',
      data: { abilityId: 'agl', rollUnder: true }
    })
    expect(macro.name).toBe('fmt:DCC.RollUnder:{"name":"loc:DCC.AbilityAgl"}')
    expect(macro.command).toContain('rollUnder: true')
  })
})

describe('_createDCCInitiativeMacro', () => {
  test('builds an initiative macro', () => {
    const macro = _createDCCInitiativeMacro({ type: 'Initiative', actorId: 'A2' })
    expect(macro.name).toBe('loc:DCC.Initiative')
    expect(macro.img).toBe('initiative.svg')
    expect(macro.command).toContain('rollInit(event, token)')
  })

  test('returns undefined for wrong type', () => {
    expect(_createDCCInitiativeMacro({ type: 'Skill', data: {} })).toBeUndefined()
  })
})

describe('_createDCCHitDiceMacro', () => {
  test('builds a hit-dice macro', () => {
    const macro = _createDCCHitDiceMacro({ type: 'Hit Dice', actorId: 'A3', data: { dice: '1d8' } })
    expect(macro.name).toBe('loc:DCC.HitDiceRoll')
    expect(macro.command).toContain('rollHitDice(game.dcc.getMacroOptions())')
    expect(macro.img).toBe('hitDice.svg')
  })
})

describe('_createDCCSaveMacro', () => {
  test('builds a saving-throw macro', () => {
    const macro = _createDCCSaveMacro({ type: 'Save', actorId: 'A4', data: 'ref' })
    expect(macro.name).toBe('loc:DCC.SaveRef')
    expect(macro.command).toContain('rollSavingThrow("ref"')
    expect(macro.img).toBe('ref.svg')
  })
})

describe('_createDCCSkillMacro', () => {
  test('builds a skill macro using the localized skill name', () => {
    const macro = _createDCCSkillMacro({
      type: 'Skill',
      actorId: 'A5',
      data: { skillId: 'sneak', skillName: 'DCC.SkillSneak' }
    })
    expect(macro.name).toBe('loc:DCC.SkillSneak')
    expect(macro.command).toContain('rollSkillCheck("sneak"')
    expect(macro.img).toBe('skillCheck.svg')
  })
})

describe('_createDCCLuckDieMacro', () => {
  test('builds a luck-die macro', () => {
    const macro = _createDCCLuckDieMacro({ type: 'Luck Die', actorId: 'A6', data: { die: '1d4' } })
    expect(macro.name).toBe('loc:DCC.LuckDie')
    expect(macro.img).toBe('luckDie.svg')
    expect(macro.command).toContain('rollLuckDie(game.dcc.getMacroOptions())')
  })
})

describe('_createDCCSpellCheckMacro', () => {
  test('itemId branch builds an item-based command', () => {
    const macro = _createDCCSpellCheckMacro({
      type: 'Spell Check',
      actorId: 'A7',
      data: { name: 'Magic Missile', img: 'spell.png', itemId: 'I1' }
    })
    expect(macro.name).toBe('Magic Missile')
    expect(macro.img).toBe('spell.png')
    expect(macro.command).toContain('fromUuid("Actor.A7.Item.I1")')
    expect(macro.command).toContain('_item.rollSpellCheck()')
  })

  test('spell-name branch falls back to actor-based command', () => {
    const macro = _createDCCSpellCheckMacro({
      type: 'Spell Check',
      actorId: 'A7',
      data: { name: 'Magic Missile' }
    })
    expect(macro.command).toContain('getMacroActor')
    expect(macro.command).toContain('spell: "Magic Missile"')
    expect(macro.img).toBe('spellCheck.svg')
  })

  test('bare branch produces a generic spell check command', () => {
    const macro = _createDCCSpellCheckMacro({ type: 'Spell Check', actorId: 'A7', data: {} })
    expect(macro.name).toBe('loc:DCC.SpellCheck')
    expect(macro.command).toContain('_actor.rollSpellCheck()')
  })
})

describe('_createDCCAttackBonusMacro', () => {
  test('builds an attack-bonus macro', () => {
    const macro = _createDCCAttackBonusMacro({ type: 'Attack Bonus', actorId: 'A8', data: { die: '1d3' } })
    expect(macro.name).toBe('loc:DCC.AttackBonus')
    expect(macro.command).toContain('rollAttackBonus(game.dcc.getMacroOptions())')
    expect(macro.img).toBe('attackBonus.svg')
  })
})

describe('_createDCCActionDiceMacro', () => {
  test('builds an action-dice macro', () => {
    const macro = _createDCCActionDiceMacro({ type: 'Action Dice', actorId: 'A9', data: { die: '1d20' } })
    expect(macro.name).toBe('fmt:DCC.ActionDiceMacroName:{"die":"1d20"}')
    expect(macro.command).toContain("setActionDice('1d20')")
    expect(macro.img).toBe('defaultDice.svg')
  })
})

describe('_createDCCWeaponMacro', () => {
  // The drag payload maps dccData -> system, so the weapon item lives at
  // `data.system.weapon` (a real DCCItem with `.type === 'weapon'`). The icon
  // fallback reads `weapon.type` — NOT a bogus `data.data.weapon.type`, which
  // would throw in production where `data.data` is the weapon item itself.
  test('weapon drop with explicit img keeps it', () => {
    const macro = _createDCCWeaponMacro({
      type: 'Weapon',
      actorId: 'A10',
      system: { weapon: { _id: 'W1', type: 'weapon', name: 'Longsword', img: 'longsword.webp' }, backstab: false }
    })
    expect(macro.name).toBe('Longsword')
    expect(macro.img).toBe('longsword.webp')
    expect(macro.command).toContain('rollDCCWeaponMacro("W1", "A10"')
    expect(macro.command).toContain('"backstab":false')
  })

  test('missing img falls back to the item-type default', () => {
    const macro = _createDCCWeaponMacro({
      type: 'Weapon',
      actorId: 'A10',
      system: { weapon: { _id: 'W1', type: 'weapon', name: 'Bare Weapon', img: '' } }
    })
    expect(macro.img).toBe('weapon.webp')
  })

  test('mystery-man placeholder falls back to the item-type default', () => {
    const macro = _createDCCWeaponMacro({
      type: 'Weapon',
      actorId: 'A10',
      system: { weapon: { _id: 'W1', type: 'weapon', name: 'Mystery', img: 'icons/svg/mystery-man.svg' } }
    })
    expect(macro.img).toBe('weapon.webp')
  })

  test('backstab flag swaps the icon to backstab', () => {
    const macro = _createDCCWeaponMacro({
      type: 'Weapon',
      actorId: 'A10',
      system: { weapon: { _id: 'W1', type: 'weapon', name: 'Dagger', img: 'dagger.webp' }, backstab: true }
    })
    expect(macro.img).toBe('backstab.svg')
    expect(macro.command).toContain('"backstab":true')
  })
})

describe('_createDCCItemMacro', () => {
  test('spell item uses rollSpellCheck command', () => {
    const macro = _createDCCItemMacro({
      type: 'Item',
      actorId: 'A11',
      data: { _id: 'I1', name: 'Magic Missile', type: 'spell', img: 'mm.png' },
      system: {}
    })
    expect(macro.name).toBe('Magic Missile')
    expect(macro.command).toContain('rollSpellCheck()')
    expect(macro.img).toBe('mm.png')
  })

  test('non-spell item uses generic roll command + image fallback', () => {
    const macro = _createDCCItemMacro({
      type: 'DCC Item',
      actorId: 'A11',
      data: { _id: 'I2', name: 'Sword', type: 'weapon' },
      system: {}
    })
    expect(macro.name).toBe('Sword')
    expect(macro.command).toContain('_item.roll()')
    expect(macro.img).toBe('weapon.webp')
  })

  test('reads from system.item when present', () => {
    const macro = _createDCCItemMacro({
      type: 'Item',
      actorId: 'A11',
      data: {},
      system: { item: { _id: 'I3', name: 'Healing Scroll', type: 'spell', img: 'scroll.png' } }
    })
    expect(macro.name).toBe('Healing Scroll')
  })

  test('returns undefined when no item payload', () => {
    expect(_createDCCItemMacro({ type: 'Item', actorId: 'A11', data: null, system: {} })).toBeUndefined()
  })
})

describe('_createDCCApplyDisapprovalMacro', () => {
  test('builds an apply-disapproval macro', () => {
    const macro = _createDCCApplyDisapprovalMacro({ type: 'Apply Disapproval', actorId: 'A12' })
    expect(macro.command).toContain('applyDisapproval()')
    expect(macro.img).toBe('applyDisapproval.svg')
  })
})

describe('_createDCCRollDisapprovalMacro', () => {
  test('builds a roll-disapproval macro', () => {
    const macro = _createDCCRollDisapprovalMacro({ type: 'Roll Disapproval', actorId: 'A13' })
    expect(macro.command).toContain('rollDisapproval()')
    expect(macro.img).toBe('rollDisapproval.svg')
  })
})

describe('MACRO_FACTORIES dispatch table', () => {
  test('routes every documented type to its factory', () => {
    expect(MACRO_FACTORIES.Ability).toBe(_createDCCAbilityMacro)
    expect(MACRO_FACTORIES.Initiative).toBe(_createDCCInitiativeMacro)
    expect(MACRO_FACTORIES['Hit Dice']).toBe(_createDCCHitDiceMacro)
    expect(MACRO_FACTORIES.Save).toBe(_createDCCSaveMacro)
    expect(MACRO_FACTORIES.Skill).toBe(_createDCCSkillMacro)
    expect(MACRO_FACTORIES['Luck Die']).toBe(_createDCCLuckDieMacro)
    expect(MACRO_FACTORIES['Spell Check']).toBe(_createDCCSpellCheckMacro)
    expect(MACRO_FACTORIES['Attack Bonus']).toBe(_createDCCAttackBonusMacro)
    expect(MACRO_FACTORIES['Action Dice']).toBe(_createDCCActionDiceMacro)
    expect(MACRO_FACTORIES.Weapon).toBe(_createDCCWeaponMacro)
    expect(MACRO_FACTORIES.Item).toBe(_createDCCItemMacro)
    expect(MACRO_FACTORIES['DCC Item']).toBe(_createDCCItemMacro)
    expect(MACRO_FACTORIES['Apply Disapproval']).toBe(_createDCCApplyDisapprovalMacro)
    expect(MACRO_FACTORIES['Roll Disapproval']).toBe(_createDCCRollDisapprovalMacro)
  })
})

describe('createDCCMacro dispatcher', () => {
  test('rewrites dccType/dccData into the standard shape before dispatch', async () => {
    const data = {
      dccType: 'Ability',
      actorId: 'A1',
      data: { abilityId: 'str', rollUnder: false },
      dccData: { extra: true }
    }
    const result = await createDCCMacro(data, 1)
    expect(result).toBe(false) // false = consumed
    expect(data.type).toBe('Ability')
    expect(data.system).toEqual({ extra: true })
    expect(globalThis.Macro.create).toHaveBeenCalledOnce()
    expect(globalThis.game.user.assignHotbarMacro).toHaveBeenCalledOnce()
  })

  test('returns true for Macro drops to let Foundry handle them', async () => {
    const result = await createDCCMacro({ type: 'Macro', data: {} }, 1)
    expect(result).toBe(true)
  })

  test('returns true for unknown types', async () => {
    const result = await createDCCMacro({ type: 'Unsupported', data: {} }, 1)
    expect(result).toBe(true)
  })

  test('returns true when data has no `data` payload', async () => {
    const result = await createDCCMacro({ type: 'Ability', actorId: 'A1' }, 1)
    expect(result).toBe(true)
  })

  test('reuses an existing macro when name and command match', async () => {
    const existing = { id: 'existing-id', name: 'loc:DCC.Initiative', command: "const _actor = game.dcc.getMacroActor('A1'); if (_actor) { _actor.rollInit(event, token) }" }
    globalThis.game.macros.contents = [existing]
    const result = await createDCCMacro({ type: 'Initiative', actorId: 'A1', data: {} }, 1)
    expect(result).toBe(false)
    expect(globalThis.Macro.create).not.toHaveBeenCalled()
    expect(globalThis.game.user.assignHotbarMacro).toHaveBeenCalledWith(existing, 1)
  })
})

describe('rollDCCWeaponMacro', () => {
  test('looks up the actor by id and delegates to rollWeaponAttack', () => {
    const rollWeaponAttack = vi.fn(() => 'roll-result')
    globalThis.game.actors.get = vi.fn(() => ({ rollWeaponAttack }))
    const out = rollDCCWeaponMacro('W1', 'A1', { backstab: true })
    expect(globalThis.game.actors.get).toHaveBeenCalledWith('A1')
    expect(rollWeaponAttack).toHaveBeenCalledWith('W1', { backstab: true })
    expect(out).toBe('roll-result')
  })
})

describe('getMacroActor', () => {
  test('with explicit actorId returns the result of game.actors.get', () => {
    const actor = { id: 'A1' }
    globalThis.game.actors.get = vi.fn(() => actor)
    expect(getMacroActor('A1')).toBe(actor)
  })

  test('without actorId resolves via ChatMessage.getSpeaker → token first', () => {
    const tokenActor = { id: 'tokenActor' }
    globalThis.ChatMessage.getSpeaker = vi.fn(() => ({ token: 'T1', actor: 'A1' }))
    globalThis.game.actors = {
      get: vi.fn(() => ({ id: 'fallbackActor' })),
      tokens: { T1: tokenActor }
    }
    expect(getMacroActor()).toBe(tokenActor)
  })

  test('without token falls back to the speaker actor', () => {
    const fallbackActor = { id: 'fallbackActor' }
    globalThis.ChatMessage.getSpeaker = vi.fn(() => ({ token: null, actor: 'A1' }))
    globalThis.game.actors = {
      get: vi.fn(() => fallbackActor),
      tokens: {}
    }
    expect(getMacroActor()).toBe(fallbackActor)
  })

  test('warns via ui.notifications when no actor can be found', () => {
    globalThis.ChatMessage.getSpeaker = vi.fn(() => ({ token: null, actor: null }))
    globalThis.game.actors = { get: vi.fn(() => null), tokens: {} }
    expect(getMacroActor()).toBe('warn-result')
    expect(globalThis.ui.notifications.warn).toHaveBeenCalledWith('loc:DCC.MacroNoTokenSelected')
  })
})

describe('getMacroOptions', () => {
  test('showModifierDialog is the XOR of setting and ctrlKey', () => {
    globalThis.game.settings.get = vi.fn(() => false)
    globalThis.game.dcc.KeyState = { ctrlKey: false }
    expect(getMacroOptions().showModifierDialog).toBe(0)

    globalThis.game.settings.get = vi.fn(() => true)
    globalThis.game.dcc.KeyState = { ctrlKey: false }
    expect(getMacroOptions().showModifierDialog).toBe(1)

    globalThis.game.settings.get = vi.fn(() => true)
    globalThis.game.dcc.KeyState = { ctrlKey: true }
    expect(getMacroOptions().showModifierDialog).toBe(0)

    globalThis.game.settings.get = vi.fn(() => false)
    globalThis.game.dcc.KeyState = { ctrlKey: true }
    expect(getMacroOptions().showModifierDialog).toBe(1)
  })

  test('reads the showRollModifierByDefault setting', () => {
    const spy = vi.fn(() => false)
    globalThis.game.settings.get = spy
    getMacroOptions()
    expect(spy).toHaveBeenCalledWith('dcc', 'showRollModifierByDefault')
  })
})

/**
 * Unit coverage for the chat- and hook-wiring surface extracted from
 * `module/dcc.js`. Each handler is invoked in isolation against a stubbed
 * `foundry` / `game` / `Hooks` / `ui` plus `vi.mock`ed sibling modules
 * (`chat`, `parser`, `entity-images`, `spell-result`, `table-result`,
 * `item-piles-support`, `macros`). No live Foundry boot.
 *
 * Mirrors the pattern in `settings-table-hooks.test.js` /
 * `table-loading.test.js`.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../chat.js', () => ({
  highlightCriticalSuccessFailure: vi.fn(),
  enforceMinimumDamage: vi.fn(),
  addChatMessageContextOptions: vi.fn(),
  lookupCriticalRoll: vi.fn().mockResolvedValue(undefined),
  lookupFumbleRoll: vi.fn().mockResolvedValue(undefined),
  emoteAbilityRoll: vi.fn(),
  emoteApplyDamageRoll: vi.fn(),
  emoteAttackRoll: vi.fn(),
  emoteCritRoll: vi.fn(),
  emoteFumbleRoll: vi.fn(),
  emoteDamageRoll: vi.fn(),
  emoteInitiativeRoll: vi.fn(),
  emoteSavingThrowRoll: vi.fn(),
  emoteSkillCheckRoll: vi.fn()
}))

vi.mock('../parser.js', () => ({
  default: { onRenderActorDirectory: vi.fn() }
}))

vi.mock('../entity-images.js', () => ({
  default: {
    imageForActor: vi.fn(),
    imageForItem: vi.fn()
  }
}))

vi.mock('../spell-result.js', () => ({
  default: { processChatMessage: vi.fn() }
}))

vi.mock('../table-result.js', () => ({
  default: { processChatMessage: vi.fn() }
}))

vi.mock('../item-piles-support.js', () => ({
  setupItemPilesForDCC: vi.fn()
}))

vi.mock('../macros.mjs', () => ({
  createDCCMacro: vi.fn()
}))

const chat = await import('../chat.js')
const parserModule = await import('../parser.js')
const parser = parserModule.default
const EntityImagesModule = await import('../entity-images.js')
const EntityImages = EntityImagesModule.default
const SpellResultModule = await import('../spell-result.js')
const SpellResult = SpellResultModule.default
const TableResultModule = await import('../table-result.js')
const TableResult = TableResultModule.default
const { setupItemPilesForDCC } = await import('../item-piles-support.js')
const { createDCCMacro } = await import('../macros.mjs')

const {
  CHAT_AND_HOOK_WIRING_HOOKS,
  onHotbarDrop,
  onRenderChatMessageHTML,
  onGetChatMessageContextOptions,
  onRenderActorDirectory,
  onPreCreateActor,
  onPreCreateItem,
  onApplyActiveEffect,
  onPreUpdateActor,
  onUpdateCombat,
  onItemPilesReady,
  onGetProseMirrorMenuDropDowns,
  registerChatAndHookWiring
} = await import('../chat-and-hook-wiring.mjs')

let originalGame
let originalFoundry
let originalHooks
let originalUi

beforeEach(() => {
  originalGame = globalThis.game
  originalFoundry = globalThis.foundry
  originalHooks = globalThis.Hooks
  originalUi = globalThis.ui
  globalThis.game = {
    user: { isGM: true, id: 'user-1' },
    settings: { get: vi.fn() },
    actors: [],
    i18n: { format: vi.fn((key) => key) },
    dcc: { DiceChain: { bumpDie: vi.fn() } }
  }
  globalThis.foundry = {
    utils: {
      getProperty: vi.fn(),
      setProperty: vi.fn()
    },
    prosemirror: { commands: { setBlockType: vi.fn() } }
  }
  globalThis.Hooks = { on: vi.fn(), once: vi.fn() }
  globalThis.ui = { notifications: { info: vi.fn() } }

  vi.clearAllMocks()
})

afterEach(() => {
  globalThis.game = originalGame
  globalThis.foundry = originalFoundry
  globalThis.Hooks = originalHooks
  globalThis.ui = originalUi
})

describe('onHotbarDrop', () => {
  test('delegates to createDCCMacro(data, slot) and returns its result', () => {
    createDCCMacro.mockReturnValue('macro-result')

    const result = onHotbarDrop({}, { type: 'Item', uuid: 'Item.X' }, 3)

    expect(createDCCMacro).toHaveBeenCalledWith({ type: 'Item', uuid: 'Item.X' }, 3)
    expect(result).toBe('macro-result')
  })
})

function makeRollMessage (overrides = {}) {
  return {
    isRoll: true,
    isContentVisible: true,
    rolls: [{ total: 15 }],
    setFlag: vi.fn(),
    getFlag: vi.fn((scope, key) => undefined),
    ...overrides
  }
}

function makeHtml () {
  // Plain-object stand-in: only the surface the production handler touches
  // (`querySelector('.message-content')` returning an element with
  // `setAttribute` + a writable `innerHTML`). Vitest's unit env has no
  // jsdom, so a real DOM is out of scope.
  const messageContent = {
    innerHTML: '',
    setAttribute: vi.fn(function (name, value) { this[name] = value })
  }
  return {
    _messageContent: messageContent,
    querySelector: (selector) => (selector === '.message-content' ? messageContent : null)
  }
}

describe('onRenderChatMessageHTML', () => {
  test('returns early when the message is not a roll', async () => {
    const message = makeRollMessage({ isRoll: false })
    const html = makeHtml()

    await onRenderChatMessageHTML(message, html, {})

    expect(chat.highlightCriticalSuccessFailure).not.toHaveBeenCalled()
    expect(SpellResult.processChatMessage).not.toHaveBeenCalled()
  })

  test('returns early when the message content is not visible', async () => {
    const message = makeRollMessage({ isContentVisible: false })
    await onRenderChatMessageHTML(message, makeHtml(), {})
    expect(chat.highlightCriticalSuccessFailure).not.toHaveBeenCalled()
  })

  test('returns early when rolls is empty', async () => {
    const message = makeRollMessage({ rolls: [] })
    await onRenderChatMessageHTML(message, makeHtml(), {})
    expect(chat.highlightCriticalSuccessFailure).not.toHaveBeenCalled()
  })

  test('decorates a rolled message (GM canPopout flag + highlight + minimum-damage + SpellResult)', async () => {
    globalThis.game.settings.get = vi.fn().mockReturnValue(false)
    const message = makeRollMessage()
    const html = makeHtml()

    await onRenderChatMessageHTML(message, html, {})

    expect(message.setFlag).toHaveBeenCalledWith('core', 'canPopout', true)
    expect(chat.highlightCriticalSuccessFailure).toHaveBeenCalledWith(message, html, {})
    expect(chat.enforceMinimumDamage).toHaveBeenCalledWith(message, html)
    expect(SpellResult.processChatMessage).toHaveBeenCalledWith(message, html, {})
    expect(TableResult.processChatMessage).toHaveBeenCalledWith(message, html, {})
  })

  test('forwards the dcc.ItemId flag onto a data-item-id attribute', async () => {
    globalThis.game.settings.get = vi.fn().mockReturnValue(false)
    const message = makeRollMessage({
      getFlag: vi.fn((scope, key) => (key === 'ItemId' ? 'ITEM-99' : undefined))
    })
    const html = makeHtml()

    await onRenderChatMessageHTML(message, html, {})

    expect(html._messageContent.setAttribute).toHaveBeenCalledWith('data-item-id', 'ITEM-99')
  })

  test('fires the 9 emote-roll helpers when emoteRolls is enabled', async () => {
    globalThis.game.settings.get = vi.fn((scope, key) => {
      if (key === 'emoteRolls') return true
      if (key === 'automateDamageFumblesCrits') return true
      return undefined
    })
    const message = makeRollMessage()

    await onRenderChatMessageHTML(message, makeHtml(), {})

    expect(message.setFlag).toHaveBeenCalledWith('dcc', 'emoteRoll', true)
    expect(chat.emoteAbilityRoll).toHaveBeenCalled()
    expect(chat.emoteApplyDamageRoll).toHaveBeenCalled()
    expect(chat.emoteAttackRoll).toHaveBeenCalled()
    expect(chat.emoteCritRoll).toHaveBeenCalled()
    expect(chat.emoteFumbleRoll).toHaveBeenCalled()
    expect(chat.emoteDamageRoll).toHaveBeenCalled()
    expect(chat.emoteInitiativeRoll).toHaveBeenCalled()
    expect(chat.emoteSavingThrowRoll).toHaveBeenCalled()
    expect(chat.emoteSkillCheckRoll).toHaveBeenCalled()
    // emote + automate ON skips crit/fumble lookup
    expect(chat.lookupCriticalRoll).not.toHaveBeenCalled()
    expect(chat.lookupFumbleRoll).not.toHaveBeenCalled()
  })

  test('appends the spellResult HTML when emoteRolls is false and the flag is present', async () => {
    globalThis.game.settings.get = vi.fn().mockReturnValue(false)
    const message = makeRollMessage({
      getFlag: vi.fn((scope, key) => (key === 'spellResult' ? '<p>SR-PROBE</p>' : undefined))
    })
    const html = makeHtml()

    await onRenderChatMessageHTML(message, html, {})

    expect(html._messageContent.innerHTML).toContain('SR-PROBE')
  })

  test('falls back to the dcc.emoteRoll flag when game.settings.get throws (no emoteRolls setting)', async () => {
    globalThis.game.settings.get = vi.fn(() => { throw new Error('Setting not registered') })
    const message = makeRollMessage({
      getFlag: vi.fn((scope, key) => (key === 'emoteRoll' ? true : undefined))
    })

    await onRenderChatMessageHTML(message, makeHtml(), {})

    expect(chat.emoteAbilityRoll).toHaveBeenCalled()
  })

  test('runs lookupCriticalRoll + lookupFumbleRoll when emote is off OR automate is off', async () => {
    globalThis.game.settings.get = vi.fn((scope, key) => {
      if (key === 'emoteRolls') return false
      if (key === 'automateDamageFumblesCrits') return false
      return undefined
    })
    const message = makeRollMessage()
    const html = makeHtml()

    await onRenderChatMessageHTML(message, html, {})

    expect(chat.lookupCriticalRoll).toHaveBeenCalledWith(message, html)
    expect(chat.lookupFumbleRoll).toHaveBeenCalledWith(message, html, {})
  })
})

describe('onGetChatMessageContextOptions', () => {
  test('delegates to chat.addChatMessageContextOptions', () => {
    chat.addChatMessageContextOptions.mockReturnValue('ctx-result')
    const result = onGetChatMessageContextOptions('<html/>', [{ name: 'A' }])
    expect(chat.addChatMessageContextOptions).toHaveBeenCalledWith('<html/>', [{ name: 'A' }])
    expect(result).toBe('ctx-result')
  })
})

describe('onRenderActorDirectory', () => {
  test('delegates to parser.onRenderActorDirectory', () => {
    const app = { name: 'A' }
    const html = '<html/>'

    onRenderActorDirectory(app, html)

    expect(parser.onRenderActorDirectory).toHaveBeenCalledWith(app, html)
  })
})

describe('onPreCreateActor', () => {
  test('assigns the EntityImages default img when GM creates an actor without an img', () => {
    EntityImages.imageForActor.mockReturnValue('icons/svg/probe-actor.svg')
    const document = { type: 'NPC', name: 'P_Probe', updateSource: vi.fn() }

    onPreCreateActor(document, {}, {})

    expect(EntityImages.imageForActor).toHaveBeenCalledWith('NPC')
    expect(document.updateSource).toHaveBeenCalledWith({ img: 'icons/svg/probe-actor.svg' })
  })

  test('skips img assignment when the data payload already has an img', () => {
    const document = { type: 'NPC', name: 'P_Probe', updateSource: vi.fn() }
    onPreCreateActor(document, { img: 'existing.svg' }, {})

    expect(document.updateSource).not.toHaveBeenCalledWith(expect.objectContaining({ img: expect.any(String) }))
  })

  test('skips img assignment for a non-GM user', () => {
    globalThis.game.user.isGM = false
    EntityImages.imageForActor.mockReturnValue('default.svg')
    const document = { type: 'NPC', name: 'P_Probe', updateSource: vi.fn() }

    onPreCreateActor(document, {}, {})

    expect(EntityImages.imageForActor).not.toHaveBeenCalled()
  })

  test('sets prototypeToken.actorLink for brand-new Player actors that are not Item Piles', () => {
    EntityImages.imageForActor.mockReturnValue(null)
    const document = { type: 'Player', name: 'P_Probe', updateSource: vi.fn() }

    onPreCreateActor(document, {}, { keepId: false })

    expect(document.updateSource).toHaveBeenCalledWith({ 'prototypeToken.actorLink': true })
  })

  test('skips actorLink for duplicates (keepId true) and Item Pile-named Player actors', () => {
    EntityImages.imageForActor.mockReturnValue(null)

    const dup = { type: 'Player', name: 'Dup', updateSource: vi.fn() }
    onPreCreateActor(dup, {}, { keepId: true })
    expect(dup.updateSource).not.toHaveBeenCalledWith({ 'prototypeToken.actorLink': true })

    const pile = { type: 'Player', name: 'Item Pile Probe', updateSource: vi.fn() }
    onPreCreateActor(pile, {}, { keepId: false })
    expect(pile.updateSource).not.toHaveBeenCalledWith({ 'prototypeToken.actorLink': true })
  })
})

describe('onPreCreateItem', () => {
  test('assigns the default item img when GM creates an item without an img', () => {
    EntityImages.imageForItem.mockReturnValue('icons/svg/probe-item.svg')
    const document = { type: 'weapon', updateSource: vi.fn() }

    onPreCreateItem(document, {}, {})

    expect(EntityImages.imageForItem).toHaveBeenCalledWith('weapon')
    expect(document.updateSource).toHaveBeenCalledWith({ img: 'icons/svg/probe-item.svg' })
  })

  test('skips when EntityImages.imageForItem returns null (no default for this type)', () => {
    EntityImages.imageForItem.mockReturnValue(null)
    const document = { type: 'unknown', updateSource: vi.fn() }

    onPreCreateItem(document, {}, {})

    expect(document.updateSource).not.toHaveBeenCalled()
  })

  test('returns without lookup when user is not GM or img is already set', () => {
    globalThis.game.user.isGM = false
    const document = { type: 'weapon', updateSource: vi.fn() }

    onPreCreateItem(document, {}, {})

    expect(EntityImages.imageForItem).not.toHaveBeenCalled()
    expect(document.updateSource).not.toHaveBeenCalled()
  })
})

describe('onApplyActiveEffect', () => {
  test('returns null and skips setProperty when the current value is not a string', () => {
    globalThis.foundry.utils.getProperty.mockReturnValue(123)

    const result = onApplyActiveEffect({ id: 'A' }, { key: 'system.foo', value: '+1d' })

    expect(result).toBeNull()
    expect(globalThis.foundry.utils.setProperty).not.toHaveBeenCalled()
  })

  test('bumps the die when the value matches a [+-]?\\d+d pattern on a string current', () => {
    globalThis.foundry.utils.getProperty.mockReturnValue('1d6')
    globalThis.game.dcc.DiceChain.bumpDie.mockReturnValue('1d8')

    const actor = { id: 'A' }
    const result = onApplyActiveEffect(actor, { key: 'system.attack', value: '+1d' })

    expect(globalThis.game.dcc.DiceChain.bumpDie).toHaveBeenCalledWith('1d6', 1)
    expect(globalThis.foundry.utils.setProperty).toHaveBeenCalledWith(actor, 'system.attack', '1d8')
    expect(result).toBe('1d8')
  })

  test('returns null when the value has no dice-chain pattern', () => {
    globalThis.foundry.utils.getProperty.mockReturnValue('1d6')

    const result = onApplyActiveEffect({ id: 'A' }, { key: 'system.attack', value: '+2' })

    expect(result).toBeNull()
    expect(globalThis.foundry.utils.setProperty).not.toHaveBeenCalled()
  })
})

describe('onPreUpdateActor', () => {
  test('returns early when userId does not match the local user', async () => {
    const actor = { type: 'NPC', prototypeToken: { texture: { src: '' } } }
    const changes = { img: 'new.svg' }

    await onPreUpdateActor(actor, changes, {}, 'other-user')

    expect(changes['prototypeToken.texture.src']).toBeUndefined()
  })

  test('returns early when the change does not include an img', async () => {
    const actor = { type: 'NPC', prototypeToken: { texture: { src: '' } } }
    const changes = { name: 'New' }

    await onPreUpdateActor(actor, changes, {}, 'user-1')

    expect(changes['prototypeToken.texture.src']).toBeUndefined()
  })

  test('replaces the token texture when it is the mystery-man default', async () => {
    EntityImages.imageForActor.mockReturnValueOnce('actor-default.svg').mockReturnValueOnce('global-default.svg')
    const actor = { type: 'NPC', prototypeToken: { texture: { src: 'icons/svg/mystery-man.svg' } } }
    const changes = { img: 'custom.svg' }

    await onPreUpdateActor(actor, changes, {}, 'user-1')

    expect(changes['prototypeToken.texture.src']).toBe('custom.svg')
  })

  test('replaces the token texture when it matches the type-specific default', async () => {
    EntityImages.imageForActor.mockReturnValueOnce('actor-default.svg').mockReturnValueOnce('global-default.svg')
    const actor = { type: 'NPC', prototypeToken: { texture: { src: 'actor-default.svg' } } }
    const changes = { img: 'custom.svg' }

    await onPreUpdateActor(actor, changes, {}, 'user-1')

    expect(changes['prototypeToken.texture.src']).toBe('custom.svg')
  })

  test('leaves a non-default custom token texture untouched', async () => {
    EntityImages.imageForActor.mockReturnValueOnce('actor-default.svg').mockReturnValueOnce('global-default.svg')
    const actor = { type: 'NPC', prototypeToken: { texture: { src: 'user-custom-token.png' } } }
    const changes = { img: 'custom.svg' }

    await onPreUpdateActor(actor, changes, {}, 'user-1')

    expect(changes['prototypeToken.texture.src']).toBeUndefined()
  })
})

describe('onUpdateCombat', () => {
  test('returns early for non-GM clients', async () => {
    globalThis.game.user.isGM = false
    const combat = { round: 5 }
    globalThis.game.actors = [{ effects: { size: 1 } }]

    await onUpdateCombat(combat, { round: 5 }, {}, 'u')

    // Non-GM should never have walked actors
    expect(globalThis.ui.notifications.info).not.toHaveBeenCalled()
  })

  test('returns early when the change does not include a round delta', async () => {
    const combat = { round: 5 }
    globalThis.game.actors = [{ effects: { size: 1 } }]

    await onUpdateCombat(combat, { active: true }, {}, 'u')

    expect(globalThis.ui.notifications.info).not.toHaveBeenCalled()
  })

  test('expires round-based effects when current round >= startRound + rounds', async () => {
    const effect = {
      id: 'effect-1',
      name: 'Bless',
      duration: { rounds: 3, startRound: 2 },
      isExpired: false
    }
    const effects = {
      size: 1,
      get: (id) => (id === effect.id ? effect : undefined),
      [Symbol.iterator]: function * () { yield effect }
    }
    const actor = {
      name: 'Cleric',
      effects,
      deleteEmbeddedDocuments: vi.fn().mockResolvedValue(undefined)
    }
    globalThis.game.actors = [actor]

    await onUpdateCombat({ round: 5 }, { round: 5 }, {}, 'u')

    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['effect-1'])
    expect(globalThis.ui.notifications.info).toHaveBeenCalled()
  })

  test('expires time-based effects when isExpired is true', async () => {
    const effect = {
      id: 'effect-2',
      name: 'Haste',
      duration: { seconds: 60 },
      isExpired: true
    }
    const effects = {
      size: 1,
      get: (id) => (id === effect.id ? effect : undefined),
      [Symbol.iterator]: function * () { yield effect }
    }
    const actor = {
      name: 'Wizard',
      effects,
      deleteEmbeddedDocuments: vi.fn().mockResolvedValue(undefined)
    }
    globalThis.game.actors = [actor]

    await onUpdateCombat({ round: 4 }, { round: 4 }, {}, 'u')

    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['effect-2'])
  })

  test('skips actors with zero effects', async () => {
    const actor = {
      name: 'Empty',
      effects: { size: 0 },
      deleteEmbeddedDocuments: vi.fn()
    }
    globalThis.game.actors = [actor]

    await onUpdateCombat({ round: 4 }, { round: 4 }, {}, 'u')

    expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled()
  })
})

describe('onItemPilesReady', () => {
  test('delegates to setupItemPilesForDCC', () => {
    setupItemPilesForDCC.mockReturnValue('item-piles-ready')

    const result = onItemPilesReady()

    expect(setupItemPilesForDCC).toHaveBeenCalled()
    expect(result).toBe('item-piles-ready')
  })
})

describe('onGetProseMirrorMenuDropDowns', () => {
  test('is a no-op when items has no format key', () => {
    const items = {}
    onGetProseMirrorMenuDropDowns({}, items)
    expect(items).toEqual({})
  })

  test('pushes a dcc-custom entry with a sidebar child under format.entries', () => {
    const items = { format: { entries: [] } }
    const menu = { schema: { nodes: { paragraph: {} } } }

    onGetProseMirrorMenuDropDowns(menu, items)

    expect(items.format.entries).toHaveLength(1)
    expect(items.format.entries[0].action).toBe('dcc-custom')
    expect(items.format.entries[0].title).toBe('DCC.CustomStyles')
    expect(items.format.entries[0].children).toHaveLength(1)
    expect(items.format.entries[0].children[0].action).toBe('sidebar')
    expect(items.format.entries[0].children[0].title).toBe('DCC.SidebarText')
  })

  test('active predicate returns true when the paragraph node carries the sidebar class', () => {
    const items = { format: { entries: [] } }
    onGetProseMirrorMenuDropDowns({ schema: { nodes: { paragraph: {} } } }, items)
    const activePred = items.format.entries[0].active

    const stateWithSidebar = {
      selection: { $from: { parent: { attrs: { _preserve: { class: 'sidebar' } } } } }
    }
    const stateWithout = {
      selection: { $from: { parent: { attrs: { _preserve: {} } } } }
    }

    expect(activePred(stateWithSidebar)).toBe(true)
    expect(activePred(stateWithout)).toBe(false)
  })
})

describe('CHAT_AND_HOOK_WIRING_HOOKS dispatch table', () => {
  test('routes each hook name to its matching handler', () => {
    expect(CHAT_AND_HOOK_WIRING_HOOKS.hotbarDrop.handler).toBe(onHotbarDrop)
    expect(CHAT_AND_HOOK_WIRING_HOOKS.renderChatMessageHTML.handler).toBe(onRenderChatMessageHTML)
    expect(CHAT_AND_HOOK_WIRING_HOOKS.getChatMessageContextOptions.handler).toBe(onGetChatMessageContextOptions)
    expect(CHAT_AND_HOOK_WIRING_HOOKS.renderActorDirectory.handler).toBe(onRenderActorDirectory)
    expect(CHAT_AND_HOOK_WIRING_HOOKS.preCreateActor.handler).toBe(onPreCreateActor)
    expect(CHAT_AND_HOOK_WIRING_HOOKS.preCreateItem.handler).toBe(onPreCreateItem)
    expect(CHAT_AND_HOOK_WIRING_HOOKS.applyActiveEffect.handler).toBe(onApplyActiveEffect)
    expect(CHAT_AND_HOOK_WIRING_HOOKS.preUpdateActor.handler).toBe(onPreUpdateActor)
    expect(CHAT_AND_HOOK_WIRING_HOOKS.updateCombat.handler).toBe(onUpdateCombat)
    expect(CHAT_AND_HOOK_WIRING_HOOKS['item-piles-ready'].handler).toBe(onItemPilesReady)
    expect(CHAT_AND_HOOK_WIRING_HOOKS.getProseMirrorMenuDropDowns.handler).toBe(onGetProseMirrorMenuDropDowns)
  })

  test('covers exactly the eleven documented hook names', () => {
    expect(Object.keys(CHAT_AND_HOOK_WIRING_HOOKS).sort()).toEqual([
      'applyActiveEffect',
      'getChatMessageContextOptions',
      'getProseMirrorMenuDropDowns',
      'hotbarDrop',
      'item-piles-ready',
      'preCreateActor',
      'preCreateItem',
      'preUpdateActor',
      'renderActorDirectory',
      'renderChatMessageHTML',
      'updateCombat'
    ])
  })

  test('flags only `item-piles-ready` as a once-only registration', () => {
    for (const [name, { once }] of Object.entries(CHAT_AND_HOOK_WIRING_HOOKS)) {
      if (name === 'item-piles-ready') {
        expect(once).toBe(true)
      } else {
        expect(once).toBe(false)
      }
    }
  })
})

describe('registerChatAndHookWiring', () => {
  test('wires every non-once handler via Hooks.on with the matching dispatch-table entry', () => {
    registerChatAndHookWiring()

    const onCalls = Object.fromEntries(globalThis.Hooks.on.mock.calls)
    expect(onCalls.hotbarDrop).toBe(onHotbarDrop)
    expect(onCalls.renderChatMessageHTML).toBe(onRenderChatMessageHTML)
    expect(onCalls.getChatMessageContextOptions).toBe(onGetChatMessageContextOptions)
    expect(onCalls.renderActorDirectory).toBe(onRenderActorDirectory)
    expect(onCalls.preCreateActor).toBe(onPreCreateActor)
    expect(onCalls.preCreateItem).toBe(onPreCreateItem)
    expect(onCalls.applyActiveEffect).toBe(onApplyActiveEffect)
    expect(onCalls.preUpdateActor).toBe(onPreUpdateActor)
    expect(onCalls.updateCombat).toBe(onUpdateCombat)
    expect(onCalls.getProseMirrorMenuDropDowns).toBe(onGetProseMirrorMenuDropDowns)
  })

  test('wires the once-only item-piles-ready handler via Hooks.once', () => {
    registerChatAndHookWiring()

    expect(globalThis.Hooks.once).toHaveBeenCalledWith('item-piles-ready', onItemPilesReady)
  })

  test('registers exactly ten Hooks.on listeners and one Hooks.once listener', () => {
    registerChatAndHookWiring()

    expect(globalThis.Hooks.on).toHaveBeenCalledTimes(10)
    expect(globalThis.Hooks.once).toHaveBeenCalledTimes(1)
  })
})

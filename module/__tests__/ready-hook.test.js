/**
 * Unit coverage for the `ready`-hook surface extracted from `module/dcc.js`.
 * `onReady()` runs the post-pack bootstrap; `checkReleaseNotes()` is exported
 * so the version-flag branch can be exercised as a plain function. The
 * assertions stub `game` / `Hooks` / `document` per-test and `vi.mock` every
 * sibling module so the steps run without a live Foundry boot.
 *
 * Mirrors the pattern in `init-hook.test.js` / `settings-table-hooks.test.js`.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../migrations.js', () => ({ checkMigrations: vi.fn().mockResolvedValue({ migrationComplete: true }) }))
vi.mock('../release-notes.js', () => ({ default: { addChatCard: vi.fn() } }))
vi.mock('../key-state.js', () => ({ default: class KeyState { constructor () { this.tag = 'KeyState' } } }))
vi.mock('../status-icons.js', () => ({ defineStatusIcons: vi.fn() }))
vi.mock('../settings.js', () => ({
  pubConstants: { name: 'dcc' },
  registerSystemSettings: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('../welcomeDialog.js', () => {
  const render = vi.fn()
  return { default: class WelcomeDialog { render (...args) { return render(...args) } }, __render: render }
})
vi.mock('../table-loading.mjs', () => ({ registerTables: vi.fn(), setupCoreBookCompendiumLinks: vi.fn() }))
vi.mock('../adapter/foundry-data-loader.mjs', () => ({ registerClassProgressionsFromPacks: vi.fn().mockResolvedValue(undefined) }))

const migrations = await import('../migrations.js')
const ReleaseNotes = (await import('../release-notes.js')).default
const statusIcons = await import('../status-icons.js')
const settings = await import('../settings.js')
const welcomeDialogModule = await import('../welcomeDialog.js')
const tableLoading = await import('../table-loading.mjs')
const foundryDataLoader = await import('../adapter/foundry-data-loader.mjs')

const { checkReleaseNotes, onReady, registerReadyHook } = await import('../ready-hook.mjs')

let original
let bodyClassList

function makeGame (overrides = {}) {
  return {
    system: { version: '0.50.0' },
    user: { isGM: true, getFlag: vi.fn(), setFlag: vi.fn() },
    settings: {
      get: vi.fn().mockReturnValue(false),
      settings: { get: vi.fn().mockReturnValue({ default: false }) }
    },
    dcc: {
      FleetingLuck: { init: vi.fn() },
      SpellDuel: { init: vi.fn() }
    },
    socket: { on: vi.fn() },
    packs: { get: vi.fn() },
    ...overrides
  }
}

beforeEach(() => {
  original = {
    game: globalThis.game,
    Hooks: globalThis.Hooks,
    document: globalThis.document,
    error: console.error
  }
  bodyClassList = { add: vi.fn() }
  globalThis.document = { body: { classList: bodyClassList }, addEventListener: vi.fn() }
  globalThis.game = makeGame()
  globalThis.Hooks = { once: vi.fn(), callAll: vi.fn() }
  console.error = vi.fn()
  vi.clearAllMocks()
})

afterEach(() => {
  globalThis.game = original.game
  globalThis.Hooks = original.Hooks
  globalThis.document = original.document
  console.error = original.error
})

describe('checkReleaseNotes', () => {
  test('posts the release-notes card + stamps the version when the seen version differs', () => {
    globalThis.game.user.getFlag.mockReturnValue('0.49.0')
    checkReleaseNotes()
    expect(ReleaseNotes.addChatCard).toHaveBeenCalledTimes(1)
    expect(globalThis.game.user.setFlag).toHaveBeenCalledWith('dcc', 'lastSeenSystemVersion', '0.50.0')
  })

  test('does NOT post the card when the seen version matches the current version', () => {
    globalThis.game.user.getFlag.mockReturnValue('0.50.0')
    checkReleaseNotes()
    expect(ReleaseNotes.addChatCard).not.toHaveBeenCalled()
    expect(globalThis.game.user.setFlag).not.toHaveBeenCalled()
  })

  test('registers a document click listener for the card action buttons', () => {
    checkReleaseNotes()
    expect(globalThis.document.addEventListener).toHaveBeenCalledWith('click', expect.any(Function))
  })
})

describe('onReady', () => {
  test('registers system settings and seeds the KeyState tracker', async () => {
    await onReady()
    expect(settings.registerSystemSettings).toHaveBeenCalledTimes(1)
    expect(globalThis.game.dcc.KeyState).toBeDefined()
    expect(globalThis.game.dcc.KeyState.tag).toBe('KeyState')
  })

  test('turns on the core Map Notes display default', async () => {
    const notesSetting = { default: false }
    globalThis.game.settings.settings.get.mockReturnValue(notesSetting)
    await onReady()
    expect(notesSetting.default).toBe(true)
  })

  test('initialises Fleeting Luck, Spell Duel, world tables and status icons', async () => {
    await onReady()
    expect(tableLoading.registerTables).toHaveBeenCalledTimes(1)
    expect(globalThis.game.dcc.FleetingLuck.init).toHaveBeenCalledTimes(1)
    expect(globalThis.game.dcc.SpellDuel.init).toHaveBeenCalledTimes(1)
    expect(statusIcons.defineStatusIcons).toHaveBeenCalledTimes(1)
  })

  test('threads the awaited migration status onto the dcc.ready broadcast', async () => {
    migrations.checkMigrations.mockResolvedValueOnce({ migrationComplete: false })
    await onReady()
    expect(globalThis.Hooks.callAll).toHaveBeenCalledWith('dcc.ready', { migrationComplete: false })
  })

  test('applies the dark-theme-icon-filter body class only when the setting is on', async () => {
    globalThis.game.settings.get.mockImplementation((scope, key) => key === 'disableDarkThemeIconFilter')
    await onReady()
    expect(bodyClassList.add).toHaveBeenCalledWith('disable-dark-theme-icon-filter')
  })

  test('applies the chat-cards-use-ui-theme body class when chatCardsUseAppTheme is off', async () => {
    // makeGame's settings.get returns false for everything → chatCardsUseAppTheme is false
    await onReady()
    expect(bodyClassList.add).toHaveBeenCalledWith('chat-cards-use-ui-theme')
  })

  test('shows the welcome dialog only for a GM with the setting enabled', async () => {
    globalThis.game.settings.get.mockImplementation((scope, key) => key === 'showWelcomeDialog')
    await onReady()
    expect(welcomeDialogModule.__render).toHaveBeenCalledWith(true)
  })

  test('does not show the welcome dialog for a non-GM', async () => {
    globalThis.game.user.isGM = false
    globalThis.game.settings.get.mockImplementation((scope, key) => key === 'showWelcomeDialog')
    await onReady()
    expect(welcomeDialogModule.__render).not.toHaveBeenCalled()
  })

  test('loads class progressions from packs and tolerates a loader failure', async () => {
    foundryDataLoader.registerClassProgressionsFromPacks.mockRejectedValueOnce(new Error('boom'))
    await expect(onReady()).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
    // The dcc.ready broadcast still fires even after a loader failure.
    expect(globalThis.Hooks.callAll).toHaveBeenCalledWith('dcc.ready', expect.any(Object))
  })
})

describe('registerReadyHook', () => {
  test('wires onReady onto Hooks.once(\'ready\')', () => {
    registerReadyHook()
    expect(globalThis.Hooks.once).toHaveBeenCalledTimes(1)
    expect(globalThis.Hooks.once).toHaveBeenCalledWith('ready', onReady)
  })
})

/**
 * Integration test setup - loads REAL Foundry VTT common modules
 *
 * Instead of mocking foundry.utils, foundry.data.fields, foundry.abstract, and CONST,
 * this imports the actual Foundry source code.
 *
 * Resolution order for finding Foundry:
 *   1. FOUNDRY_PATH environment variable
 *   2. .foundry-dev/ in the project root (populated by scripts/setup-foundry-dev.js)
 *   3. Known local install paths (~/Applications/foundry-13, etc.)
 *
 * What's real:
 * - foundry.utils (mergeObject, expandObject, getProperty, setProperty, deepClone, etc.)
 * - foundry.data.fields (SchemaField, NumberField, StringField, etc.)
 * - foundry.abstract (DataModel, TypeDataModel)
 * - CONST (ownership levels, chat modes, dice roll modes, etc.)
 * - Collection class
 *
 * What's still mocked (requires browser/server environment):
 * - game (settings, i18n, user, etc.)
 * - Actor, Item, ChatMessage (client-side Document classes)
 * - ApplicationV2, DialogV2 (UI framework)
 * - Roll (client-side dice engine)
 * - Hooks (event system - lightweight mock)
 * - ui (notifications, sidebar, etc.)
 */

import { vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import DCC from '../config.js'

// =============================================================================
// RESOLVE FOUNDRY PATH
// =============================================================================

function resolveFoundryPath () {
  // 1. Explicit env var (highest priority)
  if (process.env.FOUNDRY_PATH) {
    const p = process.env.FOUNDRY_PATH
    if (fs.existsSync(path.join(p, 'common'))) return p
    throw new Error(`FOUNDRY_PATH is set to "${p}" but no common/ directory found there`)
  }

  // 2. In-project .foundry-dev/ (populated by setup script)
  const projectRoot = path.resolve(import.meta.dirname, '..', '..')
  const devDir = path.join(projectRoot, '.foundry-dev')
  if (fs.existsSync(path.join(devDir, 'common'))) return devDir

  // 3. Known local install paths
  const knownPaths = [
    path.join(os.homedir(), 'Applications', 'foundry-13'),
    path.join(os.homedir(), 'Applications', 'foundryvtt'),
    '/Applications/FoundryVTT',
    path.join(os.homedir(), 'foundryvtt'),
    path.join(os.homedir(), '.local', 'share', 'FoundryVTT'),
    '/opt/foundryvtt'
  ]

  for (const searchPath of knownPaths) {
    if (fs.existsSync(path.join(searchPath, 'common'))) return searchPath
  }

  throw new Error(
    'Could not find Foundry VTT for integration tests.\n' +
    'Run: node scripts/setup-foundry-dev.js\n' +
    'Or set FOUNDRY_PATH environment variable.'
  )
}

const foundryPath = resolveFoundryPath()
const commonPath = path.join(foundryPath, 'common')

// =============================================================================
// REAL FOUNDRY IMPORTS - these are the actual Foundry implementations
// =============================================================================

// Utilities - the most broadly used and most likely to have subtle behavioral differences
const utils = await import(path.join(commonPath, 'utils', 'helpers.mjs'))
const Collection = (await import(path.join(commonPath, 'utils', 'collection.mjs'))).default

// Data fields - schema definition and validation engine
const fields = await import(path.join(commonPath, 'data', 'fields.mjs'))

// Abstract base classes - DataModel and TypeDataModel
const DataModel = (await import(path.join(commonPath, 'abstract', 'data.mjs'))).default
const TypeDataModel = (await import(path.join(commonPath, 'abstract', 'type-data.mjs'))).default

// Constants
const CONST = await import(path.join(commonPath, 'constants.mjs'))

// =============================================================================
// LIGHTWEIGHT MOCKS - minimal stubs for things that need browser/server
// =============================================================================

// Hooks - just enough to not crash when data models call Hooks.callAll
const Hooks = {
  on: vi.fn(),
  once: vi.fn(),
  callAll: vi.fn(),
  call: vi.fn()
}

// game - minimal mock for settings and i18n
const game = {
  i18n: {
    localize: vi.fn((key) => key),
    format: vi.fn((key, data) => key)
  },
  settings: {
    get: vi.fn((module, key) => undefined),
    set: vi.fn(),
    register: vi.fn()
  },
  user: { id: 'test-user', isGM: true },
  dcc: {
    DCCRoll: { createRoll: vi.fn() },
    DiceChain: {
      DICE_CHAIN: [3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30],
      rankDiceExpression: vi.fn()
    },
    FleetingLuck: { updateFlags: vi.fn() }
  }
}

// CONFIG - merge DCC config with minimal Foundry defaults
const CONFIG = {
  ...DCC,
  DCC,
  ActiveEffect: { legacyTransferral: false }
}

// ui mock
const ui = {
  notifications: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}

// =============================================================================
// ASSIGN GLOBALS - make real + mocked code available as Foundry globals
// =============================================================================

// The foundry namespace - mix of real and mocked
globalThis.foundry = {
  // REAL: utility functions from Foundry source
  utils: {
    mergeObject: utils.mergeObject,
    expandObject: utils.expandObject,
    getProperty: utils.getProperty,
    setProperty: utils.setProperty,
    hasProperty: utils.hasProperty,
    deepClone: utils.deepClone,
    duplicate: utils.duplicate,
    getType: utils.getType,
    isEmpty: utils.isEmpty,
    diffObject: utils.diffObject,
    flattenObject: utils.flattenObject,
    filterObject: utils.filterObject,
    randomID: utils.randomID,
    Collection
  },
  // REAL: data field classes from Foundry source
  data: {
    fields
  },
  // REAL: abstract base classes from Foundry source
  abstract: {
    DataModel,
    TypeDataModel
  },
  // MOCKED: application layer (needs browser)
  applications: {
    api: {
      HandlebarsApplicationMixin: (Base) => class extends Base {},
      ApplicationV2: class ApplicationV2 {}
    },
    sheets: {
      ActorSheetV2: class ActorSheetV2 {},
      DocumentSheetV2: class DocumentSheetV2 {}
    },
    apps: {
      DialogV2: class DialogV2 {}
    },
    ux: {
      TextEditor: {
        enrichHTML: vi.fn(async (content) => content)
      }
    }
  }
}

// REAL constants
globalThis.CONST = CONST

// Mocked globals
globalThis.Hooks = Hooks
globalThis.game = game
globalThis.CONFIG = CONFIG
globalThis.ui = ui

// Real utility on global scope (some DCC code references these directly)
globalThis.getType = utils.getType
globalThis.setProperty = utils.setProperty

// Read version info if available
let versionInfo = 'unknown'
try {
  const pkgPath = path.join(foundryPath, 'package.json')
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    versionInfo = pkg.version || 'unknown'
  }
} catch { /* ignore */ }

console.log(`[integration] Foundry v${versionInfo} from: ${commonPath}`)
console.log('[integration] Real: foundry.utils, foundry.data.fields, foundry.abstract, CONST')
console.log('[integration] Mocked: game, Hooks, ui, ApplicationV2, Actor, Item')

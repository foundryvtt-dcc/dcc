/**
 * Dice engine setup for integration tests - loads REAL Foundry dice engine
 *
 * Wires up Roll, RollParser, all term classes, MersenneTwister, and the compiled
 * PEG grammar. Called from setup-foundry.js after globals are established.
 *
 * What's real:
 * - Roll class (formula parsing, evaluation, variable substitution)
 * - RollParser (PEG grammar → AST → RollTerm instances)
 * - All term classes (Die, Coin, FateDie, NumericTerm, OperatorTerm, etc.)
 * - MersenneTwister PRNG (seeded for deterministic testing)
 * - RollGrammar (pre-compiled PEG parser)
 */

import fs from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..', '..')
const foundryDevDir = path.join(projectRoot, '.foundry-dev')
const dicePath = path.join(foundryDevDir, 'client', 'dice')

// Verify dice engine files exist
if (!fs.existsSync(path.join(dicePath, '_module.mjs'))) {
  throw new Error('Dice engine not found in .foundry-dev/client/dice/')
}

// =============================================================================
// IMPORT DICE ENGINE
// =============================================================================

// Import the dice module - pulls in Roll, RollParser, terms, grammar, MersenneTwister
const diceModule = await import(path.join(dicePath, '_module.mjs'))
const { Roll, RollParser, MersenneTwister, RollGrammar, terms } = diceModule

// Extract individual term classes
const {
  Coin,
  DiceTerm,
  Die,
  FateDie,
  FunctionTerm,
  NumericTerm,
  OperatorTerm,
  ParentheticalTerm,
  PoolTerm,
  RollTerm,
  StringTerm
} = terms

// =============================================================================
// WIRE UP CONFIG.Dice
// =============================================================================

// Create seeded PRNG for deterministic test results
const twister = new MersenneTwister(42)

// CONFIG.Dice - the dice engine reads this at runtime
globalThis.CONFIG.Dice = {
  parser: RollParser,
  terms: { d: Die, c: Coin, f: FateDie },
  termTypes: {
    Coin,
    DiceTerm,
    Die,
    FateDie,
    FunctionTerm,
    NumericTerm,
    OperatorTerm,
    ParentheticalTerm,
    PoolTerm,
    RollTerm,
    StringTerm
  },
  rolls: [Roll],
  functions: {},
  fulfillment: {
    defaultMethod: 'digital',
    methods: {
      digital: { handler: null, interactive: false }
    }
  },
  randomUniform: () => twister.random()
}

globalThis.CONFIG.debug = { ...(globalThis.CONFIG.debug || {}), dice: false, rollParsing: false }

// =============================================================================
// WIRE UP foundry.dice NAMESPACE
// =============================================================================

globalThis.foundry.dice = {
  terms: {
    Coin,
    DiceTerm,
    Die,
    FateDie,
    FunctionTerm,
    NumericTerm,
    OperatorTerm,
    ParentheticalTerm,
    PoolTerm,
    RollTerm,
    StringTerm
  },
  RollGrammar,
  Roll,
  RollParser,
  MersenneTwister
}

// =============================================================================
// WIRE UP foundry.applications.dice (stub for resolverImplementation)
// =============================================================================

// The Roll class references foundry.applications.dice.RollResolver in resolverImplementation getter
// The resolver must support addTerm and resolveResult methods used during async evaluation
globalThis.foundry.applications.dice = {
  RollResolver: class RollResolver {
    constructor () { this._fulfilled = Promise.resolve() }
    async awaitFulfillment () {}
    async addTerm () {}
    async resolveResult () {}
    close () {}
  }
}

// =============================================================================
// GLOBAL Roll
// =============================================================================

globalThis.Roll = Roll

// =============================================================================
// MOCK game.settings.get for dice configuration
// =============================================================================

// Override game.settings.get to return {} for diceConfiguration
const originalSettingsGet = globalThis.game.settings.get
globalThis.game.settings.get = (module, key) => {
  if (module === 'core' && key === 'diceConfiguration') return {}
  return originalSettingsGet(module, key)
}

// Ensure game.user.hasPermission exists for manual roll checks
if (!globalThis.game.user.hasPermission) {
  globalThis.game.user.hasPermission = () => true
}

/* global Actor, ChatMessage, CONFIG, CONST, Roll, game, ui, foundry */
// noinspection JSUnresolvedReference

import { ensurePlus } from './utilities.js'
import DCCActorLevelChange from './actor-level-change.js'
import {
  rollAbilityCheck as libRollAbilityCheck,
  rollCheck as libRollCheck,
  rollLuckCheck as libRollLuckCheck,
  rollSavingThrow as libRollSavingThrow
} from './vendor/dcc-core-lib/index.js'
import { actorToCharacter, foundrySaveIdToLib } from './adapter/character-accessors.mjs'
import { renderAbilityCheck, renderAbilityCheckRollUnder, renderSavingThrow, renderSkillCheck } from './adapter/chat-renderer.mjs'
import { promptRollModifierDialog } from './adapter/roll-dialog.mjs'
import { normalizeLibDie } from './adapter/attack-input.mjs'
import { logDispatch, withRollErrorBoundary, withRollErrorBoundarySync } from './adapter/debug.mjs'
import { ActiveEffectsMixin } from './actor/active-effects-mixin.mjs'
import { DerivedStatsMixin } from './actor/derived-stats-mixin.mjs'
import { RollDataMixin } from './actor/roll-data-mixin.mjs'
import { applyForceCritToFoundryRoll } from './actor/force-crit.mjs'
import { RollsSpellMixin } from './actor/rolls-spell-mixin.mjs'
import { RollsWeaponMixin } from './actor/rolls-weapon-mixin.mjs'

// noinspection JSUnusedGlobalSymbols
/**
 * Extend the base Actor entity by defining a custom roll data structure.
 * @extends {Actor}
 */
class DCCActor extends RollsWeaponMixin(RollsSpellMixin(RollDataMixin(DerivedStatsMixin(ActiveEffectsMixin(Actor))))) {
  /**
   * Canonical lowercase class identifier for this actor, or `null` if
   * `system.details.sheetClass` is empty. Use this for class dispatch
   * (e.g. `actor.classId === 'halfling'`) instead of comparing the
   * raw `sheetClass` field, which stores the capitalized sheet label
   * and may shift form when the lib's `Character.classId` projection
   * lands in a later phase.
   * @returns {string | null}
   */
  get classId () {
    const sheetClass = this.system?.details?.sheetClass
    return typeof sheetClass === 'string' && sheetClass.length > 0
      ? sheetClass.toLowerCase()
      : null
  }

  /** @override */
  prepareBaseData () {
    super.prepareBaseData()

    this.isNPC = (this.type === 'NPC')
    this.isPC = (this.type === 'Player')

    // Ensure HP values are numbers
    if (this.system.attributes?.hp) {
      if (this.system.attributes.hp.max !== undefined) {
        this.system.attributes.hp.max = Number(this.system.attributes.hp.max) || 0
      }
      if (this.system.attributes.hp.value !== undefined) {
        this.system.attributes.hp.value = Number(this.system.attributes.hp.value) || 0
      }
    }

    // Ability modifiers
    const abilities = this.system.abilities
    for (const abilityId in abilities) {
      abilities[abilityId].mod = CONFIG.DCC.abilityModifiers[abilities[abilityId].value] || 0
      abilities[abilityId].maxMod = CONFIG.DCC.abilityModifiers[abilities[abilityId].max] || abilities[abilityId].mod
    }

    // Get configuration data
    const config = this._getConfig()
    const data = this.system

    // Set NPC computations to manual
    if (this.isNPC) {
      this.system.config.computeAC = false
      this.system.config.computeSpeed = false
      this.system.config.computeCheckPenalty = false
      this.system.config.computeMeleeAndMissileAttackAndDamage = false
    }

    // Cap level if required
    if (config.maxLevel) {
      data.details.level.value = Math.max(0, Math.min(data.details.level.value, parseInt(config.maxLevel)))
    }

    // Determine the correct fumble die and check penalty to use based on armor
    let fumbleDieRank = 0
    let fumbleDie = '1d4'
    let checkPenalty = 0
    if (this.itemTypes?.armor) {
      for (const armorItem of this.itemTypes.armor) {
        if (armorItem.system.equipped) {
          try {
            checkPenalty += parseInt(armorItem.system.checkPenalty || 0)
            const expression = armorItem.system.fumbleDie
            const rank = game.dcc.DiceChain.rankDiceExpression(expression)
            if (rank > fumbleDieRank) {
              fumbleDieRank = rank
              fumbleDie = expression
            }
          } catch (err) {
            // Ignore bad fumble die expressions
          }
        }
      }
    }
    data.attributes.fumble = foundry.utils.mergeObject(
      data.attributes.fumble || {},
      { die: fumbleDie }
    )
    if (data.config.computeCheckPenalty) {
      data.attributes.ac.checkPenalty = checkPenalty
    }

    // Compute derived values in prepareBaseData so items can access them during their preparation.
    // These will be called again in prepareDerivedData to update with any active effect
    // modifications to ability modifiers.
    if (config.computeMeleeAndMissileAttackAndDamage) {
      this.computeMeleeAndMissileAttackAndDamage()
    }

    // Compute spell check for PCs so spell items can inherit it
    if (this.isPC) {
      this.computeSpellCheck()
    }

    // Compute initiative for PCs so weapon items can access it
    if (this.isPC && config.computeInitiative) {
      this.computeInitiative(config)
    }
  }

  /**
   * Compute the displayed Speed from its component parts.
   *
   * Kept as a pure static so the arithmetic is unit-testable without a full
   * actor prepare cycle (see __tests__/speed-compute.test.js).
   *
   * value = base + manual modifier + armor penalty + active-effect delta,
   * where the active-effect delta is the difference between the post-effect
   * in-memory value and the persisted (`_source`) value. Deriving the delta
   * from `_source` — rather than from baseSpeed — is what lets Config edits to
   * Base Speed reach the sheet (#739); the previous implementation used
   * `currentValue - baseSpeed`, which cancelled baseSpeed entirely.
   *
   * @param {object} parts
   * @param {number|string} parts.base          Configured base speed
   * @param {number|string} parts.otherMod      Manual flat modifier
   * @param {number|string} parts.armorPenalty  Summed armor speed penalty
   * @param {number|string} parts.currentValue  In-memory (post-effect) value
   * @param {number|string} parts.sourceValue   Persisted (pre-effect) value
   * @returns {number} The computed speed value
   */
  static computeSpeedValue ({ base, otherMod, armorPenalty, currentValue, sourceValue } = {}) {
    const baseSpeed = parseInt(base) || 0
    const mod = parseInt(otherMod) || 0
    const penalty = parseInt(armorPenalty) || 0
    const current = parseInt(currentValue)
    const source = parseInt(sourceValue)
    const aeModifier = (isNaN(current) || isNaN(source)) ? 0 : current - source
    return baseSpeed + mod + penalty + aeModifier
  }

  /** @override */
  prepareDerivedData () {
    super.prepareDerivedData()
    if (!this.overrides) this.overrides = {}

    // Recalculate ability modifiers after Active Effects have been applied
    // This ensures effects that modify ability values (e.g. +2 to str.value) are reflected in the modifiers
    const abilities = this.system.abilities
    for (const abilityId in abilities) {
      abilities[abilityId].mod = CONFIG.DCC.abilityModifiers[abilities[abilityId].value] || 0
      abilities[abilityId].maxMod = CONFIG.DCC.abilityModifiers[abilities[abilityId].max] || abilities[abilityId].mod
    }

    // Get configuration data
    const config = this._getConfig()

    // Compute melee/missile attack and damage bonuses (after effects have modified ability modifiers)
    if (config.computeMeleeAndMissileAttackAndDamage) {
      this.computeMeleeAndMissileAttackAndDamage()
    }

    // Compute spell check and saving throws for PCs (after effects have modified ability modifiers)
    if (this.isPC) {
      this.computeSpellCheck()
      if (config.computeSavingThrows) {
        this.computeSavingThrows()
      }
    }

    if (this.classId === 'elf') {
      this.system.skills.detectSecretDoors.value = '+4'
    }

    // For NPCs, add otherBonus to displayed save values (tracked as overrides for #714)
    if (this.isNPC) {
      const saves = this.system.saves
      for (const saveId of ['ref', 'frt', 'wil']) {
        const otherBonus = parseInt(saves[saveId].otherBonus || 0)
        if (otherBonus !== 0) {
          const baseValue = parseInt(saves[saveId].value || 0)
          saves[saveId].value = baseValue + otherBonus
          this.overrides[`system.saves.${saveId}.value`] = saves[saveId].value
        }
      }
    }

    // For NPCs, add init.otherMod to init.value (after effects are applied)
    if (this.isNPC) {
      const initOtherMod = parseInt(this.system.attributes.init.otherMod || 0)
      if (initOtherMod !== 0) {
        const baseInit = parseInt(this.system.attributes.init.value || 0)
        this.system.attributes.init.value = baseInit + initOtherMod
        this.overrides['system.attributes.init.value'] = this.system.attributes.init.value
      }
    }

    // For NPCs with computeAC disabled, add ac.otherMod to ac.value (after effects are applied)
    if (this.isNPC && !config.computeAC) {
      const acOtherMod = parseInt(this.system.attributes.ac.otherMod || 0)
      if (acOtherMod !== 0) {
        const baseAC = parseInt(this.system.attributes.ac.value || 10)
        this.system.attributes.ac.value = baseAC + acOtherMod
        this.overrides['system.attributes.ac.value'] = this.system.attributes.ac.value
      }
    }

    // Seed base speed from the persisted speed for older actors that stored no
    // base field at all (runtime safety net; the one-time migration corrects
    // actors whose base defaulted to '30'). Read from _source so a
    // schema-defaulted base does not mask a genuinely-unset value.
    if (this._source?.system?.attributes?.speed?.base === undefined ||
        this._source?.system?.attributes?.speed?.base === '') {
      this.system.attributes.speed.base = this.system.attributes.speed.value
    }

    // Compute AC if required
    if (config.computeAC || config.computeSpeed) {
      const baseACAbility = this.system.abilities[config.baseACAbility] || { mod: 0 }
      const abilityMod = baseACAbility.mod
      const acOtherMod = parseInt(this.system.attributes.ac.otherMod) || 0
      const abilityLabel = baseACAbility.label
      let armorBonus = 0
      let speedPenalty = 0
      for (const armorItem of this.itemTypes.armor) {
        if (armorItem.system.equipped) {
          armorBonus += parseInt(armorItem.system.acBonus || '0')
          speedPenalty += parseInt(armorItem.system.speed || '0')
        }
      }
      if (config.computeAC) {
        this.system.attributes.ac.baseAbility = abilityMod
        this.system.attributes.ac.baseAbilityLabel = abilityLabel
        this.system.attributes.ac.armorBonus = armorBonus
        this.system.attributes.ac.value = 10 + abilityMod + armorBonus + acOtherMod
      }
      if (config.computeSpeed) {
        this.system.attributes.ac.speedPenalty = speedPenalty
        this.system.attributes.speed.value = DCCActor.computeSpeedValue({
          base: this.system.attributes.speed.base,
          otherMod: this.system.attributes.speed.otherMod,
          armorPenalty: speedPenalty,
          currentValue: this.system.attributes.speed.value,
          sourceValue: this._source?.system?.attributes?.speed?.value
        })
      }
    }

    // Compute Initiative if required
    if (this.isPC && config.computeInitiative) {
      this.computeInitiative(config)
    }

    // Re-prepare embedded items so they can see active effect modifications
    // Items initially prepare before applyActiveEffects runs, so they need
    // to re-read actor values that may have been modified by effects
    for (const item of this.items) {
      item.prepareData()
    }
  }

  /**
   * Get per actor configuration
   *
   * @return {Object}       Configuration data
   */
  _getConfig () {
    let defaultConfig = {
      attackBonusMode: 'flat',
      actionDice: '1d20',
      maxLevel: '',
      computeAC: false,
      computeMeleeAndMissileAttackAndDamage: true,
      computeSpeed: false,
      baseACAbility: 'agl',
      sortInventory: true,
      removeEmptyItems: true,
      showSpells: false,
      showSkills: false,
      showBackstab: false
    }

    // Merge any existing data with defaults to implicitly migrate missing config fields
    defaultConfig = Object.assign(defaultConfig, this.system.config)
    this.system.config = defaultConfig

    return defaultConfig
  }

  /**
   * Level Change
   */
  levelChange () {
    new DCCActorLevelChange({ document: this }).render(true)
  }

  /**
   * Roll an Ability Check.
   *
   * Single-path through the adapter (legacy fully decommissioned for
   * this dispatcher): every flavour — the simple two-pass
   * `libRollAbilityCheck` flow, the roll-under (Luck) flow, the
   * modifier dialog, and the non-zero armor check-penalty display — is
   * handled adapter-side in `_rollAbilityCheckViaAdapter`. The former
   * `_rollAbilityCheckLegacy` body was deleted at Phase 7 session 25.
   *
   * Signature and emitted chat-message flags are preserved — dcc-qol
   * and token-action-hud-dcc depend on the public shape of this
   * method.
   *
   * @param {String} abilityId  The ability ID (e.g. "str")
   * @param {Object} options    Options which configure how ability checks are rolled
   */
  async rollAbilityCheck (abilityId, options = {}) {
    return withRollErrorBoundary('rollAbilityCheck', game.i18n.localize('DCC.Check'), () => {
      // Roll-under (Luck checks): a naked d20 vs the Luck score, no
      // modifiers and no check-penalty display. Routes through the lib's
      // dedicated `rollLuckCheck` rather than the standard ability-check
      // two-pass flow. Truthy check — the sheet's fillRollOptions uses
      // bitwise XOR, which returns 0 or 1, not true/false.
      if (options.rollUnder) {
        return this._rollLuckCheckViaAdapter(abilityId, options)
      }

      return this._rollAbilityCheckViaAdapter(abilityId, options)
    })
  }

  /**
   * Adapter path for ability checks. Two-pass sync flow:
   * pass 1 asks the lib for the formula (no evaluation), Foundry
   * rolls it, pass 2 classifies against the same natural for crit
   * / fumble and emits the chat message via the renderer.
   * @private
   */
  async _rollAbilityCheckViaAdapter (abilityId, options) {
    logDispatch('rollAbilityCheck', 'adapter', { abilityId })
    const abilityLabel = game.i18n.localize(CONFIG.DCC.abilities[abilityId])

    const character = actorToCharacter(this)

    // Roll-modifier dialog (legacy-decom step 2): mirror the skill-check
    // adapter dialog. Build the legacy ability-check term list, surface
    // the unified modifier dialog adapter-side, then route the user's
    // flattened die + total through the lib via `rollCheck`.
    if (options.showModifierDialog) {
      return this._rollAbilityCheckWithDialog(abilityId, options, abilityLabel, character)
    }

    // Pass 1: ask the lib for the formula it wants rolled (no evaluation).
    const plan = libRollAbilityCheck(abilityId, character, {
      mode: 'formula',
      luckBurn: options.luckBurn
    })

    // Foundry rolls the FULL formula so the Roll object has the correct
    // display-total (dice + modifiers), not just the naked dice total.
    // Keep the Roll reference; .evaluate() returns `this` in real Foundry
    // but returns a plain object in some test mocks.
    const foundryRoll = new Roll(plan.formula)
    await foundryRoll.evaluate()

    // Extract the natural die value from the Foundry Roll so the lib's
    // second pass classifies against the same dice outcome we'll display.
    const primaryDie = foundryRoll.dice?.[0]
    const natural = primaryDie?.total ?? foundryRoll.total

    // Pass 2: lib classifies the rolled result (crit / fumble / resources /
    // applied flags on modifiers). The sync roller returns the pre-rolled
    // natural so the lib doesn't re-roll.
    const result = libRollAbilityCheck(abilityId, character, {
      mode: 'evaluate',
      roller: () => natural,
      luckBurn: options.luckBurn
    })

    // Non-zero armor check penalty (str/agl) display (legacy-decom
    // step 3). The penalty is NOT applied to the result — the lib roll
    // is clean — so we show the would-be total as a secondary roll the
    // chat handler (`emoteAbilityRoll`) renders as the "If check penalty
    // applies, total is X" note, reproducing the legacy contract.
    const checkPenaltyRoll = await this._buildCheckPenaltyAltRoll(abilityId, foundryRoll.total)

    return renderAbilityCheck({
      actor: this,
      abilityId,
      abilityLabel,
      result,
      foundryRoll,
      checkPenaltyRoll
    })
  }

  /**
   * Build the secondary "would-be total" Roll for a non-zero armor
   * check penalty on a str/agl ability check (legacy-decom step 3).
   *
   * DCC shows the armor check penalty on Str/Agl ability checks as an
   * informational alternative total ("If check penalty applies, total
   * is X") rather than applying it to the result — the GM decides per
   * check whether the penalty bites. This reproduces the former legacy
   * ability-check behaviour: a bare Roll wrapping `mainTotal + penalty`,
   * surfaced via `checkPenaltyRollIndex` and rendered by
   * `emoteAbilityRoll` (module/chat.js).
   *
   * Returns null (no note) when the penalty doesn't apply: a non-str/agl
   * ability, check-penalty computation disabled, a zero penalty, or
   * (dialog path) the user already toggled the penalty into the roll.
   *
   * @param {string} abilityId   The ability id (e.g. 'str').
   * @param {number} mainTotal   The clean rolled total to add the
   *                             penalty to.
   * @param {Object} [opts]
   * @param {boolean} [opts.alreadyApplied]  When true the penalty was
   *                             already folded into the roll (dialog
   *                             path) so no alternative is shown.
   * @returns {Promise<Roll|null>}
   * @private
   */
  async _buildCheckPenaltyAltRoll (abilityId, mainTotal, { alreadyApplied = false } = {}) {
    if (alreadyApplied) return null
    if (abilityId !== 'str' && abilityId !== 'agl') return null
    if (!this.system.config?.computeCheckPenalty) return null
    const penalty = parseInt(this.system.attributes?.ac?.checkPenalty || 0)
    if (!penalty) return null
    const altRoll = new Roll((mainTotal + penalty).toString())
    await altRoll.evaluate()
    return altRoll
  }

  /**
   * Roll-modifier-dialog branch of the ability-check adapter path
   * (legacy-decom step 2). The dialog term list mirrors the former
   * legacy ability-check builder (action die + ability modifier, plus a
   * check-penalty toggle for str/agl when penalties are computed). Since
   * step 3 the penalty may be non-zero here: if the user toggles it on
   * it folds into `modifierTotal` and applies to the roll; if left off,
   * the would-be total is shown as the alternative note (matching the
   * non-dialog path), detected via the same `formula.includes(penalty)`
   * check the former legacy path used.
   *
   * On submit, the user's chosen die overrides the lib definition and
   * the per-source modifier list collapses to a single flat total — the
   * dialog flattens every non-die term on submit, losing per-source
   * attribution, so (like the skill-check dialog) we route through
   * `rollCheck` with a bare definition + one `dialog-modifier` line
   * rather than the `rollAbilityCheck` wrapper (which would auto-add the
   * ability mod the dialog total already includes).
   * @private
   */
  async _rollAbilityCheckWithDialog (abilityId, options, abilityLabel, character) {
    const ability = this.system.abilities[abilityId]
    const abilityMod = CONFIG.DCC.abilityModifiers[ability.value] || 0
    const flavor = `${abilityLabel} ${game.i18n.localize('DCC.Check')}`
    const die = this.system.attributes.actionDice.value || '1d20'

    const terms = [
      {
        type: 'Die',
        label: game.i18n.localize('DCC.ActionDie'),
        formula: die,
        presets: this.getActionDice({ includeUntrained: true })
      },
      {
        type: 'Modifier',
        label: abilityLabel,
        formula: ensurePlus(abilityMod)
      }
    ]
    if (this.system.config?.computeCheckPenalty && (abilityId === 'str' || abilityId === 'agl')) {
      terms.push({
        type: 'CheckPenalty',
        formula: ensurePlus(this.system.attributes.ac.checkPenalty || '0'),
        apply: false
      })
    }

    const prompt = await promptRollModifierDialog(terms, {
      rollData: this.getRollData(),
      title: options.title || flavor,
      rollLabel: game.i18n.localize('DCC.RollModifierRoll')
    })
    if (prompt === null) return

    const libDie = (prompt.actionDie && this._stripDieCount(prompt.actionDie)) ||
      this._stripDieCount(die) || 'd20'

    const definition = {
      id: `ability-${abilityId}`,
      name: abilityLabel,
      type: 'check',
      roll: { die: libDie }
    }

    const modifiers = []
    if (prompt.modifierTotal !== 0) {
      modifiers.push({
        kind: 'add',
        value: prompt.modifierTotal,
        origin: {
          category: 'other',
          id: 'dialog-modifier',
          label: options.title || flavor
        }
      })
    }

    logDispatch('rollAbilityCheck', 'adapter', {
      abilityId,
      dialog: true,
      actionDie: prompt.actionDie,
      modifierTotal: prompt.modifierTotal
    })

    // Pass 1: lib builds the formula (no evaluation).
    const plan = libRollCheck(definition, character, { mode: 'formula', modifiers })
    const foundryRoll = new Roll(plan.formula)
    await foundryRoll.evaluate()
    const natural = foundryRoll.dice?.[0]?.total ?? foundryRoll.total

    // Pass 2: lib classifies against the rolled natural.
    const result = libRollCheck(definition, character, {
      mode: 'evaluate',
      roller: () => natural,
      modifiers
    })

    // Non-zero check-penalty note (legacy-decom step 3). If the user
    // toggled the CheckPenalty term on, the penalty is already in the
    // dialog roll's formula (and thus in the lib total) — show no
    // alternative. Otherwise surface the would-be total, mirroring the
    // legacy `roll.formula.includes(ensurePlus(checkPenalty))` check.
    const penalty = parseInt(this.system.attributes?.ac?.checkPenalty || 0)
    const penaltyApplied = penalty !== 0 && prompt.formula.includes(ensurePlus(penalty))
    const checkPenaltyRoll = await this._buildCheckPenaltyAltRoll(
      abilityId,
      foundryRoll.total,
      { alreadyApplied: penaltyApplied }
    )

    return renderAbilityCheck({
      actor: this,
      abilityId,
      abilityLabel,
      result,
      foundryRoll,
      checkPenaltyRoll
    })
  }

  /**
   * Adapter path for roll-under ability checks (Luck checks). DCC luck
   * checks use roll-under mechanics — roll 1d20, succeed if the result
   * is ≤ the Luck score, no modifiers — so this routes through the lib's
   * dedicated `rollLuckCheck` rather than the standard ability-check
   * two-pass flow. Foundry owns the d20 (so chat shows the real dice);
   * the lib classifies success against the same natural.
   *
   * Roll-under is Luck-only in practice — the only triggers (`#rollAbilityCheck`,
   * the `luck-roll-under` template class, the roll-under macro) all gate
   * on `lck`. The lib's `getLuck` reads the same `system.abilities.lck.value`
   * the legacy roll-under threshold used, so the success boundary is
   * unchanged.
   * @private
   */
  async _rollLuckCheckViaAdapter (abilityId, options) {
    logDispatch('rollAbilityCheck', 'adapter', { abilityId, rollUnder: true })
    const abilityLabel = game.i18n.localize(CONFIG.DCC.abilities[abilityId])
    const character = actorToCharacter(this)

    // Roll-under is a naked d20 — no modifiers, so no formula pass is
    // needed. Foundry evaluates the die so chat shows the real result.
    const foundryRoll = new Roll('1d20')
    await foundryRoll.evaluate()
    const primaryDie = foundryRoll.dice?.[0]
    const natural = primaryDie?.total ?? foundryRoll.total

    // Lib classifies success (roll ≤ Luck score) against the same natural.
    const result = libRollLuckCheck(character, {
      roller: () => natural,
      label: abilityLabel
    })

    return renderAbilityCheckRollUnder({
      actor: this,
      abilityId,
      abilityLabel,
      result,
      foundryRoll
    })
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Generate Initiative Roll formula. Invoked by Foundry's core init
   * flow via `DCCCombatant.getInitiativeRoll`, and by `rollInit` when
   * a modifier dialog is requested.
   *
   * Phase 1 adapter dispatcher. The default (no-dialog) path flows
   * through the lib via `rollCheck(mode: 'formula')` — the lib builds
   * the formula string, Foundry evaluates it. Init has no gameplay
   * crit/fumble semantics, so there's no pass-2 classification; the
   * chat message is emitted by Foundry's core `Combat#rollInitiative`
   * (with the `core.initiativeRoll` flag that `emoteInitiativeRoll`
   * gates on). The dialog path routes through
   * `_getInitiativeRollWithDialogViaAdapter`, which surfaces the unified
   * modifier dialog adapter-side and hands back the user's dialog-built
   * Roll (legacy-decom step 2).
   *
   * Return shape is unchanged: a Foundry `Roll` the combat tracker
   * evaluates.
   */
  getInitiativeRoll (formula, options = {}) {
    // SYNC boundary — `getInitiativeRoll` must stay synchronous because
    // `DCCCombatant.getInitiativeRoll` overrides Foundry core's sync
    // `Combatant.getInitiativeRoll` contract (combat tracker expects a
    // `Roll`, not a Promise). The whole init path is sync by design.
    return withRollErrorBoundarySync('getInitiativeRoll', game.i18n.localize('DCC.Initiative'), () => {
      // Handle coming back from a modifier dialog with a pre-built Roll.
      if (formula instanceof Roll) {
        return formula
      }

      // Roll-modifier dialog (legacy-decom step 2). The dialog is async
      // and is only ever reached via `rollInit`, which awaits the
      // returned promise — so the dialog branch returns a Promise<Roll>
      // through this sync boundary (matching the pre-step-2 legacy path,
      // which also returned a promise here). The combat-tracker path (no
      // dialog) stays synchronous so `DCCCombatant.getInitiativeRoll` can
      // hand back a `Roll` directly. Truthy check — the sheet's
      // fillRollOptions uses bitwise XOR, which returns 0 or 1.
      if (options.showModifierDialog) {
        return this._getInitiativeRollWithDialogViaAdapter(options)
      }

      return this._getInitiativeRollViaAdapter()
    })
  }

  /**
   * Adapter path for initiative. Builds a lib `SkillDefinition` with
   * no ability (init.value already bakes in agl mod + otherMod + class
   * level from `computeInitiative`), emits init.value as a single
   * aggregate `add` modifier, and asks the lib for the formula string.
   * Weapon-die overrides (two-handed / custom init die) are applied
   * Foundry-side because the `[Two-Handed]` / `[Weapon]` die label is
   * a Foundry display idiom the lib doesn't model.
   *
   * Takes no options: the modifier-dialog bridge lives entirely in the
   * sibling `_getInitiativeRollWithDialogViaAdapter`, which the caller
   * routes to on `options.showModifierDialog`. This no-dialog path reads
   * only actor + equipped-weapon state, so there's nothing for an
   * `options` argument to influence.
   * @private
   */
  _getInitiativeRollViaAdapter () {
    let dieFormula = this.system.attributes.init.die || '1d20'
    let weaponLabel = null

    // Single pass over items: gather the first equipped two-handed weapon and
    // the first equipped custom-init-die weapon together (was two separate
    // `items.find` scans). Apply order is preserved — a custom-init-die weapon
    // still overrides a two-handed one.
    let twoHandedWeapon = null
    let customInitDieWeapon = null
    for (const t of this.items) {
      if (!t.system.equipped) continue
      if (!twoHandedWeapon && t.system.twoHanded) twoHandedWeapon = t
      if (!customInitDieWeapon && (t.system.config?.initiativeDieOverride || '')) customInitDieWeapon = t
    }
    if (twoHandedWeapon) {
      dieFormula = twoHandedWeapon.system.initiativeDie
      weaponLabel = game.i18n.localize('DCC.WeaponPropertiesTwoHanded')
    }
    if (customInitDieWeapon) {
      dieFormula = customInitDieWeapon.system.initiativeDie
      weaponLabel = game.i18n.localize('DCC.Weapon')
    }

    logDispatch('rollInit', 'adapter', { die: dieFormula })

    const libDie = this._stripDieCount(dieFormula) || 'd20'
    const initValue = parseInt(this.system.attributes.init.value) || 0

    const definition = {
      id: 'initiative',
      name: game.i18n.localize('DCC.Initiative'),
      type: 'check',
      roll: {
        die: libDie,
        levelModifier: 'none'
      }
    }

    const modifiers = initValue !== 0
      ? [{
          kind: 'add',
          value: initValue,
          origin: {
            category: 'other',
            id: 'initiative-total',
            label: game.i18n.localize('DCC.Initiative')
          }
        }]
      : []

    const character = actorToCharacter(this)
    const plan = libRollCheck(definition, character, {
      mode: 'formula',
      modifiers
    })

    // Re-inject the Foundry `[Two-Handed]` / `[Weapon]` die label so the
    // Roll Breakdown surfaces where the die came from.
    const finalFormula = weaponLabel
      ? plan.formula.replace(/^(1d\d+)/i, `$1[${weaponLabel}]`)
      : plan.formula

    // Re-append any additive init-die tail (e.g. MCC's Mutant Horror folds
    // its die into init.die as `1d20+1d3`, up to `1d20+1d7+7` at higher
    // levels). The lib models initiative as a single die + flat modifiers,
    // so an *additive die* is a Foundry-side idiom it can't represent — we
    // re-append it the same way as the weapon-die label above. Computed
    // from the actor's own `init.die` (not the possibly weapon-overridden
    // `dieFormula`) and suppressed when a weapon override is in effect: an
    // equipped two-handed / `initiativeDieOverride` weapon replaces the
    // init die entirely (matches `main` + the legacy dialog path).
    const additiveInitTerms = weaponLabel
      ? ''
      : this._initDieAdditiveTerms(this.system.attributes.init.die || '')
    const rolledFormula = additiveInitTerms
      ? `${finalFormula} ${additiveInitTerms}`
      : finalFormula

    return new Roll(rolledFormula, this.getRollData())
  }

  /**
   * Roll-modifier-dialog branch of the initiative adapter path
   * (legacy-decom step 2). Builds a structured term list (init die —
   * including any additive tail folded into `init.die`, plus weapon-die
   * overrides — and the flat initiative modifier) and surfaces the
   * unified modifier dialog adapter-side via `promptRollModifierDialog`.
   *
   * Unlike the ability / save dialogs, initiative does NOT round-trip
   * through the lib: init has no crit/fumble semantics and Foundry's
   * `Combat#rollInitiative` posts the chat (with the
   * `flags.core.initiativeRoll` the emote handler gates on), so we hand
   * back the user's dialog-built `Roll` for Foundry to evaluate. Async;
   * only reached via `rollInit`, which awaits the returned promise.
   * @private
   */
  async _getInitiativeRollWithDialogViaAdapter (options = {}) {
    let die = this.system.attributes.init.die || '1d20'
    const init = ensurePlus(this.system.attributes.init.value)
    options.title = game.i18n.localize('DCC.RollModifierTitleInitiative')

    // Single pass over items (see `_getInitiativeRollViaAdapter`): first
    // equipped two-handed + first equipped custom-init-die weapon, custom
    // overrides two-handed.
    let twoHandedWeapon = null
    let customInitDieWeapon = null
    for (const t of this.items) {
      if (!t.system.equipped) continue
      if (!twoHandedWeapon && t.system.twoHanded) twoHandedWeapon = t
      if (!customInitDieWeapon && (t.system.config?.initiativeDieOverride || '')) customInitDieWeapon = t
    }
    if (twoHandedWeapon) {
      die = `${twoHandedWeapon.system.initiativeDie}[${game.i18n.localize('DCC.WeaponPropertiesTwoHanded')}]`
    }
    if (customInitDieWeapon) {
      die = `${customInitDieWeapon.system.initiativeDie}[${game.i18n.localize('DCC.Weapon')}]`
    }

    logDispatch('rollInit', 'adapter', { die, dialog: true })

    const terms = [
      {
        type: 'Die',
        formula: die
      },
      {
        type: 'Modifier',
        label: game.i18n.localize('DCC.Initiative'),
        formula: init
      }
    ]

    const prompt = await promptRollModifierDialog(terms, {
      rollData: this.getRollData(),
      title: options.title,
      rollLabel: game.i18n.localize('DCC.RollModifierRoll')
    })
    if (prompt === null) return null

    return prompt.roll
  }

  /**
   * The additive tail of an initiative die formula — everything after the
   * leading die. e.g. '1d20+1d3' -> '+1d3', '1d20+1d7+7' -> '+1d7+7',
   * '1d20' -> ''. The lib models initiative as a single die + flat
   * modifiers, so an *additive* die (MCC's Mutant Horror folds one into
   * `init.die`; see mcc-core-book §9.2a) is a Foundry-side idiom the lib
   * can't represent — `_getInitiativeRollViaAdapter` re-appends it the same
   * way the weapon-die label is re-injected.
   * @param {string} formula
   * @returns {string}
   * @private
   */
  _initDieAdditiveTerms (formula) {
    const m = /^\s*\d*d\d+(.*)$/i.exec(String(formula ?? '').trim())
    return m ? m[1].trim() : ''
  }

  /**
   * Optionally show modifier dialog, then pass off to Foundry's actor rollInitiative
   * @param event
   * @param options
   * @param token
   * @returns {Promise<void>}
   */
  async rollInit (event, options, token) {
    if (token?.combatant?.initiative || this.inCombat) {
      ui.notifications.warn(game.i18n.localize('DCC.AlreadyHasInitiative'))
      return
    }

    let formula = null
    if (options?.showModifierDialog) {
      formula = await this.getInitiativeRoll(formula, { showModifierDialog: true })
    }

    const initOptions = {
      createCombatants: true,
      initiativeOptions: {
        formula
      }
    }

    if (token) {
      token.actor.rollInitiative(initOptions)
    } else {
      await this.rollInitiative(initOptions)
    }
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Roll Hit Dice
   * Used by the core Foundry methods
   */
  async rollHitDice (options = {}) {
    let die = this.system.attributes.hitDice.value || '1d4'
    options.title = game.i18n.localize('DCC.RollModifierHitDice')

    // Handle fractional HD
    let fraction = ''
    if (die.startsWith('1⁄2') || die.startsWith('½')) {
      die = die.replace('1/2', '1').replace('½', '1')
      fraction = `ceil(${die}/2)`
    }
    if (die.startsWith('1⁄4') || die.startsWith('¼')) {
      die = die.replace('1/4', '1').replace('¼', '1')
      fraction = `ceil(${die}/4)`
    }

    // Collate terms for the roll
    const terms = [
      {
        type: 'Compound',
        formula: fraction || die
      }
    ]

    // Players have a stamina modifier they can add
    if (this.type === 'Player') {
      const staminaMod = ensurePlus(this.system.abilities.sta.mod) || '+0'
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.AbilitySta'),
        formula: staminaMod
      })
    }

    const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)

    if (this.type !== 'Player') {
      await roll.evaluate()

      await this.update({
        'system.attributes.hp.max': Number(roll.total),
        'system.attributes.hp.value': Number(roll.total)
      })
    }

    // Convert the roll to a chat message
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize('DCC.HitDice'),
      flags: {
        'dcc.RollType': 'HitDice'
      }
    })
  }

  /**
   * Roll a Saving Throw.
   *
   * Single-path through the adapter (legacy fully decommissioned): both
   * the simple (no-dialog) path and the modifier-dialog path flow
   * through `_rollSavingThrowViaAdapter` via character-accessors →
   * two-pass formula/evaluate → chat-renderer. The former
   * `_rollSavingThrowLegacy` body was deleted at Phase 7 session 25.
   *
   * Signature and emitted chat-message flags are preserved — downstream
   * modules depend on the public shape of this method.
   *
   * @param {String} saveId       The save ID (e.g. "ref"/"frt"/"wil")
   * @param {Object} options      Roll options
   */
  async rollSavingThrow (saveId, options = {}) {
    return withRollErrorBoundary('rollSavingThrow', game.i18n.localize('DCC.Save'), () => {
      // Single-path through the adapter (legacy-decom step 2). The
      // modifier dialog is handled inside `_rollSavingThrowViaAdapter`;
      // DCC saves never use roll-under (only Luck *ability* checks do),
      // so there is no remaining option flag that needs the legacy body.
      return this._rollSavingThrowViaAdapter(saveId, options)
    })
  }

  /**
   * Adapter path for saving throws. Two-pass sync flow:
   * Pass 1 asks the lib for the formula, Foundry evaluates the full
   * formula so its Roll.total includes modifiers, Pass 2 classifies
   * against the same natural for crit/fumble/resources.
   * @private
   */
  async _rollSavingThrowViaAdapter (saveId, options) {
    logDispatch('rollSavingThrow', 'adapter', { saveId })
    const saveLabel = game.i18n.localize(CONFIG.DCC.saves[saveId])
    const character = actorToCharacter(this)

    // Roll-modifier dialog (legacy-decom step 2): mirror the ability /
    // skill adapter dialogs — build the legacy save term list, surface
    // the unified modifier dialog adapter-side, then route the user's
    // flattened die + total through the lib via `rollCheck`.
    if (options.showModifierDialog) {
      return this._rollSavingThrowWithDialog(saveId, options, saveLabel, character)
    }

    const libSaveId = foundrySaveIdToLib(saveId)

    // Pass 1: ask the lib for the formula (no evaluation).
    const plan = libRollSavingThrow(libSaveId, character, {
      mode: 'formula'
    })

    const foundryRoll = new Roll(plan.formula)
    await foundryRoll.evaluate()

    const primaryDie = foundryRoll.dice?.[0]
    const natural = primaryDie?.total ?? foundryRoll.total

    // Pass 2: lib classifies the rolled result.
    const result = libRollSavingThrow(libSaveId, character, {
      mode: 'evaluate',
      roller: () => natural
    })

    await renderSavingThrow({
      actor: this,
      saveId,
      saveLabel,
      result,
      foundryRoll,
      options
    })

    // Legacy rollSavingThrow returned the evaluated Roll; preserve
    // that contract for downstream macros / tests.
    return foundryRoll
  }

  /**
   * Roll-modifier-dialog branch of the saving-throw adapter path
   * (legacy-decom step 2). The dialog term list mirrors the former
   * legacy saving-throw builder (fixed 1d20 + save modifier). On
   * submit, the per-source modifier list collapses to a single flat
   * total (the dialog flattens attribution), so — like the ability /
   * skill dialogs — we route through `rollCheck` with a bare definition
   * + one `dialog-modifier` line rather than the `rollSavingThrow`
   * wrapper (which would auto-add the save value the dialog total
   * already includes). The DC success/failure suffix is preserved by
   * forwarding `options` to `renderSavingThrow`.
   * @private
   */
  async _rollSavingThrowWithDialog (saveId, options, saveLabel, character) {
    const save = this.system.saves[saveId]
    const flavor = `${saveLabel} ${game.i18n.localize('DCC.Save')}`

    const terms = [
      {
        type: 'Die',
        formula: '1d20'
      },
      {
        type: 'Modifier',
        label: saveLabel,
        formula: ensurePlus(save.value)
      }
    ]

    const prompt = await promptRollModifierDialog(terms, {
      rollData: this.getRollData(),
      title: options.title || flavor,
      rollLabel: game.i18n.localize('DCC.RollModifierRoll')
    })
    if (prompt === null) return

    const libDie = (prompt.actionDie && this._stripDieCount(prompt.actionDie)) || 'd20'

    const definition = {
      id: `save-${saveId}`,
      name: saveLabel,
      type: 'check',
      roll: { die: libDie }
    }

    const modifiers = []
    if (prompt.modifierTotal !== 0) {
      modifiers.push({
        kind: 'add',
        value: prompt.modifierTotal,
        origin: {
          category: 'other',
          id: 'dialog-modifier',
          label: options.title || flavor
        }
      })
    }

    logDispatch('rollSavingThrow', 'adapter', {
      saveId,
      dialog: true,
      actionDie: prompt.actionDie,
      modifierTotal: prompt.modifierTotal
    })

    // Pass 1: lib builds the formula (no evaluation).
    const plan = libRollCheck(definition, character, { mode: 'formula', modifiers })
    const foundryRoll = new Roll(plan.formula)
    await foundryRoll.evaluate()
    const natural = foundryRoll.dice?.[0]?.total ?? foundryRoll.total

    // Pass 2: lib classifies against the rolled natural.
    const result = libRollCheck(definition, character, {
      mode: 'evaluate',
      roller: () => natural,
      modifiers
    })

    await renderSavingThrow({
      actor: this,
      saveId,
      saveLabel,
      result,
      foundryRoll,
      options
    })

    return foundryRoll
  }

  /**
   * Roll a Skill Check.
   *
   * Single-path through the adapter (legacy fully decommissioned). The
   * dispatcher routes on the resolved skill: description-only items (no
   * die) emit a chat card via `_emitSkillDescriptionViaAdapter`;
   * skill-table / cleric-disapproval skills route through
   * `_skillTableViaAdapter`; everything else (including the modifier
   * dialog) flows through `_rollSkillCheckViaAdapter` via the two-pass
   * formula/evaluate pattern. The former `_rollSkillCheckLegacy` body
   * was deleted at Phase 7 session 25.
   *
   * Signature and emitted chat-message flags are preserved —
   * downstream modules depend on this public surface.
   *
   * @param {String} skillId  The skill ID (e.g. "sneakSilently")
   * @param {Object} options  Roll options
   */
  async rollSkillCheck (skillId, options = {}) {
    return withRollErrorBoundary('rollSkillCheck', game.i18n.localize('DCC.Skill'), () => {
      const resolved = this._resolveSkill(skillId)

      // Unknown skill — no built-in slot, no skill item with this name.
      // Without this guard the `!hasDie` description route would crash
      // on the missing `resolved.skill`. Mirror the `rollSpellCheck`
      // "no owned item" notification shape so the user sees a clear
      // warning rather than a console TypeError.
      if (!resolved.skill) {
        return ui.notifications.warn(
          game.i18n.format('DCC.SkillCheckUnknownSkillWarning', { skill: skillId })
        )
      }

      // Title for the roll modifier dialog — legacy mutates options,
      // keep the behavior so the dialog path still sees it.
      options.title = game.i18n.localize(resolved.skill.label) ||
        (game.i18n.localize('DCC.AbilityCheck') + resolved.abilityLabel)

      const hasSkillTable = !!CONFIG.DCC?.skillTables?.[skillId]
      const useDisapprovalRange = !!resolved.skill?.useDisapprovalRange

      // Description-only skill items (no die, no value, no roll) route
      // through the adapter's `_emitSkillDescriptionViaAdapter`, which
      // posts a description chat card rather than a roll (legacy-decom
      // step 4). Phase 3 session 26 (Q7) folded the previous
      // `!!options.showModifierDialog` clause into the adapter routes:
      // `_rollSkillCheckViaAdapter` calls `promptRollModifierDialog`
      // adapter-side, and `_skillTableViaAdapter` already threads
      // `options` through `DCCRoll.createRoll` which honours
      // `showModifierDialog` on its own.
      if (!resolved.hasDie) {
        return this._emitSkillDescriptionViaAdapter(skillId, resolved)
      }

      if (hasSkillTable || useDisapprovalRange) {
        return this._skillTableViaAdapter(skillId, options, resolved)
      }

      return this._rollSkillCheckViaAdapter(skillId, options, resolved)
    })
  }

  /**
   * Normalize a skill reference (built-in slot or skill item) to the
   * shared bundle both dispatch paths consume. Extracted from the
   * legacy dispatcher so the adapter can reuse the same resolution.
   * @private
   */
  _resolveSkill (skillId) {
    let skill = this.system.skills ? this.system.skills[skillId] : null
    let skillItem = null
    if (!skill) {
      skillItem = this.itemTypes.skill.find(i => i.name === skillId)
      if (skillItem) {
        skill = {
          label: skillItem.name
        }
        if (skillItem.system.config.useAbility) {
          skill.ability = skillItem.system.ability || null
        }
        if (skillItem.system.config.useDie) {
          skill.die = skillItem.system.die || null
        }
        if (skillItem.system.config.useValue) {
          skill.value = skillItem.system.value ?? undefined
        }
        if (skillItem.system.config.useLevel) {
          skill.level = `+${this.system.details.level.value ?? 0}`
        }
      }
    }

    if (skill?.config?.useLevel) {
      skill.level = `+${this.system.details.level.value ?? 0}`
    }

    let die = (skill?.die && skill.die.trim()) ? skill.die : null
    let hasDie = !!die

    if (skill?.useDisapprovalRange && this.system.class.spellCheckOverrideDie) {
      die = this.system.class.spellCheckOverrideDie
      hasDie = true
    }

    // Fall back to the actor's action die when no per-skill die is
    // configured. Built-in skill slots always inherit it. Skill items
    // inherit it too — but only when they actually roll something
    // (they contribute a value, ability, or level modifier). A pure
    // description-only skill item (useDie / useValue / useAbility /
    // useLevel all off) must stay on the description path and gets no
    // die. Fixes NPC skill items saved with `useDie: false` that carry
    // a flat `value` modifier (e.g. an imported NPC's "Divine Aid +4"):
    // before, the missing-die branch only matched built-in slots, so
    // those items rolled with no action die / dropped to description.
    const skillItemIsRollable = !!skillItem && (
      skill.value !== undefined ||
      !!(skill.ability && skill.ability.trim()) ||
      skill.level !== undefined
    )
    if (!hasDie && skill && (!skillItem || skillItemIsRollable)) {
      die = this.getActionDice()[0].formula || '1d20'
      hasDie = true
    }

    const abilityId = skill?.ability && skill.ability.trim() ? skill.ability : null
    const abilityLabel = abilityId
      ? ` (${game.i18n.localize(CONFIG.DCC.abilities[abilityId])})`
      : ''
    const abilityMod = abilityId
      ? parseInt(this.system.abilities[abilityId]?.mod || '0')
      : 0

    return {
      skill,
      skillItem,
      abilityId,
      abilityLabel,
      abilityMod,
      die,
      hasDie
    }
  }

  /**
   * Adapter path for skill checks. Two-pass sync flow mirroring
   * `_rollSavingThrowViaAdapter`: pass 1 asks the lib for the formula,
   * Foundry evaluates it (so Roll.total includes every modifier),
   * pass 2 classifies against the same natural for crit/fumble.
   *
   * Roll-modifier-dialog branch (Phase 3 session 26 / Q7): when the
   * caller passes `options.showModifierDialog`, the
   * `RollModifierDialog` is surfaced adapter-side via
   * `promptRollModifierDialog`. The dialog's term list comes from the
   * shared `_buildSkillCheckRollTerms` helper; on submit we override
   * `definition.roll.die` with the user-selected die and replace the
   * per-source modifier list with a single flat user total (the
   * dialog's term flattening already loses per-source attribution,
   * so the lib breakdown collapses to one `dialog-modifier` line).
   * @private
   */
  async _rollSkillCheckViaAdapter (skillId, options, resolved) {
    logDispatch('rollSkillCheck', 'adapter', { skillId })
    const { skill, skillItem, abilityId, abilityLabel } = resolved

    const character = actorToCharacter(this)
    const definition = this._buildSkillDefinition(skillId, resolved)
    let modifiers = this._buildSkillCheckModifiers(skillId, resolved)

    if (options.showModifierDialog) {
      const dialogTerms = this._buildSkillCheckRollTerms(skillId, resolved)
      const prompt = await promptRollModifierDialog(dialogTerms, {
        rollData: this.getRollData(),
        title: options.title,
        rollLabel: game.i18n.localize('DCC.RollModifierRoll')
      })
      if (prompt === null) return
      if (prompt.actionDie) {
        const libDie = this._stripDieCount(prompt.actionDie)
        if (libDie) definition.roll.die = libDie
      }
      // Replace per-source modifiers with a single flat total (the
      // dialog's submit step reduces every non-die term to a numeric
      // sum). Suppress the lib's auto-ability add since the dialog
      // total already includes ability mod (legacy compound term was
      // `skill.value + abilityMod`).
      if (definition.roll.ability) delete definition.roll.ability
      modifiers = []
      const flatTotal = prompt.modifierTotal
      if (flatTotal !== 0) {
        modifiers.push({
          kind: 'add',
          value: flatTotal,
          origin: {
            category: 'other',
            id: 'dialog-modifier',
            label: options.title || game.i18n.localize('DCC.RollModifierTitle')
          }
        })
      }
      // Capture the dialog choice in the dispatch log so the e2e
      // assertion can verify the prompt actually fired.
      logDispatch('rollSkillCheck', 'adapter', {
        skillId,
        dialog: true,
        actionDie: prompt.actionDie,
        modifierTotal: flatTotal
      })
    }

    // Pass 1: lib builds the formula (no evaluation).
    const plan = libRollCheck(definition, character, {
      mode: 'formula',
      modifiers
    })

    const foundryRoll = new Roll(plan.formula)
    await foundryRoll.evaluate()

    const natural = foundryRoll.dice?.[0]?.total ?? foundryRoll.total

    // Pass 2: lib classifies against the rolled natural.
    const result = libRollCheck(definition, character, {
      mode: 'evaluate',
      roller: () => natural,
      modifiers
    })

    const skillLabel = game.i18n.localize(skill.label)

    await renderSkillCheck({
      actor: this,
      skillId,
      skillLabel,
      abilityId,
      abilityLabel,
      skillItem,
      result,
      foundryRoll
    })

    if (skillItem && skillItem.system.config.showLastResult) {
      skillItem.update({ 'system.lastResult': foundryRoll.total })
    }

    return foundryRoll
  }

  /**
   * Skill-table + disapproval-range adapter branch
   * (Phase 3 session 25 / D4(skill-table)).
   *
   * Replaces the former legacy skill-check →
   * `processSpellCheck({rollTable: skillTable})` flow for skills that
   * carry a result table (Turn Unholy, divine aid) or a cleric
   * disapproval range. The roll itself still flows through
   * `DCCRoll.createRoll` so per-class skill terms (skill die, value,
   * level, deed roll, check penalty) render identically; the lookup +
   * chat emit + drainDisapproval mirror the `processSpellCheck`
   * cleric/skill-table branch (`module/dcc.js:665-693, 781-792`).
   *
   * Mechanics preserved from the former legacy path:
   *   - Term-builder (`_buildSkillCheckRollTerms`) covers die / value /
   *     level / useDeed / check penalty so a Turn Unholy roll
   *     displays the same modifier breakdown.
   *   - `useDisapprovalRange` annotates the die's `lowerThreshold` so
   *     the chat shows the cleric's disapproval band.
   *   - `forceCrit` (shift-click GM testing) is honored via the same
   *     Foundry-Roll mutation helper as the spell-check routes.
   *   - Natural 1 / Natural 20 detection drives the table lookup row:
   *     fumble → row 1; PC crit → roll.total + level (with the +level
   *     compound term appended to the roll for chat display).
   *   - Chat emit uses `SpellResult.addChatMessage` for the table path
   *     and the four `DCC.SpellCheck*NoTable` strings for the
   *     disapproval-range-only-no-table fallback (rare; mirror
   *     legacy).
   *   - `skill.drainDisapproval` increments the actor's disapproval
   *     range by N when `automateClericDisapproval` is on (Turn
   *     Unholy's documented cost).
   *   - `skillItem.system.config.showLastResult` updates `lastResult`
   *     on the skill item so the sheet displays the latest total.
   * @private
   */
  async _skillTableViaAdapter (skillId, options, resolved) {
    logDispatch('rollSkillCheck', 'adapter', { skillId, mode: 'skillTable' })
    const { skill, skillItem, abilityLabel } = resolved

    const terms = this._buildSkillCheckRollTerms(skillId, resolved)

    const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)

    if (skill.useDisapprovalRange && roll.dice.length > 0) {
      roll.dice[0].options.dcc = {
        lowerThreshold: this.system.class.disapproval
      }
    }

    if (!roll._evaluated) {
      await roll.evaluate()
    }

    const skillTable = await game.dcc.getSkillTable(skillId)

    // forceCrit (shift-click GM testing) — same Foundry-Roll mutation
    // helper as the spell-check adapter routes. Mirrors legacy
    // `processSpellCheck:605-611`.
    const naturalRoll = applyForceCritToFoundryRoll(
      roll,
      roll.dice[0]?.total ?? roll.total,
      options
    )

    const fumble = naturalRoll === 1
    const crit = naturalRoll === 20 && this.type === 'Player'
    const actorLevel = parseInt(this.system.details?.level?.value || 0, 10) || 0

    const flavor = `${game.i18n.localize(skill.label)}${abilityLabel}`

    if (skillTable) {
      let result
      if (fumble) {
        result = skillTable.getResultsForRoll(1)
      } else if (crit) {
        const critRoll = roll.total + actorLevel
        result = skillTable.getResultsForRoll(critRoll)
        roll.terms.push(new foundry.dice.terms.OperatorTerm({ operator: '+' }))
        roll.terms.push(new foundry.dice.terms.NumericTerm({ number: actorLevel }))
        roll._formula += ` + ${actorLevel}`
        roll._total += actorLevel
      } else {
        result = skillTable.getResultsForRoll(roll.total)
      }

      await game.dcc.SpellResult.addChatMessage(roll, skillTable, result, {
        crit, fumble, item: skillItem
      })
    } else {
      // `useDisapprovalRange` without a table: emit the same
      // pass/fail/crit/fumble HTML indicator as the legacy no-table
      // processSpellCheck branch. `level` for the threshold defaults
      // to 1 (skill items typically don't carry a spell level).
      const noTableLevel = skillItem?.system?.level || 1
      const noTableSuccess = roll.total >= 10 + noTableLevel * 2
      let spellResultHtml
      if (fumble) {
        spellResultHtml = `<p class="emote-alert fumble">${game.i18n.localize('DCC.SpellCheckFumbleNoTable')}</p>`
      } else if (crit) {
        spellResultHtml = `<p class="emote-alert critical">${game.i18n.localize('DCC.SpellCheckCritNoTable')}</p>`
      } else if (noTableSuccess) {
        spellResultHtml = `<p class="emote-alert critical">${game.i18n.localize('DCC.SpellCheckSuccessNoTable')}</p>`
      } else {
        spellResultHtml = `<p class="emote-alert fumble">${game.i18n.localize('DCC.SpellCheckFailureNoTable')}</p>`
      }

      const flags = {
        'dcc.RollType': 'SpellCheck',
        'dcc.isSpellCheck': true,
        'dcc.isSkillCheck': true,
        'dcc.ItemId': skillItem?.id,
        'dcc.SkillId': skillId,
        'dcc.spellResult': spellResultHtml
      }
      if (game.dcc?.FleetingLuck?.updateFlags) {
        game.dcc.FleetingLuck.updateFlags(flags, roll)
      }

      const rollHTML = await roll.render()
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor,
        flags,
        system: { spellId: skillItem?.id, skillId },
        content: `${rollHTML}${spellResultHtml}`
      })
    }

    // Skill-driven disapproval drain (Turn Unholy etc.) — preserves
    // the former legacy skill-check post-step.
    if (skill.drainDisapproval && game.settings.get('dcc', 'automateClericDisapproval')) {
      await this.applyDisapproval(skill.drainDisapproval)
    }

    if (skillItem && skillItem.system.config.showLastResult) {
      skillItem.update({ 'system.lastResult': roll.total })
    }

    return roll
  }

  /**
   * Build a lib `SkillDefinition` for a resolved skill. Ability
   * modifier and level are added by the lib from the character
   * (see `roll.ability` / `roll.levelModifier`). Other Foundry-side
   * modifiers (skill value, deed, check penalty) are emitted as
   * situational modifiers in `_buildSkillCheckModifiers`.
   * @private
   */
  _buildSkillDefinition (skillId, { skill, die, abilityId }) {
    // Foundry stores `1d14`; lib's DieType is just `d14`.
    const libDie = this._stripDieCount(die) || 'd20'

    const definition = {
      id: `skill:${skillId}`,
      name: game.i18n.localize(skill.label),
      type: 'check',
      roll: {
        die: libDie,
        levelModifier: 'none'
      }
    }

    if (abilityId) {
      definition.roll.ability = abilityId
    }

    return definition
  }

  /**
   * Emit the situational modifiers the lib needs to produce the same
   * total the legacy term list would have: skill value, level (when
   * useLevel is true), Mighty Deed's last attack bonus, and the
   * armor check penalty for skills that honor it.
   * @private
   */
  _buildSkillCheckModifiers (skillId, { skill, abilityMod }) {
    const modifiers = []
    const skillLabel = game.i18n.localize(skill.label)

    if (skill.value !== undefined) {
      const valueNum = parseInt(String(skill.value), 10) || 0
      // Legacy folded ability mod into the same Compound term as skill
      // value. The lib adds ability mod on its own from roll.ability,
      // so we emit just skill.value here — total arithmetic matches.
      if (valueNum !== 0 || abilityMod === 0) {
        modifiers.push({
          kind: 'add',
          value: valueNum,
          origin: {
            category: 'other',
            id: 'skill-value',
            label: skillLabel
          }
        })
      }
    }

    if (skill.level !== undefined && skill.level !== 0) {
      const levelNum = parseInt(String(skill.level), 10) || 0
      if (levelNum !== 0) {
        modifiers.push({
          kind: 'add',
          value: levelNum,
          origin: {
            category: 'level',
            id: 'level',
            label: game.i18n.localize('DCC.Level')
          }
        })
      }
    }

    if (skill.useDeed && this.system.details.lastRolledAttackBonus) {
      const deedNum = parseInt(String(this.system.details.lastRolledAttackBonus), 10)
      if (Number.isFinite(deedNum) && deedNum !== 0) {
        modifiers.push({
          kind: 'add',
          value: deedNum,
          origin: {
            category: 'class-feature',
            id: 'mighty-deed',
            label: game.i18n.localize('DCC.DeedRoll')
          }
        })
      }
    }

    const checkPenaltyCouldApply =
      ['sneakSilently', 'climbSheerSurfaces'].includes(skillId) ||
      !!skill.config?.applyCheckPenalty
    if (checkPenaltyCouldApply) {
      const penaltyNum = parseInt(String(this.system.attributes.ac.checkPenalty || '0'), 10)
      if (Number.isFinite(penaltyNum) && penaltyNum !== 0) {
        modifiers.push({
          kind: 'add',
          value: penaltyNum,
          origin: {
            category: 'penalty',
            id: 'armor-check-penalty',
            label: game.i18n.localize('DCC.CheckPenalty')
          }
        })
      }
    }

    return modifiers
  }

  /**
   * Turn a Foundry die formula like `'1d14'` into the bare die type
   * `'d14'` the lib's SkillDefinition wants. Returns null when the
   * input can't be parsed (callers either `|| 'd20'` it or use the
   * null to leave the existing die untouched).
   *
   * Delegates to the canonical adapter `normalizeLibDie` (Phase 7
   * session 12 consolidation) with `fallback: null` — every call site
   * passes a single die string, so the unanchored matcher behaves
   * identically to the former anchored regex here.
   * @private
   */
  _stripDieCount (formula) {
    return normalizeLibDie(formula, null)
  }

  /**
   * Adapter path for description-only skill items — a skill item with
   * `useDie` / `useValue` / `useAbility` / `useLevel` all off (the
   * `!resolved.hasDie` gate; built-in slots and rollable items always
   * inherit the action die, so this is reached only for skill items
   * with nothing to roll). These emit a description chat card, not a
   * roll: there is no formula to hand the lib, so this is a pure
   * Foundry-side chat emit rather than a lib round-trip.
   *
   * Reproduces the former legacy early-return chat contract exactly —
   * same content (`.skill-description` div), flavor (`<label><ability>`),
   * flags (`SkillCheck` / `ItemId` / `SkillId` / `isSkillCheck`), and
   * `system` payload. Emits nothing when the item carries no
   * description. The `mode: 'description'` dispatch field distinguishes
   * it from the rolling adapter routes.
   *
   * Landed at Phase 7 session 24 (legacy-decom step 4) as the route that
   * retired the last reachable gate on the old `_rollSkillCheckLegacy`
   * body (since deleted at session 25).
   * @private
   */
  _emitSkillDescriptionViaAdapter (skillId, resolved) {
    logDispatch('rollSkillCheck', 'adapter', { skillId, mode: 'description' })
    const { skill, skillItem, abilityLabel } = resolved

    if (skillItem && skillItem.system.description.value) {
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="skill-description">${skillItem.system.description.value}</div>`,
        flavor: `${game.i18n.localize(skill.label)}${abilityLabel}`,
        flags: {
          'dcc.RollType': 'SkillCheck',
          'dcc.ItemId': skillId,
          'dcc.SkillId': skillId,
          'dcc.isSkillCheck': true
        },
        system: { skillId, skillDescription: skillItem.system.description.value }
      })
    }
  }

  /**
   * Build the `DCCRoll.createRoll` term-descriptor array for a resolved
   * skill (the "legacy" term-descriptor *format* the Foundry roll dialog
   * + `DCCRoll.createRoll` consume — not a legacy code path). Shared by
   * `_skillTableViaAdapter` (table + disapproval-range lookups) and
   * `_rollSkillCheckViaAdapter`'s `showModifierDialog` branch (open
   * question #7), both of which still drive Foundry's
   * `RollModifierDialog` / `DCCRoll.createRoll` and so need the
   * descriptor shape. Renamed from `_buildSkillCheckLegacyTerms` at
   * Phase 7 session 25 when the last legacy caller
   * (`_rollSkillCheckLegacy`) was deleted.
   * @private
   */
  _buildSkillCheckRollTerms (skillId, resolved) {
    const { skill, abilityLabel, abilityMod, die, hasDie } = resolved
    const terms = []

    if (hasDie) {
      terms.push({
        type: 'Die',
        label: skill.die ? null : game.i18n.localize('DCC.ActionDie'),
        formula: die,
        presets: this.getActionDice({ includeUntrained: true })
      })
    }

    if (skill.value !== undefined) {
      let formula = skill.value.toString()
      if (abilityMod !== 0) {
        formula = `${skill.value} + ${abilityMod}`
      }
      terms.push({
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.RollModifierDieTerm'),
        modifierLabel: game.i18n.localize(skill.label) + abilityLabel,
        formula
      })
    }

    if (skill.level && skill.level !== 0) {
      terms.push({
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.RollModifierDieTerm'),
        modifierLabel: game.i18n.localize('DCC.Level'),
        formula: `${skill.level}`
      })
    }

    if (skill.useDeed && this.system.details.lastRolledAttackBonus) {
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.DeedRoll'),
        formula: parseInt(this.system.details.lastRolledAttackBonus)
      })
    }

    const checkPenaltyCouldApply =
      ['sneakSilently', 'climbSheerSurfaces'].includes(skillId) ||
      !!skill.config?.applyCheckPenalty
    const checkPenalty = ensurePlus(this.system.attributes.ac.checkPenalty || '0')
    if (checkPenaltyCouldApply && checkPenalty !== '+0') {
      terms.push({
        type: 'CheckPenalty',
        formula: checkPenalty,
        apply: checkPenaltyCouldApply
      })
    }

    return terms
  }

  /**
   * Roll the Luck Die
   */
  async rollLuckDie (options = {}) {
    const die = this.system.class.luckDie
    options.title = game.i18n.localize('DCC.LuckDie')
    let luckSpend = 1

    // Collate terms for the roll
    const terms = [
      {
        type: 'LuckDie',
        formula: die,
        lck: this.system.abilities.lck.value,
        callback: (formula) => {
          // Record the amount of luck spent when the term is resolved
          luckSpend = game.dcc.DiceChain.countDice(formula)
        }
      }
    ]

    const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)
    const flavor = game.i18n.format('DCC.LuckSpend', { luckSpend })

    // Spend the luck
    await this.update({
      'system.abilities.lck.value': (parseInt(this.system.abilities.lck.value) - luckSpend)
    })

    // Convert the roll to a chat message
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      flags: {
        'dcc.RollType': 'LuckDie'
      }
    })
  }

  /**
   * Apply damage to this actor
   * @param {Number} damageAmount   Damage amount to apply
   * @param {Number} multiplier     Damage multiplier
   */
  async applyDamage (damageAmount, multiplier) {
    const speaker = ChatMessage.getSpeaker({ actor: this })

    // Calculate damage amount and current hit points
    const amount = damageAmount * multiplier
    const hp = this.system.attributes.hp.value

    let newHp = hp
    if (amount > 0) {
      // Taking damage - just subtract and allow damage to go below zero
      newHp = newHp - amount
    } else {
      // Healing - don't allow HP to be brought above MaxHP, but if it's already there assume it's intentional
      const maxHp = this.system.attributes.hp.max
      if (hp >= maxHp) {
        newHp = hp
      } else {
        newHp = Math.min(newHp - amount, maxHp)
      }
    }

    const deltaHp = newHp - hp

    // Announce damage or healing results
    if (Math.abs(deltaHp) > 0) {
      const locString = (deltaHp > 0) ? 'DCC.HealDamage' : 'DCC.TakeDamage'
      const messageData = {
        user: game.user.id,
        speaker,
        flags: {
          'dcc.isApplyDamage': true
        },
        content: game.i18n.format(locString, { damage: Math.abs(deltaHp) }),
        style: CONST.CHAT_MESSAGE_STYLES.EMOTE,
        sound: CONFIG.sounds.notification
      }
      ChatMessage.applyMode(messageData, game.settings.get('core', 'messageMode'))
      await CONFIG.ChatMessage.documentClass.create(messageData)
    }

    // Apply new HP
    return this.update({
      'system.attributes.hp.value': newHp
    })
  }

  /**
   * Lose a wizard spell through a casting failure
   */
  async loseSpell (item) {
    const speaker = ChatMessage.getSpeaker({ actor: this })

    // Mark the spell as lost - if the item is known
    if (item) {
      item.update({
        'system.lost': true
      })
    }

    // Announce that the spell (or a spell) was lost
    const locString = item ? game.i18n.format('DCC.SpellLostMessageFormat', { spell: item.name }) : game.i18n.localize('DCC.SpellLostMessage')
    const messageData = {
      user: game.user.id,
      speaker,
      style: CONST.CHAT_MESSAGE_STYLES.EMOTE,
      content: locString,
      sound: CONFIG.sounds.notification
    }
    ChatMessage.applyMode(messageData, game.settings.get('core', 'messageMode'))
    await CONFIG.ChatMessage.documentClass.create(messageData)
  }

  /**
   * Apply a point of disapproval
   */
  async applyDisapproval (amount = 1) {
    if (this.isNPC) {
      return
    }

    const speaker = ChatMessage.getSpeaker({ actor: this })
    // Calculate new disapproval
    const newRange = Math.min(this.system.class.disapproval + amount, 20)

    // Apply the new disapproval range
    this.update({
      'system.class.disapproval': newRange
    })

    // Announce that disapproval was increased
    const messageData = {
      user: game.user.id,
      speaker,
      flags: {
        'dcc.isDisapproval': true
      },
      style: CONST.CHAT_MESSAGE_STYLES.EMOTE,
      content: game.i18n.format('DCC.DisapprovalGained', { range: newRange }),
      sound: CONFIG.sounds.notification
    }
    ChatMessage.applyMode(messageData, game.settings.get('core', 'messageMode'))
    await CONFIG.ChatMessage.documentClass.create(messageData)
  }

  /**
   * Prompt and roll for disapproval
   * @param {Number} naturalRoll   Optional - the natural roll for the last spell check
   */
  async rollDisapproval (naturalRoll) {
    // Generate a formula, placeholder if the natural roll is not known
    const terms = [
      {
        type: 'DisapprovalDie',
        formula: `${naturalRoll || 1}d4`
      },
      {
        type: 'Modifier',
        label: 'Luck Modifier',
        formula: -this.system.abilities.lck.mod
      }
    ]
    const options = {}

    // Force the Roll Modifier dialog on if we don't know the formula
    if (naturalRoll === undefined) {
      options.showModifierDialog = true
    }

    // If we know the formula just roll it
    await this._onRollDisapproval(terms, options)
  }

  /**
   * Roll disapproval
   * @private
   * @param terms
   * @param options
   */
  async _onRollDisapproval (terms, options = {}) {
    try {
      const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)

      if (!roll) { return }

      // Lookup the disapproval table if available
      let disapprovalTable = null
      for (const disapprovalPackName of CONFIG.DCC.disapprovalPacks.packs) {
        const disapprovalTableName = this.system.class.disapprovalTable
        if (disapprovalPackName && disapprovalTableName) {
          const pack = game.packs.get(disapprovalPackName)
          if (pack) {
            const entry = pack.index.find((entity) => `${disapprovalPackName}.${entity.name}` === disapprovalTableName)
            if (entry) {
              disapprovalTable = await pack.getDocument(entry._id)
            }
          }
        }
      }

      // If not found in compendium packs, try the local world tables
      if (!disapprovalTable) {
        const disapprovalTableName = this.system.class.disapprovalTable
        if (disapprovalTableName) {
          // Extract just the table name from the full path if needed
          // e.g., "dcc-core-book.dcc-core-disapproval.Disapproval" -> "Disapproval"
          const tableName = disapprovalTableName.includes('.')
            ? disapprovalTableName.split('.').pop()
            : disapprovalTableName

          // Search for a table in the world with a matching name
          disapprovalTable = game.tables.find((entity) => entity.name === tableName)
        }
      }

      // Draw from the table if found, otherwise display the roll
      if (disapprovalTable) {
        disapprovalTable.draw({ roll, displayChat: true })
      } else {
        // Fall back to displaying just the roll
        roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: this }),
          flavor: game.i18n.localize('DCC.DisapprovalRoll'),
          flags: {
            'dcc.RollType': 'Disapproval'
          }
        })
      }
    } catch (err) {
      if (err) {
        ui.notifications.warn(game.i18n.format('DCC.DisapprovalFormulaWarning'))
      }
    }
  }

  /**
   * Override fromImport to fix legacy item IDs that are not 16 characters
   * Foundry v13 requires exactly 16-character alphanumeric IDs
   * @param {object} json - The JSON data to import
   * @returns {Promise<Document>} The created document
   */
  static async fromImport (json) {
    // Fix any item IDs that are not exactly 16 characters
    if (json.items && Array.isArray(json.items)) {
      for (const item of json.items) {
        if (item._id && (item._id.length !== 16 || !/^[a-zA-Z0-9]+$/.test(item._id))) {
          // Truncate or pad the ID to 16 characters while keeping it alphanumeric
          if (item._id.length > 16) {
            item._id = item._id.substring(0, 16)
          } else {
            // Pad with random alphanumeric characters
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
            while (item._id.length < 16) {
              item._id += chars.charAt(Math.floor(Math.random() * chars.length))
            }
          }
        }
      }
    }
    return super.fromImport(json)
  }
}

export default DCCActor

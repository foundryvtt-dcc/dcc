/* global game, CONFIG, Roll, ChatMessage, ui */

import { ensurePlus } from '../utilities.js'
import {
  rollAbilityCheck as libRollAbilityCheck,
  rollCheck as libRollCheck,
  rollLuckCheck as libRollLuckCheck,
  rollSavingThrow as libRollSavingThrow
} from '../vendor/dcc-core-lib/index.js'
import { actorToCharacter, foundrySaveIdToLib } from '../adapter/character-accessors.mjs'
import { renderAbilityCheck, renderAbilityCheckRollUnder, renderSavingThrow } from '../adapter/chat-renderer.mjs'
import { promptRollModifierDialog } from '../adapter/roll-dialog.mjs'
import { logDispatch, withRollErrorBoundary, withRollErrorBoundarySync } from '../adapter/debug.mjs'

/**
 * Ability/luck/initiative/hit-dice/saving-throw dispatch mixin for
 * {@link DCCActor}.
 *
 * Phase 7 actor.js shrinkage (continued): the non-spell, non-weapon,
 * non-skill roll dispatchers — the public `rollAbilityCheck`,
 * `getInitiativeRoll`, `rollInit`, `rollHitDice`, `rollSavingThrow`
 * wrappers plus their private adapters/dialog helpers — were lifted out
 * of `module/actor.js` into this mixin. `DCCActor` composes it into its
 * `extends` chain so every method stays an instance method with
 * byte-identical behavior and `this` semantics. `this._stripDieCount`
 * (skill mixin) and `this.getActionDice` / `this.getRollData`
 * (roll-data mixin) resolve up the prototype chain — every roll mixin is
 * always co-composed on DCCActor.
 *
 * Public surface unchanged: dcc-qol / token-action-hud-dcc depend on the
 * public shapes of `rollAbilityCheck` / `getInitiativeRoll` /
 * `rollSavingThrow`. Self-contained: depends only on the check adapter/
 * lib imports above and the Foundry globals.
 *
 * @param {typeof import('foundry').Actor} Base - the class to extend.
 * @returns {typeof Base} a subclass carrying the check/init/save dispatchers.
 */
export const RollsCheckMixin = (Base) => class extends Base {
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
}

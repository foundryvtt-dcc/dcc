/* global game, CONFIG, Roll, ui */

import {
  castSpell as libCastSpell,
  calculateSpellCheck as libCalculateSpellCheck,
  getCasterProfile as libGetCasterProfile,
  getAbilityModifier as libGetAbilityModifier,
  rollMercurialMagic as libRollMercurialMagic
} from '../vendor/dcc-core-lib/index.js'
import { renderSpellCheck, renderDisapprovalRoll, renderMercurialEffect } from '../adapter/chat-renderer.mjs'
import { buildSpellCastInput, buildSpellCheckArgs, loadDisapprovalTable, loadMercurialMagicTable, loadPatronTaintTable } from '../adapter/spell-input.mjs'
import { createSpellEvents } from '../adapter/spell-events.mjs'
import { promptRollModifierDialog } from '../adapter/roll-dialog.mjs'
import { normalizeLibDie } from '../adapter/attack-input.mjs'
import { logDispatch, warnIfDivergent, withRollErrorBoundary } from '../adapter/debug.mjs'
import { applyForceCritToFoundryRoll } from './force-crit.mjs'
import { emitAfterSpellCheckResult, sumSpellburn } from './spell-result-hook.mjs'

/**
 * Spell-check dispatch mixin for {@link DCCActor}.
 *
 * Phase 7 actor.js shrinkage (continued): the spell-check dispatch layer
 * — the public `rollSpellCheck` wrapper plus its private dispatchers
 * (`_rollSpellCheckDispatch`, `_promptSpellCheckDialog`,
 * `_applySpellCheckDialogToOptions`, `_rollSpellCheckViaAdapter`,
 * `_castNakedViaAdapter`, `_castViaCastSpell`,
 * `_castViaCalculateSpellCheck`, `_rollMercurialIfNeeded`,
 * `_buildSpellCheckFlavor`) — was lifted out of `module/actor.js` into
 * this mixin. `DCCActor` composes it into its `extends` chain so every
 * method remains an instance method with byte-identical behavior and
 * `this` semantics; `this.rollDisapproval` / `this.applyDisapproval` /
 * `this.getRollData` / `this.classId` still resolve up the prototype
 * chain to whichever class (actor.js or another mixin) defines them.
 *
 * Public surface unchanged: `actor.rollSpellCheck()` is the documented
 * entry point; the `_*` helpers are internal. Self-contained: depends
 * only on the spell adapter/lib imports above, the shared
 * `applyForceCritToFoundryRoll` helper, and the Foundry globals.
 *
 * @param {typeof import('foundry').Actor} Base - the class to extend.
 * @returns {typeof Base} a subclass carrying the spell-check dispatchers.
 */
export const RollsSpellMixin = (Base) => class extends Base {
  /**
   * Roll a Spell Check.
   *
   * Dispatcher. Phase 2 scope — as sessions land, more casting modes
   * peel off onto the adapter:
   *   - Session 1: generic-castingMode items on non-cleric, non-patron-bound
   *     actors (no side effects).
   *   - Session 2: wizard-castingMode items on non-cleric, non-patron-bound
   *     actors; wizard spell loss via the lib's `onSpellLost` event.
   *     Pre-check for already-lost spells (mirrors
   *     `DCCItem.rollSpellCheck:260`) fires adapter-side.
   *   - Session 3: cleric-castingMode items on cleric actors without
   *     patrons; cleric disapproval via the lib's
   *     `onDisapprovalIncreased` event (replaces
   *     `actor.applyDisapproval()` + `actor.rollDisapproval()`).
   *   - Session 4: wizard-castingMode items on patron-bound wizard /
   *     elf actors flow through the adapter. The patron field populates
   *     `character.state.classState.<type>.patron` so the lib records
   *     `castInput.patron`. D3a (2026-04-24) extended this to feed the
   *     RAW patron-taint pipeline: `patronTaintChance` + `isPatronSpell`
   *     on `castInput`; the lib runs creeping-chance + result-table
   *     triggers; this method persists `result.newPatronTaintChance`
   *     back to `system.class.patronTaintChance` each cast (see below).
   *     The `onPatronTaint` event (spell-events.mjs) posts a chat
   *     EMOTE on acquisition.
   *   - Session 5: spellburn + mercurial magic on wizard / elf
   *     casts. `input.spellburn` is forwarded from `options.spellburn`
   *     when the caller provides a `SpellburnCommitment`; the
   *     `onSpellburnApplied` bridge subtracts the burn from
   *     `system.abilities.<str|agl|sta>.value`. Mercurial magic
   *     pre-rolls via `_rollMercurialIfNeeded` when the spell item
   *     has no stored effect — updates the item and attaches the
   *     effect to the in-flight spellbook entry so the lib's
   *     `onMercurialEffect` fires with the fresh result.
   *
   * Everything else (wizard on cleric, cleric on non-cleric,
   * patron-bound clerics, naked spell checks, unknown casting modes)
   * stays on the legacy path. The item lookup is hoisted here so the
   * existing actor.test.js `collectionFindMock` call-count assertions
   * still match.
   *
   * @param options
   */
  async rollSpellCheck (options = {}) {
    return withRollErrorBoundary('rollSpellCheck', game.i18n.localize('DCC.SpellCheck'), () => {
      return this._rollSpellCheckDispatch(options)
    })
  }

  /**
   * Internal spell-check dispatch body. Extracted from `rollSpellCheck`
   * so the public method is a thin `withRollErrorBoundary` wrapper while
   * the routing logic (no-item naked cast, wizard / cleric castingMode
   * overrides, generic fall-through) stays readable at one indent level.
   * @private
   */
  async _rollSpellCheckDispatch (options = {}) {
    if (!options.abilityId) {
      options.abilityId = this.system.class.spellCheckAbility || ''
    }

    let spellItem = null
    if (options.spell) {
      const item = this.items.find(i => i.name === options.spell)
      if (item) {
        if (item.type === 'spell') {
          spellItem = item
        } else {
          return ui.notifications.warn(game.i18n.localize('DCC.SpellCheckNonSpellWarning'))
        }
      } else {
        return ui.notifications.warn(game.i18n.localize('DCC.SpellCheckNoOwnedItemWarning'))
      }
    }

    const castingMode = spellItem?.system?.config?.castingMode
    const hasPatron = !!this.system.class?.patron
    // Widened 2026-04-23: accept `class.className === 'Cleric'` as the
    // cleric signal, not just `details.sheetClass`. Programmatic PCs
    // (anything not routed through the level-change dialog) can have
    // `className: 'Cleric'` without `sheetClass` populated; pre-fix the
    // cleric-castingMode branch took the no-override adapter route, which
    // (before the castingMode-derived profile fallback) couldn't resolve a
    // profile for a cleric-by-className-only actor. `resolveCasterProfile`
    // in `spell-input.mjs` already keys on `className`, so widening here
    // routes the symmetric "Wizard spell on cleric-by-className-only actor"
    // case through the adapter with the right `castingModeOverride`.
    const isCleric =
      this.classId === 'cleric' ||
      this.system.class?.className === 'Cleric'

    if (!spellItem) {
      // Phase 3 session 25 / D4(naked) — no spell item supplied (no
      // `options.spell` or the actor doesn't own the named item).
      // Routes through the adapter via `castSpell` with an optional
      // spellbookEntry (lib 0.10.0); replaces the inline term-builder
      // + `processSpellCheck({rollTable: null})` legacy path.
      return this._castNakedViaAdapter(options)
    }

    if (castingMode === 'wizard') {
      // Adapter-side spell-loss pre-check — mirrors the legacy
      // `DCCItem.rollSpellCheck:260` gate that would otherwise warn
      // and abort. Once the cast reaches the adapter the item has
      // already been looked up, so this is the natural place.
      if (spellItem.system.lost && game.settings.get('dcc', 'automateWizardSpellLoss')) {
        return ui.notifications.warn(game.i18n.format('DCC.SpellLostWarning', {
          actor: this.name,
          spell: spellItem.name
        }))
      }
      // Phase 3 session 24 / D4 — wizard-castingMode item on a
      // cleric actor routes through the adapter with an explicit
      // wizard `profileOverride` so the lib applies wizard
      // mechanics (spellburn, spell-loss, patron-taint) even though
      // the actor's class is cleric. Pre-D4 this fell to legacy via
      // `DCCItem.rollSpellCheck` → `processSpellCheck`.
      if (isCleric) {
        return this._rollSpellCheckViaAdapter(spellItem, options, { castingModeOverride: 'wizard' })
      }
      return this._rollSpellCheckViaAdapter(spellItem, options)
    }
    if (castingMode === 'cleric') {
      // Phase 3 session 24 / D4 — cleric-castingMode item on a
      // non-cleric or patron-bound actor routes through the adapter
      // with an explicit cleric `profileOverride` so cleric
      // mechanics (disapproval, no spellburn) drive the cast. The
      // override is harmless for the canonical "cleric actor, no
      // patron" case (it matches the derived profile) so the
      // dispatcher passes it uniformly.
      if (!isCleric || hasPatron) {
        return this._rollSpellCheckViaAdapter(spellItem, options, { castingModeOverride: 'cleric' })
      }
      return this._rollSpellCheckViaAdapter(spellItem, options)
    }

    // generic castingMode — and any mode the system doesn't define, plus
    // generic-mode spells cast by cleric/patron actors — route through the
    // adapter's synthetic-generic path (`_castViaCastSpell`): side-effect-free
    // per DCC's generic / idol-magic semantics. This is the former
    // `_rollSpellCheckLegacy` fall-through, now fully adapter-owned (Phase 7
    // session 16). Generic spells carry no disapproval / patron taint, so the
    // earlier `!isCleric && !hasPatron` guard on the generic branch is gone.
    return this._rollSpellCheckViaAdapter(spellItem, options)
  }

  /**
   * Q7-phase2 (session 27) — surface the unified roll-modifier dialog
   * for an adapter-routed spell check. Builds the same term list
   * `DCCItem.rollSpellCheck` constructs for the legacy
   * `DCCRoll.createRoll` path: Die / Compound (spell-check bonus) /
   * CheckPenalty (when applicable) / Other Bonus (when set) /
   * Spellburn (when eligible).
   *
   * Returns the parsed dialog result `{actionDie, modifierTotal,
   * spellburn}` or `null` on user-cancel. Callers feed the result back
   * into `options` via `_applySpellCheckDialogToOptions`, then route
   * through the same `_rollSpellCheckViaAdapter` / `_castNakedViaAdapter`
   * path the no-dialog case takes.
   *
   * `ctx.castingMode` (one of `'wizard'` / `'cleric'` / `'naked'`)
   * drives the CheckPenalty `apply` flag — `castingMode === 'wizard'`
   * applies it by default (matches legacy DCCItem.rollSpellCheck:307).
   * `ctx.isIdolMagic` skips the CheckPenalty term entirely (idol-magic
   * clerics don't pay check penalty in any form). `ctx.spellburnEligible`
   * adds the Spellburn descriptor so the user can allocate burn in the
   * same dialog (clerics / NPCs are ineligible).
   * @private
   */
  async _promptSpellCheckDialog (spellItem, ctx = {}) {
    const { castingMode = 'wizard', isIdolMagic = false, spellburnEligible = false } = ctx

    const die =
      spellItem?.system?.spellCheck?.die ||
      this.system.class?.spellCheckOverrideDie ||
      this.system.attributes?.actionDice?.value ||
      '1d20'

    let bonus
    if (spellItem) {
      bonus = (spellItem.system?.spellCheck?.value ?? '+0').toString()
      // Mirror DCCItem.rollSpellCheck:276 — consolidate `@`-substituted
      // bonuses so the modifier dialog doesn't show an unevaluated
      // formula. Falls back to the raw string if `Roll.safeEval` rejects.
      if (bonus.includes('@')) {
        try {
          bonus = Roll.safeEval(bonus)
        } catch {
          // Leave the raw `@`-formula; the lib's `Roll` parser will
          // substitute when it evaluates.
        }
      }
    } else {
      bonus = this.system.class?.spellCheck ?? '+0'
    }

    const terms = [
      {
        type: 'Die',
        label: game.i18n.localize('DCC.ActionDie'),
        formula: die
      },
      {
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.RollModifierDieTerm'),
        modifierLabel: game.i18n.localize('DCC.SpellCheck'),
        formula: bonus
      }
    ]

    if (!isIdolMagic) {
      const checkPenalty = spellItem?.system?.config?.inheritCheckPenalty
        ? parseInt(this.system.attributes?.ac?.checkPenalty || '0')
        : parseInt(spellItem?.system?.spellCheck?.penalty || '0')
      terms.push({
        type: 'CheckPenalty',
        formula: checkPenalty,
        apply: castingMode === 'wizard' || castingMode === 'generic'
      })
    }

    const otherBonus = spellItem?.system?.spellCheck?.otherBonus
    if (otherBonus) {
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.SpellOtherBonus'),
        formula: otherBonus
      })
    }

    const promptOptions = {
      rollData: this.getRollData(),
      title: spellItem
        ? game.i18n.format('DCC.RollModifierTitleCasting', { spell: spellItem.name })
        : game.i18n.localize('DCC.SpellCheck'),
      rollLabel: game.i18n.localize('DCC.RollModifierRoll')
    }

    if (spellburnEligible) {
      promptOptions.spellburn = {
        str: parseInt(this.system.abilities?.str?.value) || 0,
        agl: parseInt(this.system.abilities?.agl?.value) || 0,
        sta: parseInt(this.system.abilities?.sta?.value) || 0
      }
    }

    return promptRollModifierDialog(terms, promptOptions)
  }

  /**
   * Q7-phase2 (session 27) — fold a `_promptSpellCheckDialog` result
   * back into the `options` bag the adapter routes consume:
   *   - `spellburn` (when the dialog included the descriptor) becomes
   *     `options.spellburn`; the lib's `castSpell` adds it as a
   *     modifier and the `onSpellburnApplied` bridge deducts ability
   *     points (see `spell-events.mjs`).
   *   - `actionDie` becomes `options.actionDieOverride`; the adapter
   *     swaps it into `input.actionDie` so the lib's formula honors
   *     the user's dice-chain bump.
   *   - `modifierTotal` becomes `options.dialogModifierTotal`; the
   *     adapter subtracts the lib's auto-computed `casterLevel +
   *     abilityModifier` and feeds the net as a single
   *     `dialog-modifier` situational so the rolled total matches the
   *     legacy "trust the user's total" contract without double-
   *     counting the level + ability the lib re-adds from `character`.
   * @private
   */
  _applySpellCheckDialogToOptions (prompt, options) {
    if (prompt.spellburn) options.spellburn = prompt.spellburn
    if (prompt.actionDie) options.actionDieOverride = prompt.actionDie
    options.dialogModifierTotal = prompt.modifierTotal
  }

  /**
   * Adapter path for spell checks. Dispatches to the lib entry point
   * appropriate for the item's casting mode:
   *   - Generic: `castSpell` with a synthetic side-effect-free profile.
   *     No spellbook lookup, no events wired.
   *   - Wizard: `calculateSpellCheck` with the real wizard caster
   *     profile + a single-entry spellbook built from the item's
   *     `system.lost` / `system.timesPreparedOrCast`. `onSpellLost`
   *     fires when the lib marks the spell lost; the event bridge in
   *     `spell-events.mjs` mirrors that to the Foundry item via
   *     `item.update({ 'system.lost': true })`, replacing the
   *     `actor.loseSpell(item)` side effect `processSpellCheck`
   *     performs on the legacy path.
   *
   * Two-pass formula/evaluate pattern established by the Phase 1
   * adapter methods: pass 1 yields a formula, Foundry rolls it, pass
   * 2 classifies against the pre-rolled natural.
   * @private
   */
  async _rollSpellCheckViaAdapter (spellItem, options, dispatch = {}) {
    const castingMode = spellItem?.system?.config?.castingMode || 'generic'
    const logDetails = {
      spell: spellItem?.name ?? '',
      mode: castingMode
    }
    if (dispatch.castingModeOverride) {
      logDetails.profileOverride = dispatch.castingModeOverride
    }
    logDispatch('rollSpellCheck', 'adapter', logDetails)

    // Q7-phase2 (session 27) — surface the unified roll-modifier
    // dialog adapter-side. Replaces the bespoke spellburn pop-up from
    // session 1 / open question #6: wizard / cleric branches now show
    // Die / Compound / CheckPenalty / Spellburn / Other Bonus in one
    // dialog (same shape `DCCItem.rollSpellCheck` builds for the
    // legacy path). NPCs and pre-committed burns skip the dialog
    // (legacy parity). Wizard-castingMode spells route Spellburn
    // through `input.spellburn`; cleric-castingMode (idol magic) drops
    // both Spellburn and CheckPenalty per RAW. The dispatch log
    // already fired above so a cancel still leaves a traceable adapter
    // path in the log.
    if ((castingMode === 'wizard' || castingMode === 'cleric') &&
        options.showModifierDialog && !options.spellburn && !this.isNPC) {
      const isCleric = castingMode === 'cleric' || dispatch.castingModeOverride === 'cleric'
      const prompt = await this._promptSpellCheckDialog(spellItem, {
        castingMode: isCleric ? 'cleric' : 'wizard',
        isIdolMagic: isCleric,
        spellburnEligible: !isCleric
      })
      if (prompt === null) return
      this._applySpellCheckDialogToOptions(prompt, options)
    }

    if (castingMode === 'wizard' || castingMode === 'cleric') {
      // Phase 3 session 24 / D4 — `dispatch.castingModeOverride` lets
      // the dispatcher request a profile that diverges from the
      // actor's class (wizard spell on cleric, cleric spell on
      // non-cleric). `buildSpellCheckArgs` resolves the override
      // profile via the lib and populates the synthetic classState
      // slot; the resulting `args.profile` flows into
      // `_castViaCalculateSpellCheck`, which forwards it as the lib's
      // `SpellCheckOptions.profileOverride` so the lib uses it for
      // every behavior switch (casterTypes validation, spellburn,
      // disapproval, patron-taint, spell-loss recovery).
      let args = buildSpellCheckArgs(this, spellItem, {
        ...options,
        castingModeOverride: dispatch.castingModeOverride
      })
      // No lib-side profile for this actor's *class* (homebrew / unregistered
      // class casting a wizard- or cleric-castingMode spell). Pre-Phase-7-s16
      // this dropped to `_rollSpellCheckLegacy`, which silently ignored
      // `options.spellburn` (PR #720 design-call #1). Instead derive the
      // profile from the spell's own castingMode — `getCasterProfile('wizard'
      // |'cleric')` always resolves the canonical profile — so the cast keeps
      // RAW wizard/cleric side-effects (spellburn, spell-loss, disapproval,
      // patron-taint) driven by the spell rather than the class. A homebrew
      // class wanting bespoke mechanics registers its own profile via
      // `registerClassProgression`, in which case `args` resolves on the first
      // call and this branch never fires.
      if (!args) {
        logDispatch('rollSpellCheck', 'adapter', { reason: 'profileFromCastingMode', mode: castingMode })
        args = buildSpellCheckArgs(this, spellItem, {
          ...options,
          castingModeOverride: castingMode
        })
      }
      return this._castViaCalculateSpellCheck(args, spellItem, options)
    }

    return this._castViaCastSpell(spellItem, options)
  }

  /**
   * Naked spell-check adapter branch (Phase 3 session 25 / D4(naked)).
   *
   * Routes ad-hoc spell-check rolls (no spellItem — `rollSpellCheck()`
   * with no `options.spell`, or `options.spell` referencing an item the
   * actor doesn't own) through the lib's `castSpell` with an optional
   * `spellbookEntry` (lib 0.10.0). Replaces the inline term-builder +
   * `processSpellCheck({rollTable: null})` legacy flow.
   *
   * Behavior parity with the pre-adapter no-item spell-check flow:
   *   - Action die from `system.attributes.actionDice.value`, overridden
   *     by `system.class.spellCheckOverrideDie` when set.
   *   - When `system.class.spellCheckOverride` is set, that string
   *     replaces level + abilityMod + otherMod as the sole modifier
   *     (matches the legacy Compound term that hides the breakdown).
   *   - When unset, level + abilityMod + spellCheckOtherMod combine as
   *     situational modifiers.
   *   - Check penalty applies for non-cleric actors (Idol-magic
   *     clerics skip).
   *   - Spellburn dialog prompts non-NPC non-cleric casters when
   *     `options.showModifierDialog` is set and no commitment is
   *     pre-attached, mirroring the item-bound wizard adapter route.
   *   - Foundry rolls the d20; `applyForceCritToFoundryRoll` honors
   *     shift-click GM forceCrit.
   *   - Cleric disapproval mechanics fire through the existing
   *     `actor.rollDisapproval` + `actor.applyDisapproval` system
   *     methods when natural ≤ disapprovalRange (mirrors legacy
   *     `processSpellCheck` cleric branch).
   *   - Chat emit uses the existing `renderSpellCheck` adapter helper;
   *     the no-table pass/fail/crit/fumble HTML indicator lives in
   *     chat-renderer.mjs and surfaces on `flags['dcc.spellResult']`.
   * @private
   */
  async _castNakedViaAdapter (options) {
    logDispatch('rollSpellCheck', 'adapter', { spell: options.spell ?? '', mode: 'naked' })

    const abilityId = options.abilityId || this.system.class.spellCheckAbility || ''
    const ability = this.system.abilities[abilityId] || { value: 10, mod: 0 }

    const isIdolMagic = this.classId === 'cleric'
    const profileType = isIdolMagic ? 'cleric' : 'wizard'
    const casterProfile = libGetCasterProfile(profileType) || libGetCasterProfile('wizard')

    let actionDie = this.system.attributes?.actionDice?.value || '1d20'
    if (this.system.class.spellCheckOverrideDie) {
      actionDie = this.system.class.spellCheckOverrideDie
    }

    // Q7-phase2 (session 27) — surface the unified modifier dialog
    // for naked checks too. Spellburn eligibility mirrors the
    // wizard-item route (NPCs + idol-magic clerics skip — legacy
    // never offered it to them). Idol-magic clerics still get the
    // dialog without Spellburn / CheckPenalty so they can override
    // the die / Compound bonus.
    if (options.showModifierDialog && !options.spellburn && !this.isNPC) {
      const prompt = await this._promptSpellCheckDialog(null, {
        castingMode: isIdolMagic ? 'cleric' : 'wizard',
        isIdolMagic,
        spellburnEligible: !isIdolMagic
      })
      if (prompt === null) return
      this._applySpellCheckDialogToOptions(prompt, options)
    }

    if (options.actionDieOverride) {
      actionDie = options.actionDieOverride
    }

    const casterLevel = Number(this.system.details?.level?.value || 0)
    const abilityModifier = parseInt(ability.mod || 0, 10) || 0
    const situationalModifiers = []
    const dialogModifierTotal = typeof options.dialogModifierTotal === 'number'
      ? options.dialogModifierTotal
      : null

    if (dialogModifierTotal !== null) {
      // Q7-phase2 — the dialog's flat total subsumes spellCheckOverride
      // / spellCheckOtherMod / check-penalty (the user saw and edited
      // them in the Compound + CheckPenalty terms). Lib level + ability
      // get zeroed out below so the rolled total = die + dialogTotal +
      // spellburn (matches the legacy "trust the user's total" contract).
      situationalModifiers.push({
        source: 'dialog-modifier',
        value: dialogModifierTotal,
        label: game.i18n.localize('DCC.RollModifierTitle')
      })
    } else if (this.system.class.spellCheckOverride) {
      // Legacy parity: when this class-level override is set, level +
      // abilityMod + otherMod are SUPPRESSED and a single bonus replaces
      // them. Surface it as a situational modifier and zero out the
      // ability+level contributions.
      const overrideValue = parseInt(this.system.class.spellCheckOverride, 10) || 0
      situationalModifiers.push({
        source: 'spell-check-override',
        value: overrideValue,
        label: game.i18n.localize('DCC.SpellCheck')
      })
    } else if (this.system.class.spellCheckOtherMod) {
      const otherMod = parseInt(this.system.class.spellCheckOtherMod, 10) || 0
      if (otherMod !== 0) {
        situationalModifiers.push({
          source: 'spell-check-other-mod',
          value: otherMod,
          label: game.i18n.localize('DCC.SpellCheckOtherMod')
        })
      }
    }

    // Idol-magic clerics skip the AC check penalty (matches the
    // legacy `applyCheckPenalty = !isIdolMagic` switch). When the
    // dialog is in play the user toggled it in the CheckPenalty term;
    // skip the auto-append.
    if (!isIdolMagic && dialogModifierTotal === null) {
      const checkPenalty = parseInt(this.system?.attributes?.ac?.checkPenalty || 0, 10) || 0
      if (checkPenalty !== 0) {
        situationalModifiers.push({
          source: 'check-penalty',
          value: checkPenalty,
          label: game.i18n.localize('DCC.CheckPenalty')
        })
      }
    }

    const spell = {
      id: 'naked-spell-check',
      name: options.spell || game.i18n.localize('DCC.SpellCheck'),
      level: 1,
      casterTypes: ['wizard', 'cleric', 'elf'],
      description: ''
    }

    // Suppress lib's auto-additive level + ability when the dialog's
    // flat total drives the modifier list, OR when the legacy
    // `spellCheckOverride` shim replaces them. Both paths feed the
    // full bonus through `situationalModifiers`.
    const suppressLibAuto = dialogModifierTotal !== null || !!this.system.class.spellCheckOverride

    const input = {
      spell,
      casterProfile,
      casterLevel: suppressLibAuto ? 0 : casterLevel,
      abilityScore: parseInt(ability.value || 10, 10) || 10,
      abilityModifier: suppressLibAuto ? 0 : abilityModifier,
      actionDie: normalizeLibDie(actionDie)
    }

    if (situationalModifiers.length > 0) {
      input.situationalModifiers = situationalModifiers
    }

    if (options.spellburn && typeof options.spellburn === 'object') {
      const burn = options.spellburn
      const str = Number(burn.str) || 0
      const agl = Number(burn.agl) || 0
      const sta = Number(burn.sta) || 0
      if (str > 0 || agl > 0 || sta > 0) {
        input.spellburn = { str, agl, sta }
      }
    }

    // Cleric disapproval range — the lib's `castSpell` reads
    // `input.disapprovalRange` for its `calculateDisapprovalIncrease`
    // book-keeping. Adapter handles the actual disapproval roll +
    // chat below via `actor.rollDisapproval` (legacy parity).
    if (isIdolMagic) {
      const disapprovalRange = parseInt(this.system.class?.disapproval || 1, 10) || 1
      input.disapprovalRange = disapprovalRange
    }

    const plan = libCastSpell(input, { mode: 'formula' })

    const foundryRoll = new Roll(plan.formula)
    await foundryRoll.evaluate()

    const natural = applyForceCritToFoundryRoll(
      foundryRoll,
      foundryRoll.dice?.[0]?.total ?? foundryRoll.total,
      options
    )

    const result = libCastSpell(input, {
      mode: 'evaluate',
      roller: () => natural
    })

    // Spellburn applied via the lib's event in item-bound routes; for
    // naked we just deduct here since there's no `createSpellEvents`
    // wiring (no spellItem to mutate). Clamped at 0, not 1: per DCC RAW a
    // physical ability may be burned all the way to 0 (Stamina to 0 is
    // lethal). This matches the pre-adapter `DCCSpellburnTerm` callback
    // semantics (the legacy `#modifySpellburn` dialog permitted a
    // resulting score of 0) and the item-bound `onSpellburnApplied` bridge
    // in `adapter/spell-events.mjs`.
    if (input.spellburn) {
      const burn = input.spellburn
      await this.update({
        'system.abilities.str.value': Math.max(0, this.system.abilities.str.value - (burn.str || 0)),
        'system.abilities.agl.value': Math.max(0, this.system.abilities.agl.value - (burn.agl || 0)),
        'system.abilities.sta.value': Math.max(0, this.system.abilities.sta.value - (burn.sta || 0))
      })
    }

    const abilityLabel = abilityId ? CONFIG.DCC.abilities[abilityId] : undefined
    // Flavor base: an explicit spell name wins; otherwise an optional
    // `checkLabel` (i18n key or literal — `localize` passes a non-key
    // through unchanged) lets a class/module relabel the raw check
    // (e.g. "Mutation Check"); falls back to the generic "Spell Check".
    let flavor = options.spell ||
      (options.checkLabel ? game.i18n.localize(options.checkLabel) : game.i18n.localize('DCC.SpellCheck'))
    if (abilityLabel) {
      flavor += ` (${game.i18n.localize(abilityLabel)})`
    }

    await renderSpellCheck({
      actor: this,
      spellItem: null,
      flavor,
      result,
      foundryRoll
    })

    // Cleric disapproval: legacy parity. When natural is in the
    // disapproval range and automation is enabled, draw the
    // disapproval table + emit chat. Failed casts (no `success` tier
    // hit) increment the disapproval range via `applyDisapproval`.
    if (isIdolMagic && game.settings.get('dcc', 'automateClericDisapproval')) {
      const disapprovalRange = parseInt(this.system.class?.disapproval || 1, 10) || 1
      const inRange = natural <= disapprovalRange
      const successTiers = ['success', 'success-minor', 'success-major', 'success-critical']
      const success = result.tier && successTiers.includes(result.tier)
      if (inRange) {
        await this.rollDisapproval(natural)
      }
      if (!success) {
        await this.applyDisapproval()
      }
    }

    // Post-result seam parity with the legacy `processSpellCheck` path
    // (item casts fire it there; this adapter route does not). Naked casts
    // carry no patron taint, so `suppressPatronTaint` is moot here.
    emitAfterSpellCheckResult(this, {
      foundryRoll,
      result,
      spellItem: null,
      castingMode: isIdolMagic ? 'cleric' : 'wizard',
      spellburn: sumSpellburn(input.spellburn)
    })

    return foundryRoll
  }

  /**
   * Generic-castingMode adapter branch. Side-effect-free cast via the
   * lib's `castSpell`.
   * @private
   */
  async _castViaCastSpell (spellItem, options) {
    const input = buildSpellCastInput(this, spellItem, options)

    const plan = libCastSpell(input, { mode: 'formula' })

    const foundryRoll = new Roll(plan.formula)
    await foundryRoll.evaluate()

    const natural = applyForceCritToFoundryRoll(
      foundryRoll,
      foundryRoll.dice?.[0]?.total ?? foundryRoll.total,
      options
    )

    const result = libCastSpell(input, {
      mode: 'evaluate',
      roller: () => natural
    })

    const flavor = this._buildSpellCheckFlavor(spellItem, options)
    await renderSpellCheck({
      actor: this,
      spellItem,
      flavor,
      result,
      foundryRoll
    })

    // Post-result seam parity (see `processSpellCheck`). Generic-mode casts
    // carry no patron taint, so `suppressPatronTaint` is moot here.
    emitAfterSpellCheckResult(this, {
      foundryRoll,
      result,
      spellItem,
      castingMode: 'generic',
      spellburn: sumSpellburn(input.spellburn)
    })

    return foundryRoll
  }

  /**
   * Wizard / cleric-castingMode adapter branch. Routes through
   * `calculateSpellCheck` so the lib's spell-loss bookkeeping (wizard)
   * and disapproval handling (cleric) drive the cast. Event callbacks
   * in `spell-events.mjs` bridge lib events to Foundry side effects:
   * `onSpellLost` → `item.update({system.lost: true})`,
   * `onDisapprovalIncreased` → `actor.update({system.class.disapproval:
   * newRange})` + gain chat. The disapproval sub-roll chat is posted
   * here (the lib doesn't pass `disapprovalResult` to the callback).
   *
   * Two-pass formula/evaluate pattern. The pass-2 roller is
   * formula-dispatching: returns the pre-rolled spell-check natural
   * for the action-die formula, and a pre-rolled 1d4 for the
   * disapproval sub-roll (only when cleric + natural is inside the
   * range — the lib's `handleClericDisapproval` is the only sub-roll
   * path today).
   * @private
   */
  async _castViaCalculateSpellCheck (args, spellItem, options) {
    const { character, input, profile } = args
    const events = createSpellEvents({ actor: this, spellItem })

    // `suppressPatronTaint` opt-out: clear the lib's patron-spell flag so
    // its RAW creeping-chance pipeline is skipped for this cast (mirrors the
    // legacy `processSpellCheck` `!suppressPatronTaint` guard). With the flag
    // off, the patron-taint table load + d100/d6 pre-rolls below collapse,
    // and the lib's pass-2 runs no taint sub-roll. For variant modules (e.g.
    // MCC) that implement their own patron mechanic off `afterSpellCheckResult`.
    if (options.suppressPatronTaint) {
      input.isPatronSpell = false
    }

    // Q7-phase2 (session 27) — fold dialog overrides into the lib
    // input. The dispatcher captured them in `options` (see
    // `_applySpellCheckDialogToOptions`). Action die maps directly to
    // `input.actionDie`; the user's flat modifier total flows in as a
    // `dialog-modifier` situational AFTER subtracting the lib's
    // auto-additive `casterLevel + abilityModifier` so the rolled
    // total matches the legacy "trust the user's total" contract
    // without double-counting (the lib re-adds level + ability from
    // `character` inside `buildSpellCastInput`).
    if (options.actionDieOverride) {
      input.actionDie = normalizeLibDie(options.actionDieOverride)
    }
    if (typeof options.dialogModifierTotal === 'number') {
      const casterLevel = character.classInfo?.level ?? 0
      const abilityId = profile.spellCheckAbility
      const abilityScore = character.state?.abilities?.[abilityId]?.current ?? 10
      const libAutoTotal = casterLevel + libGetAbilityModifier(abilityScore)
      const netSituational = options.dialogModifierTotal - libAutoTotal
      if (netSituational !== 0) {
        input.situationalModifiers = [
          ...(input.situationalModifiers ?? []),
          {
            source: 'dialog-modifier',
            value: netSituational,
            label: game.i18n.localize('DCC.RollModifierTitle')
          }
        ]
      }
    }

    // Cleric path needs a disapproval table so the lib's
    // `handleClericDisapproval` runs the full table draw (lib skips
    // the draw if the table is missing — matching legacy behavior
    // when no table is configured).
    if (profile?.type === 'cleric') {
      const disapprovalTable = await loadDisapprovalTable(this)
      if (disapprovalTable) {
        input.disapprovalTable = disapprovalTable
      } else {
        // Telemetry for a silent adapter degradation: the cleric cast
        // continues through the lib, but `handleClericDisapproval` skips
        // the sub-roll because no table is plumbed in. Matches legacy
        // behavior when no table is configured — but previously invisible.
        logDispatch('rollSpellCheck', 'adapter', { reason: 'noDisapprovalTable' })
      }
    }

    // Wizard / elf path — if the spell item doesn't yet carry a
    // rolled mercurial effect, pre-roll one via the lib's
    // `rollMercurialMagic`, persist it to the Foundry item, and
    // attach it to the lib's spellbook entry so the cast's
    // `onMercurialEffect` event fires with the freshly rolled
    // effect. When a table isn't configured (setting unset, unit-test
    // env), skip the pre-roll — matches legacy `DCCItem.rollSpellCheck`
    // behavior (the legacy path only displays an existing mercurial
    // effect and leaves first-cast rolling to the user-triggered
    // `DCCItem.rollMercurialMagic` item-sheet button).
    if (profile && profile.usesMercurial && spellItem) {
      const spellbookEntry = character.state?.classState?.[profile.type]?.spellbook?.spells?.[0]
      if (spellbookEntry && !spellbookEntry.mercurialEffect) {
        await this._rollMercurialIfNeeded(spellItem, spellbookEntry, profile.type)
      }
    }

    // D3b — wizard / elf patron-taint manifestation table. Loaded
    // when the cast qualifies for the creeping-chance check (patron-
    // bound + patron-based spell); the lib's
    // `applyPatronTaintAcquisition` indexes a d6 on this table when
    // acquisition fires (either path). When no table resolves for
    // the actor's patron, the lib falls back to the minimal
    // "Patron taint from ${patronId}" event — matches legacy
    // behavior for unauthored patrons.
    if (
      (profile?.type === 'wizard' || profile?.type === 'elf') &&
      input.isPatronSpell &&
      this.system.class?.patron
    ) {
      const patronTaintTable = await loadPatronTaintTable(this)
      if (patronTaintTable) {
        input.patronTaintTable = patronTaintTable
      }
    }

    // Pass 1: build the formula without rolling. Events are omitted
    // here — the lib fires `onSpellburnApplied` + `onMercurialEffect`
    // unconditionally when their inputs are set (see `cast.js:339-343`),
    // so passing `events` to pass 1 would double-apply the burn / emit
    // duplicate mercurial chat. Pass 2 is the authoritative side-effect
    // pass. `onSpellLost` / `onDisapprovalIncreased` are gated on
    // pass-2-only conditions (spell lost / natural roll), so earlier
    // sessions could pass events to both passes without issue; the
    // unconditional events introduced by session 5 force the split.
    // Pass `profileOverride` on every lib call so the lib uses the
    // adapter-resolved profile regardless of `character.classInfo.classId`.
    // This is a no-op when the override matches the character-derived
    // profile (canonical Wizard / Cleric / Elf cases) and is load-bearing
    // for the D4 cross-class cases (wizard spell on cleric actor, cleric
    // spell on non-cleric actor) where the lib would otherwise pick the
    // actor's class profile and misroute behavior.
    const libOptions = { profileOverride: profile }
    const plan = libCalculateSpellCheck(character, input, { mode: 'formula', ...libOptions }, {})
    if (plan.error) {
      ui.notifications.warn(plan.error)
      return
    }

    const foundryRoll = new Roll(plan.formula)
    await foundryRoll.evaluate()

    const natural = applyForceCritToFoundryRoll(
      foundryRoll,
      foundryRoll.dice?.[0]?.total ?? foundryRoll.total,
      options
    )

    // Pre-roll the disapproval 1d4 via Foundry so the pass-2 roller
    // has a value to hand back when the lib calls `options.roller('1d4')`
    // inside `rollDisapproval`. Only needed when cleric + natural is
    // in the disapproval range; avoids a spurious d4 roll otherwise.
    let disapprovalD4 = null
    if (
      profile?.type === 'cleric' &&
      input.disapprovalTable &&
      natural <= (character.state.classState?.cleric?.disapprovalRange ?? 0)
    ) {
      const d4Roll = new Roll('1d4')
      await d4Roll.evaluate()
      disapprovalD4 = d4Roll.total
    }

    // D3a — pre-roll the patron-taint 1d100 for the lib's creeping-chance
    // check. Only fired when this cast qualifies for the check (patron-
    // bound wizard/elf casting a patron-related spell); avoids a spurious
    // d100 roll otherwise. D3b adds the paired 1d6 pre-roll for the
    // manifestation lookup — only when a `patronTaintTable` resolved
    // for this patron (otherwise the lib skips the sub-roll and emits
    // a minimal "Patron taint from <patron>" event).
    let patronTaintD100 = null
    let patronTaintD6 = null
    if (
      (profile?.type === 'wizard' || profile?.type === 'elf') &&
      input.isPatronSpell &&
      this.system.class?.patron
    ) {
      const d100Roll = new Roll('1d100')
      await d100Roll.evaluate()
      patronTaintD100 = d100Roll.total

      if (input.patronTaintTable) {
        const d6Roll = new Roll('1d6')
        await d6Roll.evaluate()
        patronTaintD6 = d6Roll.total
      }
    }

    // Pass 2 runs twice to avoid partial-failure mutations. The probe
    // runs with an empty events object so any `result.error` the lib
    // surfaces (misconfigured spell definition, wrong casterTypes,
    // corrupted spellbook entry) is detected BEFORE `onSpellburnApplied`
    // / `onSpellLost` / `onDisapprovalIncreased` / `onPatronTaint` mutate
    // actor+item state. Only when the probe is clean do we replay with
    // the real events wired — the roller is deterministic (pre-rolled
    // natural, disapproval d4, creeping-chance d100, and manifestation
    // d6), so both passes return identical results and no sub-roll is
    // consumed twice.
    const roller = (formula) => {
      if (formula === '1d4' && disapprovalD4 !== null) return disapprovalD4
      if (formula === '1d100' && patronTaintD100 !== null) return patronTaintD100
      if (formula === '1d6' && patronTaintD6 !== null) return patronTaintD6
      return natural
    }

    const probe = libCalculateSpellCheck(
      character,
      input,
      { mode: 'evaluate', roller, ...libOptions },
      {}
    )
    if (probe.error) {
      console.error('[DCC adapter] calculateSpellCheck pass-2 error', { actor: this.name, spell: spellItem?.name, error: probe.error })
      ui.notifications.warn(probe.error)
      return
    }

    const result = libCalculateSpellCheck(
      character,
      input,
      { mode: 'evaluate', roller, ...libOptions },
      events
    )

    warnIfDivergent('rollSpellCheck', foundryRoll.total, result.total, { actor: this.name, spell: spellItem?.name })

    const flavor = this._buildSpellCheckFlavor(spellItem, options, profile)
    await renderSpellCheck({
      actor: this,
      spellItem,
      flavor,
      result,
      foundryRoll
    })

    // Post the disapproval roll chat after the main spell-check chat,
    // mirroring the legacy ordering: spell check, then disapproval roll.
    // Both are awaited here, so their relative order IS guaranteed. The
    // "gained-range" EMOTE is NOT part of that guarantee — it's emitted
    // by the `onDisapprovalIncreased` callback inside pass 2 above
    // (`libCalculateSpellCheck(..., events)`), and that callback creates
    // its ChatMessage fire-and-forget (see `spell-events.mjs` — the lib
    // doesn't await the callback). So the emote's landing position
    // relative to these two messages is not deterministic; treat it as
    // "around the same time," not strictly last.
    if (result.disapprovalResult) {
      await renderDisapprovalRoll({
        actor: this,
        disapprovalResult: result.disapprovalResult
      })
    }

    // Session 5 — mercurial display chat. Rendered directly from
    // `result.mercurialEffect` rather than via the lib's
    // `onMercurialEffect` event because that event fires on both
    // formula + evaluate passes (unconditional when the spellbook
    // entry carries an effect) and its Promise return isn't
    // awaitable through the lib. Legacy parity: the effect's
    // `displayOnCast` gate mirrors the item's `displayInChat` flag
    // (`DCCItem.rollSpellCheck:382`).
    if (spellItem && result.mercurialEffect && result.mercurialEffect.displayOnCast !== false) {
      await renderMercurialEffect({
        actor: this,
        spellItem,
        effect: result.mercurialEffect
      })
    }

    // D3a (2026-04-24) — persist the lib's per-cast patron-taint chance
    // update. The lib runs the RAW creeping-chance check + result-table
    // detection inside `calculateSpellCheck`; when the check ran this
    // cast, `result.newPatronTaintChance` carries the updated value
    // (1 on acquisition, currentChance + 1 on miss). The actor stores
    // the chance as a percent string (`"3%"`), so format before writing.
    // NPCs bail — matches the legacy `processSpellCheck:601-637`
    // PC-only mechanic.
    if (
      !this.isNPC &&
      result.patronTaintChecked &&
      Number.isFinite(result.newPatronTaintChance)
    ) {
      await this.update({
        'system.class.patronTaintChance': `${result.newPatronTaintChance}%`
      })
    }

    // Post-result seam parity (see `processSpellCheck`). `castingMode` is the
    // adapter-resolved profile (`wizard` / `cleric` / `elf`); the lib applied
    // any spellburn via `onSpellburnApplied`, so report the input amount.
    emitAfterSpellCheckResult(this, {
      foundryRoll,
      result,
      spellItem,
      castingMode: profile?.type,
      suppressPatronTaint: !!options.suppressPatronTaint,
      spellburn: sumSpellburn(input.spellburn)
    })

    return foundryRoll
  }

  /**
   * Pre-roll a mercurial magic effect for a wizard / elf spell whose
   * Foundry item doesn't yet carry one. Mirrors the lib-spec flow in
   * `dcc-core-lib/spells/mercurial.js`: d100 + (luckMod × 10) lookup
   * on a mercurial table. The rolled effect is persisted to the
   * Foundry item so later casts display it without re-rolling, and
   * attached to the supplied `spellbookEntry` so the same cast's
   * `onMercurialEffect` event fires with the fresh effect. Silent
   * no-op when no mercurial magic table is configured — matches the
   * legacy `DCCItem.rollMercurialMagic:564` fall-back.
   *
   * `classKey` is the lowercase caster profile type (`'wizard'`,
   * `'elf'`, …) and selects the per-class registration first; the
   * resolver falls back to `'default'` then the legacy single-table
   * field. See `dcc.registerMercurialMagicTable` (Group E session 1)
   * for the registry contract.
   *
   * @private
   */
  async _rollMercurialIfNeeded (spellItem, spellbookEntry, classKey) {
    const mercurialTable = await loadMercurialMagicTable(classKey)
    if (!mercurialTable) {
      // Telemetry for the silent skip: the cast continues but without
      // a fresh mercurial effect, matching the legacy
      // `DCCItem.rollMercurialMagic:564` no-table fall-back.
      logDispatch('rollSpellCheck', 'adapter', { reason: 'noMercurialTable' })
      return
    }

    // Foundry-side d100 so Dice So Nice + chat breakdown show a real
    // roll. The lib's roller receives '1d100' and we hand back the
    // Foundry total; the luck modifier is applied inside the lib.
    const d100Roll = new Roll('1d100')
    await d100Roll.evaluate()
    const luckMod = Number(this.system?.abilities?.lck?.mod) || 0

    const effect = libRollMercurialMagic(luckMod, mercurialTable, {
      roller: () => d100Roll.total
    })

    await spellItem.update({
      'system.mercurialEffect.value': effect.rollValue,
      'system.mercurialEffect.summary': effect.summary || '',
      'system.mercurialEffect.description': effect.description || '',
      'system.mercurialEffect.displayInChat': effect.displayOnCast !== false
    })

    // Attach to the in-flight spellbookEntry so the lib's pass-2
    // `castSpell` surfaces the mercurial effect on the result, and
    // `_castViaCalculateSpellCheck`'s post-cast render sees it.
    spellbookEntry.mercurialEffect = effect
  }

  /**
   * Build the chat flavor line shared by both adapter branches.
   * @private
   */
  _buildSpellCheckFlavor (spellItem, options, profile) {
    const abilityId = options.abilityId || profile?.spellCheckAbility
    const abilityLabel = abilityId ? CONFIG.DCC.abilities[abilityId] : undefined
    let flavor = spellItem?.name ?? game.i18n.localize('DCC.SpellCheck')
    if (abilityLabel) {
      flavor += ` (${game.i18n.localize(abilityLabel)})`
    }
    return flavor
  }
}

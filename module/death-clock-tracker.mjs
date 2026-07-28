/* global CONFIG, foundry, game, Hooks */

/**
 * Death Clock tracker (issue #843, phase 2) — the DCC Tools sidebar tool
 * for the death & dying countdown.
 *
 * A judge-facing dialog (FleetingLuck / SpellDuel pattern) listing every
 * bleeding-out Player with their rounds remaining, with controls:
 *
 * - **Advance Round** — the manual out-of-combat tick: every dying PC's
 *   clock loses one round (`tickDeathClock`), with the usual final-chance
 *   warning / death resolution.
 * - Per-character: adjust the clock ±1 round, **Stabilize** (clear the
 *   clock without penalty — the rules-priced save stays the heal path),
 *   and **Mark as dead** (the full skull-button death with the Roll the
 *   Body prompt).
 *
 * Players can open it too and see who is bleeding out; the controls are
 * judge-only. The tool registers itself in the DCC Tools sidebar tab via
 * the `dcc.getSidebarTools` extension hook (the system is the hook's first
 * in-core consumer), gated on the `dcc.enableDeathClock` world setting.
 * `registerDeathClockTracker()` runs at `init` so the listener exists
 * before the sidebar's first render during `Game#initializeUI`.
 */

import {
  DYING_STATUS_ID,
  adjustDeathClock,
  deathClockEnabled,
  expireDeathClock,
  getDeathClockRemaining,
  getDyingEffect,
  stabilizeDeathClock,
  tickDeathClock
} from './death-clock.mjs'
import { USER_GUIDE_URL } from './sidebar-tab.mjs'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

class DeathClockTrackerDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'death-clock-tracker',
    classes: ['dcc', 'sheet', 'death-clock-tracker'],
    tag: 'form',
    position: {
      width: 420,
      height: 'auto'
    },
    actions: {
      tickRound: this.#onTickRound,
      adjustClock: this.#onAdjustClock,
      stabilize: this.#onStabilize,
      resolveDeath: this.#onResolveDeath,
      openSheet: this.#onOpenSheet
    },
    window: {
      resizable: true,
      title: 'DCC.DeathClock'
    }
  }

  static PARTS = {
    element: {
      template: 'systems/dcc/templates/dialog-death-clock.html'
    }
  }

  /** All world Players currently bleeding out. */
  static get dyingActors () {
    return game.actors.filter(actor => actor.type === 'Player' && getDyingEffect(actor))
  }

  /** @inheritDoc */
  async _prepareContext (options = {}) {
    const context = await super._prepareContext(options)
    const dying = DeathClockTrackerDialog.dyingActors.map(actor => {
      const remaining = getDeathClockRemaining(actor)
      return {
        id: actor.id,
        name: actor.name,
        img: actor.img,
        remaining,
        lastChance: remaining === 0
      }
    })
    return Object.assign(context, {
      cssClass: 'dcc',
      isGM: game.user.isGM,
      config: CONFIG.DCC,
      dying
    })
  }

  /** @override */
  async close (options = {}) {
    // Keep the facade in sync when the window is closed via the header X
    // or Escape, so the next sidebar-tool click reopens in one click
    // (mirrors FleetingLuckDialog#close).
    DeathClockTracker.dialog = null
    return super.close(options)
  }

  /**
   * Resolve the actor a row control refers to (`closest` also matches the
   * target itself).
   */
  static #rowActor (target) {
    return game.actors.get(target.closest('[data-actor-id]')?.dataset.actorId)
  }

  // The isGM checks below are UI gating, not security: the real
  // enforcement boundary is Foundry's document permissions — a player
  // driving these helpers from the console can only mutate effects on
  // actors they own, which they could already edit directly.

  /**
   * Manual out-of-combat round advance: tick every dying PC's clock.
   * @this {DeathClockTrackerDialog}
   */
  static async #onTickRound () {
    if (!game.user.isGM) return
    for (const actor of DeathClockTrackerDialog.dyingActors) {
      await tickDeathClock(actor)
    }
    await DeathClockTracker.refresh()
  }

  /**
   * Adjust one clock by the control's delta.
   * @this {DeathClockTrackerDialog}
   */
  static async #onAdjustClock (event, target) {
    if (!game.user.isGM) return
    const actor = DeathClockTrackerDialog.#rowActor(target)
    if (actor) await adjustDeathClock(actor, parseInt(target.dataset.delta) || 0)
    await DeathClockTracker.refresh()
  }

  /**
   * Judge override: clear the clock without penalty.
   * @this {DeathClockTrackerDialog}
   */
  static async #onStabilize (event, target) {
    if (!game.user.isGM) return
    const actor = DeathClockTrackerDialog.#rowActor(target)
    if (actor) await stabilizeDeathClock(actor)
    await DeathClockTracker.refresh()
  }

  /**
   * Resolve as death (skull-button parity + Roll the Body prompt).
   * @this {DeathClockTrackerDialog}
   */
  static async #onResolveDeath (event, target) {
    if (!game.user.isGM) return
    const actor = DeathClockTrackerDialog.#rowActor(target)
    if (actor) await expireDeathClock(actor)
    await DeathClockTracker.refresh()
  }

  /**
   * Open the character sheet from the row avatar.
   * @this {DeathClockTrackerDialog}
   */
  static async #onOpenSheet (event, target) {
    const actor = DeathClockTrackerDialog.#rowActor(target)
    if (actor?.testUserPermission?.(game.user, 'OBSERVER') || game.user.isGM) {
      await actor?.sheet?.render(true)
    }
  }
}

/**
 * Static facade mirroring FleetingLuck / SpellDuel: `show()` toggles the
 * dialog, `refresh()` re-renders it if open, `registerDeathClockTracker()`
 * wires the sidebar tool and the auto-refresh hooks at `init`.
 */
export class DeathClockTracker {
  static dialog = null

  /** Toggle the tracker dialog. */
  static async show () {
    if (DeathClockTracker.dialog) {
      await DeathClockTracker.dialog.close()
      DeathClockTracker.dialog = null
    } else {
      DeathClockTracker.dialog = new DeathClockTrackerDialog()
      DeathClockTracker.dialog.render(true)
    }
  }

  /** Re-render the tracker if open. */
  static async refresh () {
    if (DeathClockTracker.dialog?.rendered) {
      return DeathClockTracker.dialog.render(false)
    }
  }
}

/**
 * The `dcc.getSidebarTools` listener: contribute the Death Clock tool to
 * the DCC Tools sidebar tab while the feature is enabled. Exported for the
 * unit tests.
 */
export function onGetSidebarToolsForDeathClock (tools) {
  if (!deathClockEnabled()) return
  tools.deathClock = {
    label: 'DCC.DeathClock',
    icon: 'fas fa-heart-pulse',
    onClick: () => DeathClockTracker.show(),
    help: `${USER_GUIDE_URL}Death-Clock/`
  }
}

/**
 * Register the sidebar tool and the auto-refresh listeners. Runs at `init`
 * (module/init-hook.mjs) so the tool is present when the sidebar tab first
 * renders during `Game#initializeUI`, before `ready`.
 */
export function registerDeathClockTracker () {
  Hooks.on('dcc.getSidebarTools', onGetSidebarToolsForDeathClock)

  // Keep an open tracker live as Dying effects come and go (clock start,
  // heal, expiry, manual HUD toggles) or tick (flag updates).
  for (const hook of ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect']) {
    Hooks.on(hook, (effect) => {
      if (effect?.statuses?.has?.(DYING_STATUS_ID)) DeathClockTracker.refresh()
    })
  }
}

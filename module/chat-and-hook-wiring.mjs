/* global foundry, game, Hooks, ui, CONST */

/**
 * Chat- and hook-wiring surface extracted from `module/dcc.js`.
 *
 * `Hooks.on` / `Hooks.once` handlers covering:
 *   - `hotbarDrop` — macro creation when a rollable is dropped on the hotbar
 *   - `renderChatMessageHTML` — chat decorations (crit/fail highlight, minimum-damage
 *     enforcement, spell-result HTML, data-item-id, emote rolls, crit/fumble lookups,
 *     and TableResult navigation)
 *   - `getChatMessageContextOptions` — context-menu options on chat cards
 *   - `getCompendiumContextOptions` — hide "Import All" for non-world-document packs
 *     (our `dcc-effects` ActiveEffect compendium)
 *   - `renderActorDirectory` — parser quick-import bridge
 *   - `preCreateActor` / `preCreateItem` — default-image assignment + Player
 *     prototype-token actor-link
 *   - `applyActiveEffect` — DiceChain bump for string-valued dice expressions
 *   - `preUpdateActor` — sync prototype-token texture when the actor image changes
 *   - `updateCombat` — Active Effect duration expiry on round advance
 *   - `combatTurn` / `combatRound` — auto-reset action-die pips at the start of
 *     a combatant's turn (multiple-action-dice feature, gated)
 *   - `renderCombatTracker` — inject per-combatant action-die pips (gated)
 *   - `item-piles-ready` — one-shot Item Piles module integration
 *   - `getProseMirrorMenuDropDowns` — sidebar-style menu in the rich-text editor
 *
 * Handlers are exported individually so the unit tests can invoke them as plain
 * functions; the `CHAT_AND_HOOK_WIRING_HOOKS` dispatch table + the
 * `registerChatAndHookWiring()` entry-point mirror the
 * `module/settings-table-hooks.mjs` / `module/table-loading.mjs` pattern.
 */

import { abilityLogPreUpdateActor } from './ability-score-log.js'
import * as chat from './chat.js'
import parser from './parser.js'
import EntityImages from './entity-images.js'
import SpellResult from './spell-result.js'
import TableResult from './table-result.js'
import { setupItemPilesForDCC } from './item-piles-support.js'
import { createDCCMacro } from './macros.mjs'
import { onModifyAttackRollTerms } from './weapon-range.mjs'
import { onCombatTurnForActionDice, onCombatRoundForActionDice, onRenderCombatTrackerForActionDice } from './action-dice-tracker.mjs'
import { onUpdateActorForDeath } from './auto-dead-status.mjs'
import { shouldRenderEnhancedAttackCard, renderEnhancedAttackCard } from './chat/enhanced-attack-card.mjs'

/**
 * Create a macro when a rollable is dropped on the hotbar.
 */
export function onHotbarDrop (bar, data, slot) {
  return createDCCMacro(data, slot)
}

/**
 * Decorate rolled chat messages: crit/fail highlight, minimum-damage clamp,
 * spell-result HTML, data-item-id forwarding, optional emote-roll rewrites,
 * crit/fumble result lookups, and TableResult navigation.
 */
export async function onRenderChatMessageHTML (message, html, data) {
  if (!message.isRoll || !message.isContentVisible || !message.rolls.length) return

  if (game.user.isGM) {
    message.setFlag('core', 'canPopout', true)
  }

  // Enhanced attack card (client setting) — renders in place of the plain card
  // and is mutually exclusive with the emote rewrite for attacks. When it
  // renders we still run crit/fail highlight, TableResult navigation, and the
  // Mighty Deed listeners against the new content, then bail before the emote /
  // lookup pipeline below (which would re-render or double-process the card).
  if (shouldRenderEnhancedAttackCard(message)) {
    const rendered = await renderEnhancedAttackCard(message, html)
    if (rendered) {
      chat.highlightCriticalSuccessFailure(message, html, data)
      chat.enforceMinimumDamage(message, html)
      TableResult.processChatMessage(message, html, data)
      chat.attachMightyDeedListeners(message, html)
      return
    }
  }

  chat.highlightCriticalSuccessFailure(message, html, data)
  chat.enforceMinimumDamage(message, html)
  SpellResult.processChatMessage(message, html, data)

  // Add data-item-id for modules that want to use it
  const itemId = message.getFlag('dcc', 'ItemId')
  if (itemId !== undefined) {
    const messageContent = html.querySelector('.message-content')
    if (messageContent) {
      messageContent.setAttribute('data-item-id', itemId)
    }
  }

  let emoteRolls = false
  try {
    emoteRolls = game.settings.get('dcc', 'emoteRolls')
  } catch {
    if (message.getFlag('dcc', 'emoteRoll') === true) {
      emoteRolls = true
    }
  }

  let automateDamageFumblesCrits
  try {
    automateDamageFumblesCrits = game.settings.get('dcc', 'automateDamageFumblesCrits')
  } catch {
    automateDamageFumblesCrits = false
  }

  if (emoteRolls === true) {
    if (game.user.isGM) {
      message.setFlag('dcc', 'emoteRoll', true)
    }
    chat.emoteAbilityRoll(message, html, data)
    chat.emoteApplyDamageRoll(message, html, data)
    chat.emoteAttackRoll(message, html, data)
    chat.emoteCritRoll(message, html, data)
    chat.emoteFumbleRoll(message, html, data)
    chat.emoteDamageRoll(message, html, data)
    chat.emoteInitiativeRoll(message, html, data)
    chat.emoteSavingThrowRoll(message, html, data)
    chat.emoteSkillCheckRoll(message, html, data)
  }

  // Show spell check pass/fail result for non-emote messages (emote path handles this in emoteSkillCheckRoll)
  if (emoteRolls === false) {
    const spellResult = message.getFlag('dcc', 'spellResult')
    if (spellResult) {
      const messageContent = html.querySelector('.message-content')
      if (messageContent) {
        messageContent.innerHTML += spellResult
      }
    }
  }

  if (emoteRolls === false || (emoteRolls === true && automateDamageFumblesCrits === false)) {
    // Await these async functions so the DOM is modified before we attach event listeners
    await chat.lookupCriticalRoll(message, html)
    await chat.lookupFumbleRoll(message, html, data)
  }

  // Process table result navigation AFTER emote/lookup functions have modified the HTML
  // This ensures event listeners are attached to the final DOM elements
  TableResult.processChatMessage(message, html, data)

  // Attach Mighty Deed table prompt listeners after the emote functions have modified the HTML (issue #319)
  chat.attachMightyDeedListeners(message, html)
}

/**
 * Context-menu options on chat cards — delegates to `chat.addChatMessageContextOptions`.
 */
export function onGetChatMessageContextOptions (html, options) {
  return chat.addChatMessageContextOptions(html, options)
}

/**
 * Hide the "Import All" entry from a compendium's sidebar context menu for
 * packs whose documents have no world home — most importantly our
 * `dcc-effects` ActiveEffect compendium.
 *
 * Foundry guards the *single-entry* "Import Entry" option with
 * `CONST.WORLD_DOCUMENT_TYPES.includes(documentName)` (so it is already hidden
 * for ActiveEffect packs), but the directory-level "Import All" option is only
 * guarded against Adventure packs (`documentName !== "Adventure"`). For an
 * ActiveEffect pack that leaves "Import All" available, and invoking it throws
 * `Cannot read properties of undefined (reading 'initializeTree')` deep inside
 * `CompendiumCollection.importAll` → `Folder.create` — there is no world-level
 * ActiveEffect directory to import into. Effects are meant to be dragged from
 * the compendium straight onto an actor or item, not imported into the world.
 *
 * This wraps the option's `visible` predicate to additionally suppress it
 * whenever the pack's `documentName` is not a world document type, mirroring
 * Foundry's own single-import guard so the directory and entry menus agree.
 */
export function onGetCompendiumContextOptions (directory, entries) {
  const importAll = entries.find(entry => entry.label === 'COMPENDIUM.ImportAll.Option')
  if (!importAll) return

  const originalVisible = importAll.visible
  importAll.visible = (li) => {
    const pack = game.packs.get(li?.dataset?.pack)
    // No world directory exists for non-world document types (e.g. ActiveEffect),
    // so "Import All" would crash — suppress it for those packs.
    if (pack && !CONST.WORLD_DOCUMENT_TYPES.includes(pack.documentName)) return false
    // Otherwise defer to Foundry's original predicate (or default-visible).
    if (typeof originalVisible === 'function') return originalVisible(li)
    return originalVisible ?? true
  }
}

/**
 * Quick-import bridge for the actor directory — delegates to `parser.onRenderActorDirectory`.
 */
export function onRenderActorDirectory (app, html) {
  parser.onRenderActorDirectory(app, html)
}

/**
 * Set the DCC default image + Player prototype-token actor-link on
 * newly-created actors (GM-only, brand-new actors only — not duplicates
 * or imports). Item Pile actors are skipped for the actor-link flag.
 */
export function onPreCreateActor (document, data, options) {
  // Assign an appropriate DCC actor image if not set
  if (game.user.isGM && !data.img) {
    const img = EntityImages.imageForActor(document.type)
    if (img) {
      document.updateSource({ img })
    }
  }

  // Set Player actor prototype tokens to Link Actor Data by default
  // Only for brand-new actors (not duplicates or imports)
  if (!options.keepId && document.type === 'Player' && !document.name.includes('Item Pile')) {
    document.updateSource({ 'prototypeToken.actorLink': true })
  }
}

/**
 * Set the DCC default image on newly-created items (GM-only, only when
 * no image is provided in the creation payload).
 */
export function onPreCreateItem (document, data, options) {
  if (!game.user.isGM || data.img) { return }

  // Assign an appropriate DCC item image
  const img = EntityImages.imageForItem(document.type)
  if (img) {
    document.updateSource({ img })
  }
}

/**
 * Custom ActiveEffect application for dice-chain change types: when the
 * value matches a `[+-]?\d+d` pattern, bump the actor's existing string
 * via `game.dcc.DiceChain.bumpDie`.
 */
export function onApplyActiveEffect (actor, change) {
  const { key, value } = change
  let update = null
  // We're only interested in strings (dice expressions)
  const current = foundry.utils.getProperty(actor, key) ?? null
  if (typeof (current) === 'string') {
    // If this is a dice chain pattern (e.g. +1d) then we're interested
    const diceChainPattern = /([+-]?\d+)[dD]/
    const match = value.match(diceChainPattern)
    if (match) {
      update = game.dcc.DiceChain.bumpDie(current, parseInt(match[1]))
      foundry.utils.setProperty(actor, key, update)
    }
  }
  return update
}

/**
 * Sync prototype-token texture with the actor image when the actor image
 * changes — only for clients that initiated the change and only when the
 * current token texture is empty or one of the known default images.
 */
export async function onPreUpdateActor (actor, changes, options, userId) {
  // Only process if this client initiated the change
  if (userId !== game.user.id) return

  // Check if the actor image is being changed
  if (!changes.img) return

  // Get the current prototype token texture
  const currentTokenImg = actor.prototypeToken?.texture?.src || ''

  // Define default images that should be replaced
  const defaultImages = [
    'icons/svg/mystery-man.svg',
    EntityImages.imageForActor(actor.type),
    EntityImages.imageForActor('default')
  ]

  // Only update token if it's using a default image or is empty
  if (!currentTokenImg || defaultImages.includes(currentTokenImg)) {
    // Update the prototype token image to match the new actor image
    changes['prototypeToken.texture.src'] = changes.img
  }
}

/**
 * Round-advance Active Effect expiry. GM-only. Walks every actor with
 * effects, removes effects whose duration has elapsed (round-based via
 * startRound + rounds; time-based via Foundry's `effect.isExpired`), and
 * surfaces a notification with the expired effect names.
 */
export async function onUpdateCombat (combat, changed, options, userId) {
  // Only process on the GM's client to avoid duplicates
  if (!game.user.isGM) return

  // Only process when round changes
  if (!('round' in changed)) return

  console.log(`DCC | Combat advanced to round ${combat.round}, checking for expired Active Effects...`)

  // Check all actors for expired effects
  for (const actor of game.actors) {
    if (actor.effects.size === 0) continue

    const expiredEffects = []

    for (const effect of actor.effects) {
      // Skip effects with no duration
      if (!effect.duration) continue

      // For round-based effects
      if (effect.duration.rounds && effect.duration.startRound !== undefined) {
        const startRound = effect.duration.startRound
        const durationRounds = effect.duration.rounds
        const endRound = startRound + durationRounds

        console.log(`DCC | Effect "${effect.name}": start=${startRound}, duration=${durationRounds}, end=${endRound}, current=${combat.round}`)

        if (combat.round >= endRound) {
          expiredEffects.push(effect.id)
          console.log(`DCC | Effect "${effect.name}" on ${actor.name} has expired (round ${combat.round} >= ${endRound})`)
        }
      } else if (effect.duration.seconds && effect.isExpired) {
        // For time-based effects, use Foundry's built-in expiration check
        expiredEffects.push(effect.id)
        console.log(`DCC | Time-based effect "${effect.name}" on ${actor.name} has expired`)
      }
    }

    // Remove expired effects
    if (expiredEffects.length > 0) {
      // Get effect names before deletion
      const effectNames = expiredEffects.map(id => {
        const effect = actor.effects.get(id)
        return effect?.name || 'Unknown'
      }).join(', ')

      await actor.deleteEmbeddedDocuments('ActiveEffect', expiredEffects)

      // Notify about expired effects
      ui.notifications.info(game.i18n.format('DCC.EffectsExpired', {
        actor: actor.name,
        effects: effectNames
      }))
    }
  }
}

/**
 * One-shot Item Piles module integration — delegates to `setupItemPilesForDCC`.
 */
export function onItemPilesReady () {
  return setupItemPilesForDCC()
}

/**
 * Custom ProseMirror menu dropdown for the sidebar style — appends a
 * `dcc-custom` entry to the `format` group with a `sidebar` toggle that
 * adds/removes the `sidebar` class on the current paragraph node.
 */
export function onGetProseMirrorMenuDropDowns (menu, items) {
  if ('format' in items) {
    items.format.entries.push({
      action: 'dcc-custom',
      title: 'DCC.CustomStyles',
      active: (state) => {
        const { $from } = state.selection
        const preserveAttrs = $from.parent.attrs._preserve || {}
        return preserveAttrs.class?.includes('sidebar') || false
      },
      children: [
        {
          action: 'sidebar',
          title: 'DCC.SidebarText',
          node: menu.schema.nodes.paragraph,
          active: (state) => {
            const { $from } = state.selection
            const preserveAttrs = $from.parent.attrs._preserve || {}
            return preserveAttrs.class?.includes('sidebar') || false
          },
          cmd: () => {
            const { state, dispatch } = menu.view
            const { $from } = state.selection
            const currentNode = $from.parent
            const preserveAttrs = currentNode.attrs._preserve || {}
            const hasSidebarClass = preserveAttrs.class?.includes('sidebar')

            let newClass
            if (hasSidebarClass) {
              // Remove sidebar class
              newClass = preserveAttrs.class.split(' ').filter(c => c !== 'sidebar').join(' ') || null
            } else {
              // Add sidebar class
              newClass = preserveAttrs.class ? `${preserveAttrs.class} sidebar` : 'sidebar'
            }

            const newPreserve = { ...preserveAttrs }
            if (newClass) newPreserve.class = newClass
            else delete newPreserve.class

            return foundry.prosemirror.commands.setBlockType(menu.schema.nodes.paragraph, {
              ...currentNode.attrs,
              _preserve: newPreserve
            })(state, dispatch)
          }
        }
      ]
    })
  }
}

export const CHAT_AND_HOOK_WIRING_HOOKS = Object.freeze({
  'dcc.modifyAttackRollTerms': { handler: onModifyAttackRollTerms, once: false },
  hotbarDrop: { handler: onHotbarDrop, once: false },
  renderChatMessageHTML: { handler: onRenderChatMessageHTML, once: false },
  getChatMessageContextOptions: { handler: onGetChatMessageContextOptions, once: false },
  getCompendiumContextOptions: { handler: onGetCompendiumContextOptions, once: false },
  renderActorDirectory: { handler: onRenderActorDirectory, once: false },
  preCreateActor: { handler: onPreCreateActor, once: false },
  preCreateItem: { handler: onPreCreateItem, once: false },
  applyActiveEffect: { handler: onApplyActiveEffect, once: false },
  preUpdateActor: { handler: onPreUpdateActor, once: false },
  updateActor: { handler: onUpdateActorForDeath, once: false },
  updateCombat: { handler: onUpdateCombat, once: false },
  combatTurn: { handler: onCombatTurnForActionDice, once: false },
  combatRound: { handler: onCombatRoundForActionDice, once: false },
  renderCombatTracker: { handler: onRenderCombatTrackerForActionDice, once: false },
  'item-piles-ready': { handler: onItemPilesReady, once: true },
  getProseMirrorMenuDropDowns: { handler: onGetProseMirrorMenuDropDowns, once: false }
})

export function registerChatAndHookWiring () {
  for (const [hookName, { handler, once }] of Object.entries(CHAT_AND_HOOK_WIRING_HOOKS)) {
    if (once) Hooks.once(hookName, handler)
    else Hooks.on(hookName, handler)
  }

  // Registered outside the dispatch table because `preUpdateActor` already
  // carries the prototype-token-sync handler there (one handler per hook
  // name in the table). Fallback logger for the Ability Score Log: records
  // direct ability value edits (macros, modules, GM bar edits) as 'manual'
  // entries unless the update carries the dcc.abilityLogged flag.
  Hooks.on('preUpdateActor', abilityLogPreUpdateActor)
}

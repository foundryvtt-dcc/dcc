/**
 * Drag-start data builder for the DCC actor sheet.
 *
 * Phase 7 (Appendix-A actor-sheet.js shrinkage): `_onDragStart` — the ~210-line
 * switch that maps a dragged sheet element to its macro `dragData` payload — was
 * lifted out of `module/actor-sheet.js` into this module as a free function. It
 * is the biggest cohesive chunk left in the sheet; unlike the `#private`
 * `prepare*` helpers it was already a plain (overridable) method, but the
 * shrinkage shape matches the rest of the `actor-sheet/*.mjs` arc: a free
 * function taking the actor, which the sheet's thin `_onDragStart` now calls.
 *
 * {@link buildDragStartData} is pure — it reads only the actor and the DOM event
 * and returns the `dragData` object (or `null`), leaving the single side effect
 * (`event.dataTransfer.setData`) in the sheet wrapper. It had no prior unit
 * coverage (drag is e2e-hard); as a free function it is now directly testable.
 *
 * {@link findDataset} (the parent-walking dataset reader) moved here too so the
 * builder can call it directly. `DCCActorSheet.findDataset` stays as a thin
 * static wrapper delegating to this export — it is consumed cross-module
 * (`party-sheet.js`) and documented (`CLICKABLE_ITEMS.md`), so its public
 * surface is preserved byte-for-byte.
 */

/**
 * Search an element and then its ancestors for a dataset attribute.
 * @param {HTMLElement} element - the starting element.
 * @param {string} attribute - the camelCase dataset key to find.
 * @returns {string|null} the attribute value, or `null` if no ancestor has it.
 */
export function findDataset (element, attribute) {
  while (element && !(attribute in element.dataset)) {
    element = element.parentElement
  }
  if (element && attribute in element.dataset) {
    return element.dataset[attribute]
  }
  return null
}

/**
 * Build the drag-and-drop `dragData` payload for a dragged sheet element.
 *
 * Behaviour preserved exactly from the original `_onDragStart`:
 * - returns `null` for an element that isn't draggable (`!dataset.drag`);
 * - ActiveEffect drags resolve the effect off the actor and return an
 *   `ActiveEffect` payload (no `tokenId`), or `null` if the effect is gone;
 * - otherwise dispatches on `data-drag-action` to build the matching
 *   roll/macro payload, appending `tokenId` for token (synthetic) actors.
 *
 * The caller is responsible for writing the result to `event.dataTransfer`.
 *
 * @param {Actor} actor - the sheet's `options.document`.
 * @param {DragEvent} event - the originating dragstart event.
 * @returns {object|null} the `dragData` payload, or `null` if nothing to drag.
 */
export function buildDragStartData (actor, event) {
  const li = event.currentTarget

  // Check if element is draggable
  if (!li.dataset.drag) return null

  let dragData = null

  // Handle ActiveEffect drags
  if (li.dataset.dragType === 'ActiveEffect') {
    const effectId = li.dataset.effectId
    const effect = actor.effects.get(effectId)
    if (effect) {
      return {
        type: 'ActiveEffect',
        uuid: effect.uuid,
        data: effect.toObject()
      }
    }
    return null
  }

  // Use data-drag-action for specific drag types
  const dragAction = li.dataset.dragAction

  // Get common data
  const actorId = actor.id
  const classes = event.target.classList

  switch (dragAction) {
    case 'ability': {
      const abilityId = findDataset(event.currentTarget, 'ability')
      const labelFor = event.target.getAttribute('for') || ''
      const rollUnder = (labelFor === 'system.abilities.lck.value') || classes.contains('luck-roll-under')
      dragData = {
        type: 'Ability',
        actorId,
        data: {
          abilityId,
          rollUnder
        }
      }
    }
      break

    case 'initiative':
      dragData = {
        type: 'Initiative',
        actorId,
        data: {}
      }
      break

    case 'hitDice':
      dragData = {
        type: 'Hit Dice',
        actorId,
        data: {
          dice: actor.system.attributes.hitDice.value
        }
      }
      break

    case 'save': {
      const saveId = findDataset(event.currentTarget, 'save')
      dragData = {
        type: 'Save',
        actorId,
        data: saveId
      }
    }
      break

    case 'skill': {
      const skillId = findDataset(event.currentTarget, 'skill')
      const actorSkill = actor.system.skills[skillId]
      const skillName = actorSkill ? actorSkill.label : skillId
      dragData = {
        type: 'Skill',
        actorId,
        data: {
          skillId,
          skillName
        }
      }
    }
      break

    case 'luckDie':
      dragData = {
        type: 'Luck Die',
        actorId,
        data: {
          die: actor.system.class.luckDie
        }
      }
      break

    case 'spellCheck': {
      const ability = findDataset(event.currentTarget, 'ability')
      const itemId = findDataset(event.currentTarget, 'itemId')
      const spell = findDataset(event.currentTarget, 'spell')

      const dragDataContent = { ability }

      // If we have an itemId, include spell details for item-based macros
      if (itemId) {
        const item = actor.items.get(itemId)
        if (item) {
          dragDataContent.itemId = itemId
          dragDataContent.name = item.name
          dragDataContent.img = item.img
        }
      } else if (spell) {
        // Fallback to spell name from data attribute
        dragDataContent.name = spell
      }

      dragData = {
        type: 'Spell Check',
        actorId,
        data: dragDataContent
      }
    }
      break

    case 'attackBonus':
      dragData = {
        type: 'Attack Bonus',
        actorId,
        data: {
          die: actor.system.details.attackBonus
        }
      }
      break

    case 'actionDice':
      dragData = {
        type: 'Action Dice',
        actorId,
        data: {
          die: actor.system.attributes.actionDice.value || '1d20'
        }
      }
      break

    case 'disapprovalRange':
      dragData = {
        type: 'Apply Disapproval',
        actorId,
        data: {}
      }
      break

    case 'disapprovalTable':
      dragData = {
        type: 'Roll Disapproval',
        actorId,
        data: {}
      }
      break

    case 'weapon': {
      const itemId = findDataset(event.currentTarget, 'itemId')
      const weapon = actor.items.get(itemId)
      if (weapon) {
        dragData = Object.assign(
          weapon.toDragData(),
          {
            dccType: 'Weapon',
            actorId,
            data: weapon,
            dccData: {
              weapon,
              backstab: classes.contains('backstab-button')
            }
          }
        )
      }
    }
      break

    case 'item': {
      const itemId = findDataset(event.currentTarget, 'itemId')
      const item = actor.items.get(itemId)
      if (item) {
        // Use 'DCC Item' for spells to prevent Foundry's default macro creation
        // Use 'Item' for other items to maintain normal drag/drop functionality
        const dragType = item.type === 'spell' ? 'DCC Item' : 'Item'

        dragData = {
          type: dragType,
          actorId,
          uuid: item.uuid,
          data: item,
          system: {
            item
          }
        }
      }
    }
      break
  }

  if (dragData && actor.isToken) {
    dragData.tokenId = actor.token.id
  }

  return dragData
}

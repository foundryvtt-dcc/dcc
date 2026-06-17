/**
 * Drop handlers for the DCC actor sheet.
 *
 * Phase 7 (Appendix-A actor-sheet.js shrinkage): the two self-contained
 * drop-side handlers — `_handleContainerDrop` (drop an item onto a container
 * element) and `_onDropActiveEffect` (drop an ActiveEffect onto the actor) —
 * were lifted out of `module/actor-sheet.js` into this module as free functions,
 * mirroring the drag-side extraction in `actor-sheet/drag-drop.mjs`. Both read
 * only the actor (`this.options.document`) plus the DOM event / drag data, so
 * they extract cleanly; the sheet's `_handleContainerDrop` / `_onDropActiveEffect`
 * collapse to thin wrappers calling these.
 *
 * `_onDrop` itself stays on the sheet — it calls `super._onDrop`, so it cannot
 * fully move.
 *
 * The Foundry globals each function touches (`fromUuid`, `ui.notifications`,
 * `game.i18n`, `foundry.utils.deepClone`) are injected via a `deps` parameter
 * defaulting to the live globals — the dependency-injection idiom used across
 * `actor-sheet/items.mjs` and `extension-api.mjs` — so the capacity / container
 * / effect-clone logic is directly unit-testable. Both methods were plain
 * (non-`#private`) but had no prior unit coverage; as free functions they do now.
 */

/**
 * Handle dropping an item onto a container element on the actor sheet.
 *
 * Behaviour preserved exactly from the original `_handleContainerDrop`:
 * - returns `undefined` when the drop isn't over a container element or the
 *   container/item can't be resolved (caller falls through to default handling);
 * - for an item already on this actor, validates `canContainItem` then sets the
 *   container reference;
 * - for an item from the sidebar / compendium / another actor, validates the
 *   container's item- and weight-capacity then creates it on the actor inside
 *   the container;
 * - returns `false` when a validation fails or a Foundry write throws, `true`
 *   when the drop was handled.
 *
 * @param {Actor} actor - the sheet's `options.document`.
 * @param {DragEvent} event - the originating drop event.
 * @param {object} data - the resolved drag-event data (`{ uuid, data?, ... }`).
 * @param {object} [deps] - injectable Foundry globals (default to the live ones).
 * @param {(uuid: string) => Promise<any>} [deps.fromUuid] - UUID resolver.
 * @param {object} [deps.ui] - `ui` (only `.notifications.warn` is used).
 * @param {object} [deps.i18n] - `game.i18n` (only `.localize` is used).
 * @returns {Promise<boolean|undefined>} `false` if handled with error, `true` if
 *   handled, `undefined` if not a container drop.
 */
export async function handleContainerDrop (actor, event, data, deps = {}) {
  const {
    fromUuid: resolveUuid = globalThis.fromUuid,
    ui: uiApi = globalThis.ui,
    i18n = globalThis.game?.i18n
  } = deps

  // Find the closest container drop target
  const containerEl = event.target.closest('[data-container-id]')
  if (!containerEl) return undefined

  const containerId = containerEl.dataset.containerId
  const container = actor.items.get(containerId)
  if (!container) return undefined

  // Get the dropped item
  let item
  try {
    item = await resolveUuid(data.uuid)
  } catch (err) {
    console.warn(`DCC | Failed to resolve dropped item UUID: ${data.uuid}`, err)
    return false
  }
  if (!item) return false

  // Item already on this actor — just set the container reference
  if (item.parent?.id === actor.id) {
    const check = container.canContainItem(item)
    if (!check.allowed) {
      uiApi.notifications.warn(i18n.localize(check.reason))
      return false
    }
    try {
      await item.update({ 'system.container': containerId })
    } catch (err) {
      console.error(`DCC | Failed to add item "${item.name}" to container`, err)
      return false
    }
    return true
  }

  // Item from sidebar, compendium, or another actor — create on actor inside the container
  const itemData = item.toObject ? item.toObject() : data.data
  if (!itemData) return undefined
  // Validate capacity (circularity checks don't apply for items not yet on the actor)
  if (container.availableItemCapacity !== null) {
    const itemQuantity = parseInt(itemData.system?.quantity) || 1
    if (itemQuantity > container.availableItemCapacity) {
      uiApi.notifications.warn(i18n.localize('DCC.ContainerFull'))
      return false
    }
  }
  if (container.availableWeightCapacity !== null) {
    const itemWeight = (parseFloat(itemData.system?.weight) || 0) * (parseInt(itemData.system?.quantity) || 1)
    if (itemWeight > container.availableWeightCapacity) {
      uiApi.notifications.warn(i18n.localize('DCC.ContainerTooHeavy'))
      return false
    }
  }
  itemData.system = itemData.system || {}
  itemData.system.container = containerId
  try {
    await actor.createEmbeddedDocuments('Item', [itemData])
  } catch (err) {
    console.error('DCC | Failed to create item in container', err)
    return false
  }
  return true
}

/**
 * Handle dropping an ActiveEffect onto the actor.
 *
 * Creates a copy of the effect on the actor (does not remove it from the source).
 * Behaviour preserved exactly from the original `_onDropActiveEffect`:
 * - returns `false` if the user doesn't own the actor;
 * - resolves the effect from `data.data`, or by UUID for compendium drags;
 * - deep-clones the effect data (preserving module flags such as aura settings),
 *   strips the `_id`, sets `origin`/`transfer`, and defaults the icon.
 *
 * @param {Actor} actor - the sheet's `options.document`.
 * @param {object} data - the drag data (`{ data?, uuid? }`).
 * @param {object} [deps] - injectable Foundry globals (default to the live ones).
 * @param {(uuid: string) => Promise<any>} [deps.fromUuid] - UUID resolver.
 * @param {(value: any) => any} [deps.deepClone] - `foundry.utils.deepClone`.
 * @returns {Promise<ActiveEffect[]|boolean>} the created effect(s), or `false`.
 */
export async function dropActiveEffect (actor, data, deps = {}) {
  const {
    fromUuid: resolveUuid = globalThis.fromUuid,
    deepClone = globalThis.foundry?.utils?.deepClone
  } = deps

  if (!actor.isOwner) return false

  // Get the effect - either from data.data or by resolving the UUID (for compendium drags)
  let effectData = data.data
  if (!effectData && data.uuid) {
    const effect = await resolveUuid(data.uuid)
    if (!effect) return false
    effectData = effect.toObject()
  }
  if (!effectData) return false

  // Prepare the effect data for creation on the actor
  // Use foundry.utils.deepClone to preserve all effect data including module flags (e.g., aura settings)
  const createData = deepClone(effectData)
  // Override specific fields for actor-based effects
  delete createData._id // Remove ID so a new one is generated
  createData.origin = actor.uuid // Set origin to this actor
  createData.transfer = false // Effects directly on actors don't transfer
  createData.img = createData.img || 'icons/svg/aura.svg'

  // Create the effect on the actor
  return actor.createEmbeddedDocuments('ActiveEffect', [createData])
}

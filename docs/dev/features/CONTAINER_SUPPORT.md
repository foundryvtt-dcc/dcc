# Container Item Support

**Status:** Implemented
**Issue:** [#702](https://github.com/foundryvtt-dcc/dcc/issues/702)
**Effort:** Large

## Overview

Add a `container` item type (backpacks, sacks, saddlebags, etc.) that can hold other physical items. This enables inventory organization on character sheets and integrates with the existing Item Piles module support for trade/transfer workflows.

## Background

### What Was Requested

A user requested nested container items so inventory can be managed with true backpacks. They referenced Item Piles as previously providing this, but this is a misunderstanding of how Item Piles works:

- **Item Piles "container" pile type** = an actor/token on the canvas (treasure chest). This works today with DCC's existing integration.
- **Item Piles item-level containers** = items on a character sheet that hold other items. This requires the **game system** to implement the data model and UI. Item Piles only provides transfer/trade hooks (`ITEM_TYPE_HANDLERS`) that systems can wire into.

### How D&D5e Implements This (reference model)

D&D5e uses a **reverse-reference** pattern:
- Each physical item has a `system.container` field holding the ID of its parent container item
- All items remain flat in the actor's `items` collection — nesting is purely a UI concern
- Container contents are retrieved by filtering: `actor.items.filter(i => i.system.container === containerId)`
- Maximum nesting depth is capped (5 levels in dnd5e)

This is the recommended pattern because FoundryVTT does not support embedded Items within Items at the database level.

## Implementation Plan

### Phase 1: Data Model

#### 1a. New `ContainerData` item data model

Create `module/data/item/container-data.mjs` extending `PhysicalItemData`:

| Field | Type | Description |
|-------|------|-------------|
| `capacity.weight` | NumberField | Max weight the container can hold (0 = unlimited) |
| `capacity.items` | NumberField | Max number of items (0 = unlimited) |
| `weightReduction` | NumberField | Percentage weight reduction (e.g. bag of holding = 100) |

The container's own `weight`, `quantity`, `equipped`, `value` fields come from `PhysicalItemData`.

Contents are **not stored on the container** — they are derived by querying the actor's items collection.

#### 1b. Add `container` field to `PhysicalItemData`

Add to `module/data/item/base-item.mjs`:

```js
container: new StringField({ nullable: true, initial: null })
```

This field is inherited by all physical item types (weapon, ammunition, armor, container, equipment, mount, treasure) and holds the ID of the parent container, or `null` if not contained. A `StringField` is used instead of `ForeignDocumentField` for compatibility with the integration test environment.

#### 1c. Register the new item type

- Add `"container": {}` to `documentTypes.Item` in `system.json`
- Register `ContainerData` in `module/data/item/_module.mjs`
- Wire up in `module/dcc.js` item type registration

### Phase 2: Item Document Logic

Add methods/getters to `DCCItem` (or `ContainerData`) for:

| Method | Purpose |
|--------|---------|
| `contents` getter | Return `this.parent.items.filter(i => i.system.container === this.id)` |
| `contentsWeight` getter | Sum weight of contents, applying `weightReduction` |
| `totalWeight` getter | Container's own weight + reduced contents weight |
| `isContainer` getter | `this.type === 'container'` |
| `isContained` getter | `!!this.system.container` |
| `availableCapacity` | Remaining weight/item capacity |

Handle lifecycle events:
- **Delete container**: unparent all contained items (items move to top-level inventory)
- **Transfer container**: include contents when transferring between actors
- **Validation**: prevent circular containment, enforce max nesting depth (MAX_CONTAINER_DEPTH = 3, effective 2 container levels deep)

### Phase 3: Actor Sheet UI

#### 3a. Inventory display changes in `#prepareItems()`

- Add a `containers` array alongside existing categories
- Filter contained items out of their normal categories (a sword in a backpack should not appear in the weapons list)
- Nest contained items under their parent container in the UI

#### 3b. Container section in equipment tab

Display containers as collapsible sections:
- Container name, weight, capacity usage
- Contained items listed underneath (indented)
- Expand/collapse toggle
- Drop target for dragging items into the container

#### 3c. Drag and drop

- Drag an item onto a container to set `system.container = containerId`
- Drag an item out of a container to clear `system.container`
- Drag a container to reorder it (contents follow)
- Prevent dropping a container into itself or its descendants

#### 3d. Container item sheet

A dedicated sheet (or shared equipment sheet with container-specific section) showing:
- Standard physical item fields (name, weight, value, description)
- Capacity configuration (weight limit, item limit, weight reduction)
- List of contained items with remove buttons

### Phase 4: Item Piles Integration

Update `module/item-piles-support.js` to add `ITEM_TYPE_HANDLERS`.

**Important**: Handler keys must use `game.itempiles.CONSTANTS.ITEM_TYPE_METHODS.*` computed
property names (e.g., `[game.itempiles.CONSTANTS.ITEM_TYPE_METHODS.TRANSFER]`), not string
literals. The TRANSFER handler must mutate the `items` array in place via `items.push(...)` —
item-piles ignores the return value.

When a container is transferred, `_onCreate` on `DCCItem` re-associates orphaned content items
with the new container by matching `flags.dcc.sourceContainerName`.

Bump the integration `VERSION`.

### Phase 5: Encumbrance Integration

- Update weight calculations in `DCCActor` to account for container weight reduction
- A contained item's weight should only be counted once (via its container's `totalWeight`, not individually)
- Uncontained items continue to calculate as they do today

## Migration

- No data migration needed for existing worlds — the new `container` field on physical items defaults to `null`
- Existing items are unaffected; they simply have no parent container

## i18n Keys

Key i18n keys added (see `lang/en.json` for the complete list):
- `TYPES.Item.container` — "Container"
- `DCC.Container` / `DCC.Containers` — Type label and section header
- `DCC.ContainerCapacityWeight` / `DCC.ContainerCapacityItems` — Capacity config labels
- `DCC.ContainerWeightReduction` — "Weight Reduction (%)"
- `DCC.ContainerContents` / `DCC.ContainerEmpty` / `DCC.ContainerFull` — Contents display
- `DCC.ContainerRemoveItem` — "Remove from container"
- Validation messages: `DCC.ContainerCannotContainSelf`, `DCC.ContainerCircularReference`, `DCC.ContainerMaxDepth`, `DCC.ContainerTooHeavy`, `DCC.ContainerNotAContainer`, `DCC.ContainerItemNotPhysical`

## Testing

- Unit tests for `ContainerData` schema and computed properties
- Unit tests for containment logic (nesting, circular prevention, cascade delete)
- Unit tests for weight calculations with `weightReduction`
- Integration tests for drag-and-drop containment on actor sheet
- Integration tests for Item Piles transfer with containers

## Open Questions

1. **Should containers support currency?** A pouch could hold coins. D&D5e supports this; DCC could too but it adds complexity.
2. ~~**Max nesting depth?**~~ Resolved: `MAX_CONTAINER_DEPTH = 3` (backpack > pouch > item).
3. ~~**NPC sheets?**~~ Resolved: NPC sheets support containers via `actor-partial-npc-equipment.html`.
4. ~~**Default container items?**~~ Resolved: `dcc-containers` compendium pack ships backpack, sack (large/small), chest (large/small), and saddlebags.

## Dependencies

- No external module dependencies — this is a system-native feature
- Item Piles integration is optional (Phase 4) and only activates when the module is present

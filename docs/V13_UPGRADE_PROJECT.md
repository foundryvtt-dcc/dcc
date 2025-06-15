# V13 Upgrade Project - DCC System

This document tracks all components in the DCC system that need to be upgraded for full Foundry V13 compatibility.

## Current Migration Status: ~70% Complete ✅

**Last Updated**: December 2024

### ✅ **COMPLETED** (Critical V13.341 Requirements)
- **Sheet Registration**: All actor/item sheets properly registered in `dcc.js` 
- **getSceneControlButtons Hook**: Updated for new V13 data structure
- **Core Sheet Migration**: Actor/Item sheets using ActorSheetV2/ItemSheetV2
- **Major Dialog Migration**: FleetingLuck, Welcome, SavingThrow dialogs migrated to ApplicationV2

### ❌ **REMAINING WORK** (High Priority)
- **V13 HTML→DOM conversion** needed in 6 files ❌ **CRITICAL FOR V13**
- **V13 API deprecations** - Document update using deprecated `data:` parameter ❌ **CRITICAL**
- **5 FormApplication classes** still need migration to ApplicationV2
- **Dialog → DialogV2** migration in 2 files remaining  
- **jQuery elimination** COMPLETED ✅ - key-state.js ✅ party-sheet.js ✅ dcc.js ✅

## 1. FormApplication (V1) → ApplicationV2 Migrations Needed ❌

The following files extend `FormApplication` and need to be migrated to `ApplicationV2`:

### High Priority - Core Functionality ❌ **PENDING**
1. **`module/actor-config.js`** ❌
   - Class: `DCCActorConfig extends FormApplication`
   - V1 Patterns: `get defaultOptions()`, `getData()`, `activateListeners()`, `_updateObject()`
   - Purpose: Actor configuration dialog

2. **`module/item-config.js`** ❌
   - Class: `DCCItemConfig extends FormApplication`
   - V1 Patterns: `get defaultOptions()`, `getData()`, `activateListeners()`, `_updateObject()`
   - Purpose: Item configuration dialog

3. **`module/actor-level-change.js`** ❌
   - Class: `DCCActorLevelChange extends FormApplication`
   - V1 Patterns: `get defaultOptions()`, `getData()`, `activateListeners()`, `_updateObject()`
   - Purpose: Level change interface

4. **`module/melee-missile-bonus-config.js`** ❌
   - Class: `MeleeMissileBonusConfig extends FormApplication`
   - V1 Patterns: `get defaultOptions()`, `getData()`, `activateListeners()`, `_updateObject()`
   - Purpose: Combat bonus configuration

5. **`module/parser.js`** ❌
   - Class: `DCCActorParser extends FormApplication`
   - V1 Patterns: `get defaultOptions()`, `getData()`, `activateListeners()`, `_updateObject()`
   - Purpose: NPC/PC stat block parser

### Already Migrated ✅ **COMPLETED**
6. **`module/roll-modifier.js`** ✅
   - Successfully migrated to `HandlebarsApplicationMixin(ApplicationV2)`
   - Uses V2 patterns: `DEFAULT_OPTIONS`, `PARTS`, `_prepareContext()`, actions
   - Full V2 migration completed

## 2. Dialog (V1) → DialogV2 Migrations Needed ❌

### Remaining Dialog Usage ❌ **PENDING**
- `module/item-sheet.js` (lines 299, 332) ❌
- `module/parser.js` (line 105) ❌  
- `module/party-sheet.js` (line 261) ✅ COMPLETED

### Already Migrated or No Usage ✅ **COMPLETED**
- `module/actor-sheet.js` ✅ (No Dialog usage found)
- `module/saving-throw-config.js` ✅ (Migrated to ApplicationV2)
- `module/roll-modifier.js` ✅ (Migrated to ApplicationV2)
- `module/welcomeDialog.js` ✅ (Migrated to ApplicationV2)
- `module/fleeting-luck.js` ✅ (Migrated to ApplicationV2)
- `module/actor.js` ✅ (No Dialog usage found)
- `module/item.js` ✅ (No Dialog usage found)

## 3. jQuery Usage (Deprecated in V13) ❌

### Remaining jQuery Usage ❌ **PENDING**

### **module/dcc.js** ✅
- **Line 1**: Global $ declaration - REMOVED
- **Lines 267-269**: Event handlers using `$(document).on()` - REPLACED with vanilla JS event delegation
- **Line 541**: jQuery wrapping of HTML element - REMOVED
- **Line 552**: jQuery `.find()` and `.attr()` - REPLACED with vanilla JS

### **module/key-state.js** ✅
- **Line 1**: Global $ declaration - REMOVED
- **Line 10**: `$(document).bind()` event binding - REPLACED with vanilla JS

### **module/party-sheet.js** ✅
- **Line 258**: `$(event.currentTarget).parents('.item').slideUp(200, ...)` - REPLACED with vanilla JS
- **Line 320**: `const li = $(event.currentTarget).parents('.item')` - REPLACED with vanilla JS

### Already Cleaned ✅ **COMPLETED**

### **module/actor-sheet.js** ✅
- Previously mentioned jQuery usage has been removed

### **module/roll-modifier.js** ✅  
- Migrated to ApplicationV2, jQuery usage eliminated

### **FILES NEEDING V13 HTML→DOM CONVERSION** ❌

### **module/chat.js** ❌ **HIGH PRIORITY**
- 20+ instances of `html.find()`, `html.html()`, `html.addClass()`, `html.remove()`
- Chat rendering functions use V12 jQuery-style html parameters

### **module/actor-level-change.js** ❌ **HIGH PRIORITY**
- `html.find('.level-increase').click()` and similar patterns
- FormApplication activateListeners using jQuery-style html

### **module/party-sheet.js** ❌ **HIGH PRIORITY**  
- Multiple `html.find()` calls in activateListeners method
- Party sheet event handling using jQuery-style html

### **module/roll-modifier.js** ❌ **MEDIUM PRIORITY**
- Multiple `html.find()` button click handlers
- Roll modifier dialog using jQuery-style html  

### **module/spell-result.js** ❌ **MEDIUM PRIORITY**
- `html.find()` for spell result navigation buttons

### **module/actor-sheet.js** ❌ **SPECIAL CASE**
- Contains commented-out jQuery-style code in `activateListeners()` 
- **DO NOT REMOVE** - This code shows the V12 event handlers that need to become V2 `actions`
- Required for proper ApplicationV2 conversion mapping

### **CRITICAL V13 Change: HTML Element Transition**

**Foundry V12 → V13 Breaking Change:**
- **V12**: `html` parameters in hooks and methods are **jQuery objects** with `.find()`, `.html()`, `.addClass()` methods
- **V13**: `html` parameters are **plain DOM elements** without jQuery methods
- **Migration Required**: All `html.find()`, `html.html()`, `html.addClass()` etc. must be converted to vanilla DOM

**Common V13 Conversions Needed:**
- `html.find('.selector')` → `html.querySelector('.selector')` or `html.querySelectorAll('.selector')`
- `html.html(content)` → `html.innerHTML = content`
- `html.addClass('class')` → `html.classList.add('class')`
- `html.removeClass('class')` → `html.classList.remove('class')`
- `html.attr('data-id')` → `html.getAttribute('data-id')`
- `html.attr('data-id', value)` → `html.setAttribute('data-id', value)`

**🚨 FormApplication Files**: When converting FormApplication classes to ApplicationV2, any commented-out jQuery code in `activateListeners()` should be **preserved** as it shows the V12 event handlers that need to become V2 actions.

## 3. V13 API Deprecations Found in DCC Codebase ❌

### **module/item-sheet.js:234** ❌ **CRITICAL - BREAKS IN V13**
- **Issue**: Using deprecated `data:` parameter for document updates
- **Current Code**: `this.object.update({ data: { results } })`
- **V13 Replacement**: `this.object.update({ system: { results } })`
- **Impact**: Will cause errors when updating item system data in V13

### **module/actor-sheet.js** ❌ **REVIEW NEEDED**
- **Issue**: Multiple drag/drop data structures using `data:` property
- **Lines**: 561, 573, 584, 592, 602, 617, 627, 637, 655, 666, 676, 693, 706, 716, 730, 747, 759, 767
- **Current Pattern**: `dragData = { type: 'Ability', actorId: this.actor.id, data: { abilityId, rollUnder } }`
- **Status**: Custom DCC system drag data - may not be affected by V13 changes but should be reviewed for consistency

### Common jQuery Patterns to Replace:
- `$(selector)` → `document.querySelector(selector)` or `document.querySelectorAll(selector)`
- `.find()` → `.querySelector()` or `.querySelectorAll()`
- `.click(handler)` → `.addEventListener('click', handler)`
- `.on(event, handler)` → `.addEventListener(event, handler)`
- `.html(content)` → `.innerHTML = content`
- `.text(content)` → `.textContent = content`
- `.val()` → `.value`
- `.addClass()` → `.classList.add()`
- `.removeClass()` → `.classList.remove()`
- `.attr()` → `.getAttribute()` or `.setAttribute()`

## 4. Already Migrated to V2 ✅ **COMPLETED**

The following components have already been migrated to V2 patterns:

### Sheets (Using ActorSheetV2/ItemSheetV2) ✅
- **`module/actor-sheet.js`**: `DCCActorSheet extends HandlebarsApplicationMixin(ActorSheetV2)` ✅
- **`module/item-sheet.js`**: `DCCItemSheet extends HandlebarsApplicationMixin(ItemSheetV2)` ✅
- **`module/actor-sheets-dcc.js`**: Multiple classes extending `DCCActorSheet` ✅

### Dialogs (Using ApplicationV2) ✅
- **`module/fleeting-luck.js`**: `FleetingLuckDialog extends HandlebarsApplicationMixin(ApplicationV2)` ✅
- **`module/welcomeDialog.js`**: `WelcomeDialog extends HandlebarsApplicationMixin(ApplicationV2)` ✅
- **`module/saving-throw-config.js`**: `SavingThrowConfig extends HandlebarsApplicationMixin(ApplicationV2)` ✅
- **`module/roll-modifier.js`**: `RollModifierDialog extends HandlebarsApplicationMixin(ApplicationV2)` ✅

### Critical V13.341 Requirements ✅
- **Sheet Registration**: All actor/item sheets properly registered in `module/dcc.js` ✅
- **getSceneControlButtons Hook**: Updated for new V13 data structure ✅

## 5. Updated Migration Priority ⚡

### Phase 1 - Critical Core Components ❌ **REMAINING**
1. ~~**Fix `getSceneControlButtons` hook usage** in `module/dcc.js`~~ ✅ **COMPLETED**
2. ~~**Remove remaining jQuery dependencies**~~ ✅ **FULLY COMPLETED** - key-state.js ✅ party-sheet.js ✅ dcc.js ✅
3. **Migrate `actor-config.js` and `item-config.js`** (core configuration) ❌
4. **Migrate `parser.js`** (import functionality) ❌

### Phase 2 - Game Mechanics ❌ **REMAINING**
1. **Migrate `actor-level-change.js`** (leveling system) ❌
2. **Migrate `melee-missile-bonus-config.js`** (combat modifiers) ❌
3. ~~Complete `roll-modifier.js` migration~~ ✅ **COMPLETED**

### Phase 3 - Dialog Cleanup ❌ **REMAINING**
1. **Replace remaining `Dialog` usage with `DialogV2`** (3 files) ❌
2. Test and verify all dialog interactions

## 6. Additional V13 Breaking Changes and Requirements

### Critical Breaking Changes from V13.341

**Sheet Registration Removal**: The most critical breaking change in V13.341:
- **Issue**: "To resolve an issue with Actor and Item sheets falling back to the AppV1 sheets, default actor and item sheet registrations have been removed."
- **Impact**: All systems must explicitly re-register their actor and item sheets
- **Required Action**: Systems need to call `Actors.registerSheet()` and `Items.registerSheet()` for all their sheet classes

### UI and Framework Changes

**CSS Layers Migration**:
- Foundry V13 uses CSS Cascade Layers for all UI elements
- All system and module styles are automatically opted into this feature
- Eliminates need for "specificity hacks" to override core styles
- CSS hierarchy: base → specific → general → exceptions → modules → system → layouts → compatibility → applications → blocks → elements → variables → reset

**jQuery Deprecation**:
- jQuery is being actively deprecated in V13
- All jQuery usage should be replaced with vanilla JavaScript
- This affects event handlers, DOM manipulation, and AJAX calls

**ApplicationV2 Migration**:
- 23 of 88 applications migrated to ApplicationV2 in V13
- All main game UI elements now use ApplicationV2
- All canvas document configuration sheets migrated
- Chat tab of sidebar migrated to ApplicationV2

### Text Editor Changes

**TinyMCE Deprecation**:
- TinyMCE deprecation timeline moved forward from V15 to V14
- Systems should migrate to ProseMirror editor
- ProseMirror provides collaborative editing and auto-save features

### API Changes

**ESModule Migrations**:
- Canvas and Shader classes migrated to ESModules with `foundry.<group>` namespace
- Container classes and QuadTree class migrated
- Pings, Interaction, MouseInteractionManager, RenderFlags, and CanvasAnimation classes migrated
- Pixi shapes and Graphics extension classes migrated
- Geometry classes (Ray, LimitedAnglePolygon, etc.), TextureLoader, and PreciseText classes migrated
- CanvasLayer classes (InteractionLayer, PlaceablesLayer, ControlsLayer) migrated
- **Old global names still work with deprecation warnings until V15**

**Method Signature Changes**:
- `Roll#render` now contains reference to containing `ChatMessage` if rendered in that context
- `BaseGrid#measurePath` result includes Euclidean distance as `.euclidean` property
- `CalendarData#add` method added for time calculations without database commits
- `NumberField#toInput` no longer creates range picker if field is nullable
- `NumberField#step` behavior changed to match HTML input step size
- `TextureExtractor#extract` return type changed for compression mode NONE

**Data Model Changes**:
- `PlaylistSound` Data Model: initial `channel` field value now `""` instead of undefined
- `SceneControls#controls` data structure changed from array to record of control sets and tools
- **Breaking change for `getSceneControlButtons` hook**

### DCC-Specific Breaking Change Impact

**getSceneControlButtons Hook (module/dcc.js)**:
The DCC system uses this hook to add the Fleeting Luck button:
```javascript
// Current V12 code that will break in V13:
Hooks.on('getSceneControlButtons', (controls) => {
  controls.tokens.tools.fleetingLuck = {
    name: 'fleetingLuck',
    title: game.i18n.localize('DCC.FleetingLuck'),
    icon: 'fas fa-balance-scale-left',
    onChange: (event, active) => {
      game.dcc.FleetingLuck.show()
    },
    button: true,
    active: true
  }
})
```

**Required Fix**: The data structure has changed from array-based to record-based. Need to update the hook handler to work with the new `SceneControl` and `SceneControlTool` types.

**Chat and Roll Changes**:
- Roll modes no longer used in `ChatMessage#_preCreate` if `options.rollMode` not set
- `ChatMessage.applyRollMode` no longer overwrites existing whisper recipients for private/blind rolls

**Database Operations**:
- Added new `ClientDocument.createDialog` and `ClientDocument.deleteDialog` parameters

**Deprecation Warnings**:
- `GridLayer#measureDistance` now supplies more informative deprecation warning
- Various ApplicationV2-related deprecation warnings for V1 patterns
- ESModule classes accessible via old global names with deprecation warnings until V15

### Platform Requirements

**Node.js Version**:
- V13 requires Node 20+ for those launching via NodeJS
- Older Node versions no longer supported

### New Build Options

**Portable Windows Build**:
- New portable Electron build for Windows
- New cross-platform headless Node.js build option
- Portable build allows USB drive deployment

## 7. Testing Requirements

After each migration phase:
1. **Sheet Registration**: Verify all actor/item sheets properly register and display
2. Test all migrated forms/dialogs open correctly
3. Verify data persistence (form submissions save properly)
4. Check event handlers work without jQuery
5. **CSS Compatibility**: Ensure styles work with new CSS Layers system
6. **Text Editor**: Test any rich text functionality with new ProseMirror editor
7. Ensure no console errors related to deprecated APIs
8. Test with both new and existing actors/items
9. **Node Version**: Verify Node 20+ compatibility for headless deployments
10. **Module Compatibility**: Test with all modules disabled (V13 default behavior)
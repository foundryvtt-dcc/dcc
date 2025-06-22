# FoundryVTT v13 Application Class Implementation Inconsistencies

## Overview

This document presents a detailed audit of all Application classes in the DCC system's `module/` folder, identifying implementation inconsistencies that could cause issues in FoundryVTT v13. The analysis focuses on patterns, best practices, and potential problems across 18 Application classes.

## Summary of Findings

### Critical Inconsistencies
1. **Inconsistent form submission handling patterns**
2. **Mixed approaches to DEFAULT_OPTIONS configuration**
3. **Inconsistent error handling and validation**
4. **Varied drag/drop implementation patterns**
5. **Inconsistent static method binding**
6. **Different approaches to template configuration**

---

## Detailed Analysis by Application Class

### Base Classes

#### 1. DCCActorSheet (`actor-sheet.js`)
**Parent**: `HandlebarsApplicationMixin(ActorSheetV2)`
**Status**: ⚠️ **Multiple inconsistencies** *(drag/drop issue fixed)*

**Issues:**
- **Form Data Processing**: Uses custom `_processFormData()` and `_processSubmitData()` methods with pending item updates mechanism (lines 984-1025). This is a unique pattern not used elsewhere.
- **Static Method Binding**: Most actions use proper static method binding (`this.#methodName`), but some like drag handlers use instance methods.
- **Template Configuration**: Uses both `CLASS_PARTS` and `CLASS_TABS` extension patterns, but implementation is complex.
- **Commented Code**: Contains commented-out form handler (line 52) indicating uncertain implementation.

**Critical Issues:**
- Form processing logic manually manages embedded document updates outside FoundryVTT's normal flow
- ~~Drag/drop handlers created in constructor rather than using declarative configuration~~ **FIXED**: ApplicationV2 in v13 doesn't automatically create drag/drop handlers like the older Application class did. The current implementation follows the proper v13 pattern but uses manual setup because that's the only way ApplicationV2 supports drag/drop. The `#findDataset` method was changed from private to public static to be accessible from instance methods.

#### 2. DCCPartySheet (`party-sheet.js`)
**Parent**: `DCCActorSheet`
**Status**: ✅ **Mostly consistent**

**Issues:**
- **Method Inconsistency**: Uses private `_fillRollOptions()` method (line 421) but parent class has static `fillRollOptions()`
- **Error Handling**: Missing error handling in drag/drop operations
- **Form Update Pattern**: Uses different update pattern than parent class (lines 460-490)

#### 3. DCCItemSheet (`item-sheet.js`)
**Parent**: `HandlebarsApplicationMixin(ItemSheetV2)`
**Status**: ⚠️ **Several issues**

**Issues:**
- **Template Configuration**: Dynamic template selection in `_configureRenderParts()` (lines 69-92) differs from other classes
- **Tab Configuration**: Complex dynamic tab logic in `_getTabsConfig()` (lines 110-140) not consistent with other sheets
- **Dead Code**: Contains unused `_fooBar()` method (lines 495-497)
- **Drag Drop Configuration**: Uses static method for handler creation (line 229) vs instance methods elsewhere

### Configuration Dialog Classes

#### 4. DCCActorConfig (`actor-config.js`)
**Parent**: `HandlebarsApplicationMixin(ApplicationV2)`
**Status**: ✅ **Good patterns**

**Consistent Implementation:**
- Proper static form handler
- Standard DEFAULT_OPTIONS structure
- Consistent context preparation

#### 5. DCCItemConfig (`item-config.js`)
**Parent**: `HandlebarsApplicationMixin(ApplicationV2)`
**Status**: ⚠️ **Template inconsistency**

**Issues:**
- **Template Resolution**: Uses dynamic template resolution in `_getTemplate()` (lines 36-45) but sets `template: null` in PARTS
- **Context Preparation**: Direct Object.assign pattern (line 66) differs from other classes' approach

#### 6. SavingThrowConfig (`saving-throw-config.js`)
**Parent**: `HandlebarsApplicationMixin(ApplicationV2)`
**Status**: ⚠️ **Naming inconsistency**

**Issues:**
- **Form Handler Access**: Uses `this.options.document` instead of `this.document` getter pattern (line 64)
- **Property Access**: Different document access pattern than other config classes

#### 7. MeleeMissileBonusConfig (`melee-missile-bonus-config.js`)
**Parent**: `HandlebarsApplicationMixin(ApplicationV2)`
**Status**: ✅ **Consistent with DCCActorConfig**

**Good Implementation:**
- Follows document getter pattern consistently
- Proper static form handler implementation

### Dialog Classes

#### 8. WelcomeDialog (`welcomeDialog.js`)
**Parent**: `HandlebarsApplicationMixin(ApplicationV2)`
**Status**: ⚠️ **Constructor parameter inconsistency**

**Issues:**
- **Constructor Pattern**: Takes custom `importContentHook` parameter (lines 9-12) instead of using standard options pattern
- **Context Method**: Uses different enrichHTML pattern than other dialogs
- **Action Handlers**: Actions access instance properties directly rather than through getters

#### 9. DCCActorLevelChange (`actor-level-change.js`)
**Parent**: `HandlebarsApplicationMixin(ApplicationV2)`
**Status**: ⚠️ **Complex state management**

**Issues:**
- **State Management**: Manages `currentLevel` as instance property with manual state tracking
- **DOM Manipulation**: Direct DOM manipulation in `_updateLevelUpDisplay()` (lines 176-229) instead of re-rendering
- **Error Handling**: Early returns with UI notifications in context preparation (lines 89-91)
- **Form Processing**: Unique form submission pattern with complex level data processing

#### 10. FleetingLuckDialog (`fleeting-luck.js`)
**Parent**: `HandlebarsApplicationMixin(ApplicationV2)`
**Status**: ⚠️ **Static class mixing patterns**

**Issues:**
- **Mixed Class Pattern**: Combines dialog class with static utility class in same file
- **State Management**: Uses static class properties for dialog instance tracking
- **Method Organization**: Static methods access instance properties via `this` binding
- **Context Method**: No async context preparation (line 40) unlike other dialogs

#### 11. RollModifierDialog (`roll-modifier.js`)
**Parent**: `HandlebarsApplicationMixin(ApplicationV2)`
**Status**: ❌ **Multiple critical issues**

**Critical Issues:**
- **Constructor Complexity**: Takes resolve/reject functions and manages promise manually (lines 252-262)
- **Form Submission**: Custom submission that resolves promise instead of normal form handling (lines 352-358)
- **State Reconstruction**: Complex `_constructRoll()` method that manually extracts data from DOM (lines 365-396)
- **Term Construction**: Elaborate term construction system that duplicates Foundry's roll parsing
- **Method Access**: Actions directly access private methods and properties
- **Close Behavior**: Custom close behavior that rejects promise (lines 557-560)

### Class-Specific Sheets

#### 12-19. Class-Specific Actor Sheets (`actor-sheets-dcc.js`)
**Parent**: `DCCActorSheet`
**Status**: ⚠️ **Inconsistent update patterns**

**Shared Issues Across All Class Sheets:**
- **Update Timing**: All perform automatic actor updates in `_prepareContext()` which can cause performance issues
- **Conditional Updates**: Use `sheetClass` checking but update pattern varies slightly between classes
- **Async Operations**: Mix of await patterns for TextEditor.enrichHTML calls
- **Configuration Consistency**: Some classes set different default configuration values inconsistently

**Specific Class Issues:**

**DCCActorSheetCleric**: ✅ Consistent implementation
**DCCActorSheetThief**: ✅ Mostly consistent, adds backstab config
**DCCActorSheetHalfling**: ✅ Consistent with base pattern
**DCCActorSheetWarrior**: ⚠️ Sets different attackBonusMode (`autoPerAttack` vs `flat`)
**DCCActorSheetWizard**: ✅ Consistent, enables spells properly
**DCCActorSheetDwarf**: ⚠️ Sets `useDeed` on skills, different from others
**DCCActorSheetElf**: ✅ Consistent with wizard pattern
**DCCActorSheetGeneric**: ⚠️ Overrides `PARTS` completely instead of using `CLASS_PARTS`

---

## Critical Inconsistency Patterns

### 1. Form Submission Handling

**Issue**: Three different patterns for form submission:
- **Standard Pattern**: `DCCActorConfig`, `DCCItemConfig` (await this.document.update)
- **Custom Pattern**: `DCCActorSheet` (custom _processFormData with embedded documents)
- **Promise Pattern**: `RollModifierDialog` (resolve promise instead of submission)

**Risk**: Different error handling, validation, and data flow patterns could cause unexpected behavior.

### 2. Document Access Patterns

**Issue**: Inconsistent ways to access the document being edited:
- **Getter Pattern**: `DCCActorConfig.document` (lines 38-40)
- **Options Pattern**: `SavingThrowConfig` uses `this.options.document`
- **Direct Pattern**: Some classes access document directly

**Risk**: Could lead to null reference errors or accessing stale data.

### 3. Static Method Binding

**Issue**: Inconsistent binding of action handlers:
- **Correct**: `configureActor: this.#configureActor` (most classes)
- **Incorrect**: `dragDrop: this.#createDragDropHandlers` (returns function instead of binding)

**Risk**: Runtime errors when action handlers execute with wrong context.

### 4. Template Part Configuration

**Issue**: Multiple approaches to template configuration:
- **Static PARTS**: Fixed template definitions
- **Dynamic Parts**: Runtime template selection (`DCCItemSheet`)
- **Class Extension**: `CLASS_PARTS` pattern (`DCCActorSheet` family)
- **Override Pattern**: Complete PARTS replacement (`DCCActorSheetGeneric`)

**Risk**: Template loading failures or rendering inconsistencies.

### 5. Context Preparation Patterns

**Issue**: Different approaches to context data preparation:
- **Async Pattern**: Most dialogs use `async _prepareContext()`
- **Sync Pattern**: `FleetingLuckDialog` uses sync `_prepareContext()`
- **Update Pattern**: Class sheets perform actor updates during context prep
- **Enrichment Pattern**: Inconsistent use of `TextEditor.enrichHTML`

**Risk**: Race conditions, performance issues, or incomplete data rendering.

### 6. TextEditor.enrichHTML Usage Issues

**Issue**: Inconsistent usage patterns for `TextEditor.enrichHTML`:
- **Missing `await`**: `actor-sheet.js` line 367 - `return TextEditor.enrichHTML(this.actor.system.details.notes.value, context)` should be `return await TextEditor.enrichHTML(...)`
- **Namespace Inconsistency**: Mix of `TextEditor.enrichHTML` vs `foundry.applications.ux.TextEditor.enrichHTML` (particularly in `chat.js`)
- **Async Function Compatibility**: Some functions calling `TextEditor.enrichHTML` may not be properly marked as `async`

**Risk**: Missing `await` could cause functions to return Promise objects instead of enriched HTML strings, leading to "[object Promise]" being displayed instead of formatted content.

---

## Recommendations for Resolution

### High Priority Fixes

1. **Fix TextEditor.enrichHTML Issues** ⚠️ **CRITICAL**
   - **IMMEDIATE**: Add missing `await` in `actor-sheet.js` line 367: `return await TextEditor.enrichHTML(...)`
   - Standardize namespace usage (choose either `TextEditor.enrichHTML` or `foundry.applications.ux.TextEditor.enrichHTML`)
   - Ensure all functions calling `TextEditor.enrichHTML` are marked as `async`

2. **Standardize Form Submission**
   - Convert `RollModifierDialog` to use standard form submission pattern
   - Remove custom form processing from `DCCActorSheet` if possible
   - Ensure all config dialogs use consistent document access patterns

3. **Fix Static Method Binding**
   - Review all action configurations for proper method binding
   - ~~Ensure drag/drop handlers use consistent patterns~~ **FIXED**

4. **Standardize Document Access**
   - Implement consistent document getter pattern across all classes
   - Remove direct options.document access

5. **Template Configuration Consistency**
   - Standardize on one approach for dynamic template selection
   - Document the CLASS_PARTS extension pattern properly

### Medium Priority Improvements

1. **Error Handling Standardization**
   - Implement consistent error handling patterns
   - Add proper validation to all form submissions

2. **State Management**
   - Remove direct DOM manipulation from dialogs
   - Use re-rendering instead of manual DOM updates

3. **Performance Optimization**
   - Move actor updates out of context preparation
   - Cache enriched HTML content where appropriate

### Low Priority Cleanup

1. **Code Cleanup**
   - Remove dead code (`_fooBar` method, commented handlers)
   - Standardize method naming conventions
   - Clean up unused imports and variables

2. **Documentation**
   - Document the CLASS_PARTS/CLASS_TABS extension pattern
   - Add JSDoc comments for complex methods
   - Create migration guide for v13 patterns

---

## Recent Updates and Fixes

### Fixes Implemented (June 21, 2025)

1. **Drag/Drop Pattern Fixed** ✅
   - **Issue**: DCCActorSheet drag/drop handlers were using non-standard constructor setup
   - **Resolution**: Clarified that ApplicationV2 in v13 requires manual drag/drop setup, this is the proper pattern
   - **Changed**: `#findDataset` method from private to public static to be accessible from instance methods
   - **Files**: `actor-sheet.js`, `party-sheet.js`

2. **Multi-line Textarea Hack Removed** ✅  
   - **Issue**: System included workaround for multi-line textareas that is no longer needed in v13
   - **Resolution**: Removed unnecessary hack code from `dcc.js`
   - **Benefit**: Cleaner code, relies on native v13 functionality

### Still Outstanding Issues

1. **TextEditor.enrichHTML Missing Await** ❌ **CRITICAL**
   - **File**: `actor-sheet.js` line 367
   - **Issue**: `return TextEditor.enrichHTML(...)` should be `return await TextEditor.enrichHTML(...)`
   - **Impact**: Could cause "[object Promise]" to be displayed instead of enriched HTML

2. **RollModifierDialog Complex Pattern** ❌
   - **Status**: No changes made to the complex promise-based form handling
   - **Impact**: Continues to use non-standard submission patterns

3. **Document Access Inconsistencies** ❌
   - **Status**: Mixed patterns between `this.document` getter and `this.options.document` still exist
   - **Impact**: Potential for null reference errors or stale data access

---

## Testing Requirements

Each identified inconsistency should be tested for:
1. **Functionality**: Does it work as expected?
2. **Error Handling**: What happens when invalid data is provided?
3. **Performance**: Are there any performance regressions?
4. **Integration**: Do different classes work together properly?

## Conclusion

The DCC system's Application classes show a mix of modern v13 patterns and legacy approaches. While most classes function correctly, the inconsistencies identified could lead to maintenance challenges and potential runtime issues. Prioritizing the standardization of form submission, document access, and template configuration patterns would significantly improve code quality and maintainability.
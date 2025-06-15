# Test Coverage Improvement Plan for DCC System

## Executive Summary

This plan outlines a comprehensive strategy to improve test coverage for the Dungeon Crawl Classics (DCC) system for Foundry VTT. The current test suite covers approximately 10% of the codebase with basic functionality tests. This plan provides a phased approach to achieve comprehensive coverage while balancing effort with impact.

## Current State Analysis

### Existing Test Coverage
- **4 test files** covering basic functionality
- **Strong mock foundation** with comprehensive Foundry VTT API mocks
- **Limited scope**: Only covers actor abilities, basic item calculations, and simple parser tests
- **Good architectural foundation** for expansion

### Current Test Files
1. `actor.test.js` - Basic actor ability calculations
2. `item.test.js` - Weapon calculation tests  
3. `npc-parser.test.js` - NPC stat block parsing
4. `pc-parser.test.js` - PC stat block parsing

### Mock Infrastructure
- Comprehensive Foundry VTT API mocks in `__mocks__/foundry.js`
- Roll system mocks in `__mocks__/roll.js` and `__mocks__/dcc-roll.js`
- Template data loading utilities
- Well-structured spy and mock functions

## Testing Strategy

### Unit vs Integration Testing Approach

#### Unit Testing (Preferred for Business Logic)
- **Target**: Pure JavaScript functions with minimal Foundry dependencies
- **Benefits**: Fast execution, easy to maintain, precise error isolation
- **Files**: `dice-chain.js`, `utilities.js`, parser functions, calculation methods

#### Integration Testing (Required for Foundry-dependent Code)  
- **Target**: Classes extending Foundry APIs, UI components, system interactions
- **Benefits**: Tests real-world usage patterns, catches integration issues
- **Files**: `actor.js`, `item.js`, sheet classes, chat handlers

#### Avoiding End-to-End Testing
- **Rationale**: HTML testing without Foundry authentication is not practical
- **Alternative**: Comprehensive integration tests with mocked Foundry APIs
- **Focus**: Test business logic and interactions, not DOM manipulation

## Implementation Plan

### Phase 1: Core Logic Foundation (Priority: HIGH)
*Target: 2-3 weeks*

#### 1.1 Dice Chain System Testing ✅ COMPLETE
- **File**: `module/dice-chain.js`
- **Test Coverage**: 
  - Die face progression algorithms
  - Die ranking and comparison functions
  - Edge cases (d2, d100+, invalid inputs)
  - Critical adjustment calculations
- **Test Type**: Unit tests (minimal Foundry dependency)
- **Status**: Implemented comprehensive test suite with 100% coverage

#### 1.2 Utility Functions Testing ✅ COMPLETE
- **File**: `module/utilities.js`  
- **Test Coverage**:
  - Formatting functions (ability modifiers, dice notation)
  - Table lookup utilities
  - String manipulation helpers
  - Number parsing and validation
- **Test Type**: Unit tests
- **Status**: Implemented comprehensive test suite with 44 test cases covering all utility functions

#### 1.3 DCC Roll System Core ✅ COMPLETE
- **File**: `module/dcc-roll.js`
- **Test Coverage**:
  - Roll formula parsing and cleaning
  - Term processing and validation
  - Roll creation with various options
  - Error handling for malformed formulas
- **Test Type**: Unit tests with enhanced mocks
- **Status**: Implemented comprehensive test suite with 38 test cases covering all core functionality

### Phase 2: Parser Enhancement (Priority: HIGH)
*Target: 2-3 weeks*

#### 2.1 NPC Parser Comprehensive Testing ✅ COMPLETE
- **File**: `module/npc-parser.js`
- **Current State**: Basic tests exist
- **Expansion Completed**:
  - Test all regex patterns with edge cases
  - Multiple stat block formats
  - Malformed input handling
  - Special ability parsing
  - Multi-creature stat blocks
- **Test Data**: Created comprehensive test fixtures
- **Status**: Implemented comprehensive test suite with 604 lines of edge case coverage and enhanced existing tests

#### 2.2 PC Parser Comprehensive Testing  
- **File**: `module/pc-parser.js`
- **Current State**: Basic tests exist
- **Expansion Needed**:
  - Purple Sorcerer JSON format variations
  - Plain text format parsing
  - Partial data handling
  - Class-specific parsing
  - Equipment and spell parsing
- **Test Data**: Real-world character examples

### Phase 3: Core System Integration (Priority: HIGH)
*Target: 3-4 weeks*

#### 3.1 Enhanced Actor Testing
- **File**: `module/actor.js`
- **Current State**: Basic ability tests only
- **Expansion Needed**:
  - All roll types (abilities, saves, initiative, skills)
  - Spell check calculations with different abilities
  - Luck die mechanics and luck reduction
  - Weapon attack rolls with various configurations
  - Level change calculations
  - Data preparation and derived values
  - Error handling and edge cases

#### 3.2 Enhanced Item Testing
- **File**: `module/item.js`  
- **Current State**: Basic weapon calculations
- **Expansion Needed**:
  - All item types (weapons, armor, equipment, spells, treasures)
  - Attack bonus calculations for different weapon types
  - Damage calculations with various modifiers
  - Initiative bonus calculations
  - Spell item interactions
  - Equipment weight and value calculations
  - Data validation and error handling

### Phase 4: Specialized Systems (Priority: MEDIUM)
*Target: 2-3 weeks*

#### 4.1 Spell System Testing
- **File**: `module/spell-result.js`
- **Test Coverage**:
  - Spell check result processing
  - Chat message generation
  - Result table lookups
  - Mercurial magic effects
  - Corruption and patron bond interactions

#### 4.2 Chat System Testing
- **File**: `module/chat.js`
- **Test Coverage**:
  - Critical hit/fumble detection
  - Message highlighting and formatting
  - Roll result processing
  - Chat command handling

#### 4.3 Fleeting Luck System
- **File**: `module/fleeting-luck.js`
- **Test Coverage**:
  - Luck expenditure tracking
  - Roll modification mechanics
  - Flag management and persistence
  - Player notification systems

### Phase 5: UI Integration Testing (Priority: MEDIUM)
*Target: 3-4 weeks*

#### 5.1 Actor Sheet Integration
- **File**: `module/actor-sheet.js`
- **Test Coverage**:
  - Form data handling and validation
  - Event handler functionality
  - Sheet state management
  - Roll button interactions
  - Data synchronization

#### 5.2 Item Sheet Integration  
- **File**: `module/item-sheet.js`
- **Test Coverage**:
  - Item type-specific form handling
  - Data validation and formatting
  - Sheet switching and state persistence

#### 5.3 Roll Modifier Dialogs
- **File**: `module/roll-modifier.js`
- **Test Coverage**:
  - Dialog creation and population
  - Modifier calculation and application
  - Form validation and submission
  - User input handling

### Phase 6: System Integration (Priority: LOW-MEDIUM)
*Target: 2-3 weeks*

#### 6.1 Configuration and Settings
- **Files**: `module/settings.js`, `module/config.js`
- **Test Coverage**:
  - Setting registration and retrieval
  - Configuration validation
  - Default value handling

#### 6.2 Migration System
- **File**: `module/migrations.js`
- **Test Coverage**:
  - Data migration pathways
  - Version compatibility
  - Error handling and rollback
  - Data integrity validation

## Mock Enhancement Strategy

### Current Mock Strengths
- Comprehensive Foundry API coverage
- Well-structured spy system
- Template data loading
- Realistic actor and item construction

### Proposed Mock Enhancements

#### 1. Enhanced Roll Mocking
```javascript
// Current: Basic roll results
// Proposed: Configurable roll outcomes for testing edge cases
global.mockRollResult = (total, dice = [10]) => {
  global.rollEvaluateMock.mockResolvedValueOnce({ total, dice })
}
```

#### 2. UI Event Mocking
```javascript
// New: Mock jQuery events and DOM interactions
global.mockEvent = (type, target, data) => ({
  type, target, data, preventDefault: vi.fn(), stopPropagation: vi.fn()
})
```

#### 3. Foundry Collection Enhancements
```javascript
// Enhanced: More realistic collection behavior
global.mockCollection = (items) => ({
  find: vi.fn(predicate => items.find(predicate)),
  filter: vi.fn(predicate => items.filter(predicate)),
  map: vi.fn(fn => items.map(fn)),
  contents: items
})
```

#### 4. Template Rendering Mocks
```javascript
// New: Template testing utilities
global.mockTemplate = (templatePath, expectedData) => {
  global.renderTemplate.mockImplementation((path, data) => {
    if (path === templatePath) {
      expect(data).toEqual(expectedData)
      return `<rendered>${templatePath}</rendered>`
    }
  })
}
```

## Test Data Strategy

### Fixtures Organization
```
module/__tests__/
├── fixtures/
│   ├── actors/
│   │   ├── level1-warrior.json
│   │   ├── level5-wizard.json
│   │   └── npc-goblin.json
│   ├── items/
│   │   ├── weapons/
│   │   ├── spells/
│   │   └── equipment/
│   ├── stat-blocks/
│   │   ├── npc-samples.txt
│   │   └── formatted-blocks.json
│   └── rolls/
│       ├── spell-check-results.json
│       └── attack-scenarios.json
```

### Test Data Generation
- **Real-world examples**: Extract from actual play sessions
- **Edge cases**: Deliberately crafted problematic data
- **Regression cases**: Data from previously reported bugs
- **Variation testing**: Multiple valid formats for the same data

## Coverage Metrics and Goals

### Current Coverage (Estimated)
- **Overall**: ~10%
- **Core files**: ~15%  
- **Utilities**: ~5%
- **UI components**: ~2%

### Target Coverage by Phase
- **Phase 1**: Core logic ~80%
- **Phase 2**: Parsers ~85%  
- **Phase 3**: Actor/Item ~70%
- **Phase 4**: Specialized systems ~60%
- **Phase 5**: UI integration ~45%
- **Phase 6**: System integration ~55%

### Final Target Coverage
- **Overall**: 65-70%
- **Business logic**: 80-85%
- **UI components**: 40-50%
- **Configuration**: 60-65%

## Testing Tools and Configuration

### Current Stack
- **Vitest**: Fast unit testing framework
- **vi**: Mocking and spy utilities  
- **JSON fixtures**: Test data management

### Proposed Enhancements
- **Coverage reporting**: Istanbul/c8 integration
- **Performance testing**: Benchmark critical calculations
- **Visual regression**: Consider for complex UI (if feasible)
- **Mutation testing**: Validate test quality

### Test Runner Configuration
```javascript
// vitest.config.js enhancements
export default defineConfig({
  test: {
    coverage: {
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: { lines: 65, functions: 70, branches: 60 }
      }
    },
    testTimeout: 10000, // Longer for integration tests
    setupFiles: ['./module/__tests__/setup.js']
  }
})
```

## Development Workflow Integration

### Pre-commit Hooks
- Run unit tests on changed files
- Coverage threshold validation
- Linting and formatting checks

### CI/CD Integration
- Full test suite on PR creation
- Coverage reporting in PR comments
- Performance regression detection

### Development Guidelines
- **Test-driven development** for new features
- **Bug fix tests**: Every bug fix includes regression test
- **Refactoring safety**: Maintain test coverage during refactoring

## Alternative Approaches for HTML Testing

Since direct HTML testing requires Foundry authentication, consider these alternatives:

### 1. Headless Component Testing
- Extract UI logic into testable functions
- Mock DOM interactions
- Test data flow and event handling logic

### 2. Screenshot/Visual Testing (Limited Scope)
- Use existing Playwright setup for critical UI flows
- Focus on regression detection rather than comprehensive coverage
- Maintain baseline images for major UI components

### 3. Storybook Integration (Future Consideration)
- Isolate UI components for testing
- Create component variations and test scenarios
- Enable visual testing without full Foundry context

## Risk Assessment and Mitigation

### High-Risk Areas
1. **Complex roll calculations** - Critical for game functionality
2. **Character sheet interactions** - User-facing and complex
3. **Parser reliability** - Data import accuracy
4. **Spell system mechanics** - Complex business rules

### Mitigation Strategies
- Comprehensive unit tests for calculations
- Real-world data fixtures for parsers
- Integration tests for critical user workflows
- Performance testing for complex operations

### Maintenance Considerations
- **Mock maintenance**: Keep mocks synchronized with Foundry updates
- **Test data updates**: Refresh fixtures with new game content
- **Performance monitoring**: Track test execution time
- **Documentation**: Maintain testing guidelines and examples

## Success Metrics

### Quantitative Goals
- 65-70% overall code coverage
- 80%+ coverage for business logic
- Test execution time under 30 seconds
- Zero critical bugs in tested code paths

### Qualitative Goals
- Improved developer confidence in changes
- Faster debugging and issue resolution
- Better code documentation through tests
- Reduced manual testing effort

### Monitoring and Reporting
- Weekly coverage reports
- Performance trend analysis
- Bug correlation with test coverage
- Developer satisfaction surveys

## Conclusion

This comprehensive testing strategy balances thorough coverage with practical implementation constraints. By focusing on business logic first and building comprehensive mocks, we can achieve significant quality improvements without requiring full Foundry VTT integration for every test.

The phased approach allows for incremental progress and early wins while building toward comprehensive coverage. The emphasis on unit testing for pure logic and integration testing for Foundry-dependent code provides the best balance of speed, maintainability, and confidence.

Success in this initiative will significantly improve code quality, reduce bugs, and increase developer productivity for the DCC system.
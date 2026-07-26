import { describe, test, expect } from 'vitest'
import '../__mocks__/foundry.js'
import { _normalizeItemName, _itemTypesCompatible } from '../parser.js'
import { actorImporterNameMap } from '../config/actor-importer.mjs'

// Item remap matching for the actor importer (#817). Purple Sorcerer equipment
// names drifted from the dcc-core-book pack names (hyphens vs commas, straight
// vs curly apostrophes, appended prices), and containers could never match
// because the importer creates all goods as generic 'equipment' items. These
// tests pin the normalization + type-compatibility contract the remap loop in
// createActors relies on.

describe('_normalizeItemName', () => {
  // Real Purple Sorcerer output (left) vs real dcc-core-book pack names (right)
  test.each([
    ["Rope - 50'", 'Rope, 50’'],
    ["Chain 10'", 'Chain, 10’'],
    ['Pole - 10-foot', 'Pole, 10-foot'],
    ['Sack (large)', 'Sack, large'],
    ['Sack (small)', 'Sack, small'],
    ['Chalk - 1 piece', 'Chalk, 1 piece'],
    ['Holy water (1 vial)', 'Holy water, 1 vial**'],
    ['Oil (1 flask)', 'Oil, 1 flask***'],
    ["Thieves' tools", 'Thieves’ tools'],
    ['Backpack', 'Backpack'],
    ['Candle', 'Candle']
  ])('matches Purple Sorcerer "%s" to pack name "%s"', (psName, packName) => {
    expect(_normalizeItemName(psName)).toBe(_normalizeItemName(packName))
  })

  test('does not conflate distinct items', () => {
    expect(_normalizeItemName('Sack, large')).not.toBe(_normalizeItemName('Sack, small'))
    expect(_normalizeItemName('Rations (1 day)')).not.toBe(_normalizeItemName('Torch, each'))
  })

  test('name-map targets that normalization cannot bridge resolve via the map', () => {
    // 'Rations (1 day)' vs 'Rations, per day' and 'Water skin' vs 'Waterskin'
    // are true renames — check the map entries exist and point at the pack names
    expect(actorImporterNameMap['Rations (1 day)']).toEqual(['Rations, per day'])
    expect(actorImporterNameMap['Water skin']).toEqual(['Waterskin'])
  })
})

describe('_itemTypesCompatible', () => {
  test('exact type matches are compatible', () => {
    expect(_itemTypesCompatible('weapon', 'weapon')).toBe(true)
    expect(_itemTypesCompatible('equipment', 'equipment')).toBe(true)
    expect(_itemTypesCompatible('container', 'container')).toBe(true)
  })

  test('generic equipment matches containers and ammunition', () => {
    // The importer cannot tell a backpack is a container from the stat block
    expect(_itemTypesCompatible('container', 'equipment')).toBe(true)
    expect(_itemTypesCompatible('ammunition', 'equipment')).toBe(true)
  })

  test('other cross-type matches are rejected', () => {
    expect(_itemTypesCompatible('weapon', 'equipment')).toBe(false)
    expect(_itemTypesCompatible('spell', 'equipment')).toBe(false)
    expect(_itemTypesCompatible('equipment', 'container')).toBe(false)
    expect(_itemTypesCompatible('equipment', 'weapon')).toBe(false)
  })
})

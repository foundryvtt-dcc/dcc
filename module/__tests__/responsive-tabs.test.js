/**
 * Unit coverage for module/responsive-tabs.mjs. The overflow measurement
 * itself needs a live layout engine (covered by the Playwright suite); these
 * tests pin the wiring contract: absent or incomplete responsive-tab markup
 * returns null without touching the DOM.
 */

import { describe, expect, test } from 'vitest'

import { setupResponsiveTabs } from '../responsive-tabs.mjs'

const elementWith = (selectors) => ({
  querySelector: (sel) => (selectors.includes(sel) ? { querySelector: () => null } : null)
})

describe('setupResponsiveTabs', () => {
  test('returns null for a null element', () => {
    expect(setupResponsiveTabs(null)).toBeNull()
  })

  test('returns null when the sheet has no responsive tab nav', () => {
    expect(setupResponsiveTabs(elementWith([]))).toBeNull()
  })

  test('returns null when the nav lacks the container/overflow markup', () => {
    const nav = { querySelector: () => null }
    const element = { querySelector: (sel) => (sel === '.sheet-tabs.responsive-tabs' ? nav : null) }
    expect(setupResponsiveTabs(element)).toBeNull()
  })
})

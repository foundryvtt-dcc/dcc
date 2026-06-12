import { describe, expect, it } from 'vitest'
import '../__mocks__/foundry.js'
import { lookupCriticalRoll } from '../chat.js'

/**
 * Minimal stand-in for the rendered chat message HTML element.
 * Mirrors the two queries lookupCriticalRoll performs: finding an
 * existing .crit-result container and finding .message-content.
 */
function makeHtml (initialContent = '') {
  const messageContent = { innerHTML: initialContent }
  return {
    messageContent,
    querySelector (selector) {
      if (selector === '.message-content') return messageContent
      if (selector === '.crit-result') {
        return messageContent.innerHTML.includes('crit-result') ? {} : null
      }
      return null
    }
  }
}

function makeCritMessage () {
  return {
    rolls: [{ total: 6 }],
    isContentVisible: true,
    flavor: 'Crit Die',
    getFlag: () => undefined,
    system: {
      critResult: 'Foe dazed by ferocious attack',
      critRollTotal: 6,
      critTableName: 'II'
    }
  }
}

describe('lookupCriticalRoll', () => {
  it('appends a navigable crit result using the stored system data', async () => {
    const html = makeHtml('<span>roll</span>')

    await lookupCriticalRoll(makeCritMessage(), html)

    expect(html.messageContent.innerHTML).toContain('Foe dazed by ferocious attack')
    expect(html.messageContent.innerHTML.match(/crit-result/g)).toHaveLength(1)
  })

  it('does not append a second result when one is already rendered (#744)', async () => {
    const html = makeHtml('<span>roll</span>')

    // First render (e.g. emoteCritRoll already embedded the crit result)
    await lookupCriticalRoll(makeCritMessage(), html)
    const renderedOnce = html.messageContent.innerHTML

    // Second pass over the same HTML must be a no-op
    await lookupCriticalRoll(makeCritMessage(), html)

    expect(html.messageContent.innerHTML).toBe(renderedOnce)
    expect(html.messageContent.innerHTML.match(/crit-result/g)).toHaveLength(1)
  })

  it('skips attack rolls flagged isToHit', async () => {
    const message = makeCritMessage()
    message.getFlag = (scope, flag) => flag === 'isToHit'
    const html = makeHtml('<span>roll</span>')

    await lookupCriticalRoll(message, html)

    expect(html.messageContent.innerHTML).toBe('<span>roll</span>')
  })
})

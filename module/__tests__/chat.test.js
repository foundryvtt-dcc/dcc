import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../__mocks__/foundry.js'

vi.mock('../utilities.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, getCritTableResult: vi.fn() }
})

const { lookupCriticalRoll } = await import('../chat.js')
const { getCritTableResult } = await import('../utilities.js')

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
  beforeEach(() => {
    getCritTableResult.mockReset()
  })

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

  it('looks up the crit table when no stored result is present', async () => {
    getCritTableResult.mockResolvedValue({ description: 'Mighty blow to the skull' })
    const message = makeCritMessage()
    message.system = { critTableName: 'II' }
    const html = makeHtml('<span>roll</span>')

    await lookupCriticalRoll(message, html)

    expect(getCritTableResult).toHaveBeenCalledWith(message.rolls[0], expect.stringContaining('II'))
    expect(html.messageContent.innerHTML).toContain('Mighty blow to the skull')
    expect(html.messageContent.innerHTML.match(/crit-result/g)).toHaveLength(1)
  })

  it('appends the manual-lookup hint when the crit table has no result', async () => {
    getCritTableResult.mockResolvedValue(null)
    const message = makeCritMessage()
    message.system = { critTableName: 'II' }
    const html = makeHtml('<span>roll</span>')

    await lookupCriticalRoll(message, html)

    expect(html.messageContent.innerHTML).toContain('crit-lookup-hint')
    expect(html.messageContent.innerHTML).not.toContain('crit-result')
  })

  it('skips attack rolls flagged isToHit', async () => {
    const message = makeCritMessage()
    message.getFlag = (scope, flag) => flag === 'isToHit'
    const html = makeHtml('<span>roll</span>')

    await lookupCriticalRoll(message, html)

    expect(html.messageContent.innerHTML).toBe('<span>roll</span>')
  })
})

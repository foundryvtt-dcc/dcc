import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../__mocks__/foundry.js'

vi.mock('../utilities.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, getCritTableResult: vi.fn() }
})

const { lookupCriticalRoll, buildMightyDeedPrompt, attachMightyDeedListeners } = await import('../chat.js')
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

describe('buildMightyDeedPrompt', () => {
  it('returns empty string when the message has no deed tables', () => {
    expect(buildMightyDeedPrompt({ system: {} })).toBe('')
    expect(buildMightyDeedPrompt({ system: { deedTables: [] } })).toBe('')
    expect(buildMightyDeedPrompt(undefined)).toBe('')
  })

  it('renders a self-describing prompt with an option per deed table', () => {
    const message = {
      system: {
        deedDieRollResult: 4,
        deedTables: [
          { name: 'Deeds of Arms', path: 'world.deeds-of-arms' },
          { name: 'Deeds II', path: 'dcc.tables.Deeds II' }
        ]
      }
    }

    const html = buildMightyDeedPrompt(message)

    // The deed roll travels on the container so the click handler is self-contained
    expect(html).toContain('data-deed-roll="4"')
    expect(html).toContain('class="deed-table-prompt"')
    expect(html).toContain('<button type="button" class="roll-deed-table"')
    // One <option> per configured table, carrying its lookup path
    expect(html).toContain('<option value="world.deeds-of-arms">Deeds of Arms</option>')
    expect(html).toContain('<option value="dcc.tables.Deeds II">Deeds II</option>')
  })
})

describe('attachMightyDeedListeners', () => {
  // Minimal DOM stand-in: a container holding fake .roll-deed-table buttons,
  // each tracking how many click listeners were attached.
  function makeButton () {
    return {
      dataset: {},
      listeners: 0,
      addEventListener (type) {
        if (type === 'click') this.listeners++
      }
    }
  }

  function makeCardElement (buttons) {
    return {
      querySelectorAll (selector) {
        return selector === '.roll-deed-table' ? buttons : []
      }
    }
  }

  it('attaches a click handler to each deed-roll button', () => {
    const buttons = [makeButton(), makeButton()]
    attachMightyDeedListeners({}, makeCardElement(buttons))

    expect(buttons[0].listeners).toBe(1)
    expect(buttons[1].listeners).toBe(1)
    expect(buttons[0].dataset.deedListenerAttached).toBe('true')
  })

  it('is idempotent — a second call does not double-bind the same button (#319)', () => {
    const buttons = [makeButton()]
    const card = makeCardElement(buttons)

    // Both the system render hook and a card-replacing module (dcc-qol) may
    // call this on the same DOM; the guard must prevent a double roll.
    attachMightyDeedListeners({}, card)
    attachMightyDeedListeners({}, card)

    expect(buttons[0].listeners).toBe(1)
  })
})

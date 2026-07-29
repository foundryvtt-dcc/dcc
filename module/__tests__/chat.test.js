import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../__mocks__/foundry.js'

vi.mock('../utilities.js', async (importOriginal) => {
  const actual = await importOriginal()
  // getTableFromPath → null keeps the fire-and-forget inline deed render from
  // reaching `document` in this node-env test (the DOM path is covered E2E).
  return { ...actual, getCritTableResult: vi.fn(), getTableFromPath: vi.fn(async () => null) }
})

const { lookupCriticalRoll, buildMightyDeedPrompt, attachMightyDeedListeners, addChatMessageContextOptions } = await import('../chat.js')
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

  it('renders a self-describing picker with a "Choose Deed" placeholder and an option per table', () => {
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

    // The deed roll travels on the container so the lookup is self-contained
    expect(html).toContain('data-deed-roll="4"')
    expect(html).toContain('class="deed-table-prompt"')
    // Picking a table is a lookup, not a roll — no button
    expect(html).not.toContain('roll-deed-table')
    expect(html).not.toContain('<button')
    // Nothing pre-selected: a disabled placeholder leads the list
    expect(html).toContain('<option value="" disabled selected>')
    // The select carries an accessible name and a form-field name (issue #820)
    expect(html).toContain('name="deed-table"')
    expect(html).toContain('aria-label=')
    // One <option> per configured table, carrying its lookup path
    expect(html).toContain('<option value="world.deeds-of-arms">Deeds of Arms</option>')
    expect(html).toContain('<option value="dcc.tables.Deeds II">Deeds II</option>')
  })
})

describe('attachMightyDeedListeners', () => {
  // Minimal DOM stand-ins. The prompt holds a <select> whose value starts on
  // the empty placeholder; getTableFromPath is mocked to null so the
  // fire-and-forget inline render bails before touching `document`.
  function makeSelect (options = []) {
    return {
      value: '',
      disabled: false,
      options,
      changeListeners: 0,
      addEventListener (type) { if (type === 'change') this.changeListeners++ }
    }
  }

  function makePrompt (select) {
    return {
      dataset: {},
      nextElementSibling: null,
      getAttribute: (name) => (name === 'data-deed-roll' ? '4' : null),
      querySelector: (sel) => (sel === '.deed-table-select' ? select : null)
    }
  }

  function makeCard (prompts) {
    return {
      querySelectorAll: (sel) => (sel === '.deed-table-prompt' ? prompts : [])
    }
  }

  it('wires a change listener and marks the prompt when the user may edit', () => {
    const select = makeSelect([{ value: 'world.t' }])
    const prompt = makePrompt(select)
    const message = { isAuthor: true, getFlag: () => undefined }

    attachMightyDeedListeners(message, makeCard([prompt]))

    expect(select.changeListeners).toBe(1)
    expect(select.disabled).toBe(false)
    expect(prompt.dataset.deedListenerAttached).toBe('true')
  })

  it('disables the picker for a viewer who is neither author nor GM', () => {
    const select = makeSelect()
    const prompt = makePrompt(select)
    const message = { isAuthor: false, getFlag: () => undefined }

    attachMightyDeedListeners(message, makeCard([prompt]))

    expect(select.disabled).toBe(true)
    expect(select.changeListeners).toBe(0)
  })

  it('reflects a persisted table choice onto the picker', () => {
    const select = makeSelect([{ value: 'world.t' }, { value: 'world.u' }])
    const prompt = makePrompt(select)
    const message = { isAuthor: true, getFlag: (scope, key) => (key === 'deedSelectedTable' ? 'world.u' : undefined) }

    attachMightyDeedListeners(message, makeCard([prompt]))

    expect(select.value).toBe('world.u')
  })

  it('is idempotent — a second call does not double-bind the same prompt (#319)', () => {
    const select = makeSelect([{ value: 'world.t' }])
    const prompt = makePrompt(select)
    const card = makeCard([prompt])
    const message = { isAuthor: true, getFlag: () => undefined }

    // Both the system render hook and a card-replacing module (dcc-qol) may
    // call this on the same DOM; the guard must prevent double-wiring.
    attachMightyDeedListeners(message, card)
    attachMightyDeedListeners(message, card)

    expect(select.changeListeners).toBe(1)
  })
})

describe('addChatMessageContextOptions (chat card context menu, issue #828)', () => {
  // The v14 ContextMenu passes a plain HTMLElement to visible/onClick — these
  // stubs model `li` with just the queries the entries perform.
  const makeLi = ({ damage = null, diceTotal = null } = {}) => ({
    querySelector: (sel) => {
      if (sel === '.damage-applyable' && damage !== null) {
        return { getAttribute: (attr) => (attr === 'data-damage' ? damage : null) }
      }
      if (sel === '.dice-total' && diceTotal !== null) {
        return { textContent: diceTotal }
      }
      return null
    },
    closest: () => null
  })

  let damageEntry
  let healingEntry
  let applyDamage

  beforeEach(() => {
    applyDamage = vi.fn(async () => {})
    globalThis.canvas = { tokens: { controlled: [{ actor: { applyDamage } }] } }
    globalThis.game = {
      messages: { get: vi.fn() },
      i18n: { localize: (key) => key }
    }
    globalThis.ui = { notifications: { warn: vi.fn() } }
    const options = addChatMessageContextOptions({}, [])
    damageEntry = options[0]
    healingEntry = options[1]
  })

  it('pushes two v14-shaped entries (label/visible/onClick, class-name icon)', () => {
    expect(damageEntry.label).toBe('DCC.ChatContextDamage')
    expect(healingEntry.label).toBe('DCC.ChatContextHealing')
    for (const entry of [damageEntry, healingEntry]) {
      expect(entry.icon).not.toMatch(/</) // class name string, not an <i> HTML string
      expect(typeof entry.visible).toBe('function')
      expect(typeof entry.onClick).toBe('function')
      expect(entry.name).toBeUndefined()
      expect(entry.condition).toBeUndefined()
      expect(entry.callback).toBeUndefined()
    }
  })

  it('visible when a token is controlled and the card has an applyable amount', () => {
    expect(damageEntry.visible(makeLi({ damage: '5' }))).toBe(true)
    expect(damageEntry.visible(makeLi({ diceTotal: '7' }))).toBe(true)
  })

  it('not visible when no tokens are controlled', () => {
    globalThis.canvas.tokens.controlled = []
    expect(damageEntry.visible(makeLi({ damage: '5' }))).toBe(false)
  })

  it('not visible when the card has neither a damage-applyable nor a dice total', () => {
    expect(damageEntry.visible(makeLi())).toBeFalsy()
  })

  it('onClick applies the damage-applyable amount to each controlled token actor', async () => {
    await damageEntry.onClick(new Event('click'), makeLi({ damage: '5' }))
    expect(applyDamage).toHaveBeenCalledWith('5', 1)
  })

  it('healing onClick applies the amount with a -1 multiplier', async () => {
    await healingEntry.onClick(new Event('click'), makeLi({ damage: '3' }))
    expect(applyDamage).toHaveBeenCalledWith('3', -1)
  })

  it('onClick falls back to the dice total for plain rolls', async () => {
    await damageEntry.onClick(new Event('click'), makeLi({ diceTotal: '7' }))
    expect(applyDamage).toHaveBeenCalledWith('7', 1)
  })

  it('onClick warns instead of applying when no amount can be found', async () => {
    await damageEntry.onClick(new Event('click'), makeLi())
    expect(applyDamage).not.toHaveBeenCalled()
    expect(globalThis.ui.notifications.warn).toHaveBeenCalled()
  })
})

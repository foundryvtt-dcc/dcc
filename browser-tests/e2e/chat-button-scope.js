/* eslint-disable no-undef -- Browser globals used in page.evaluate */
// Page-side comparator shared by the live matrix and isolated transition probe.
function compareChatButtonScope (specimens) {
  const root = s => s.domId ? document.getElementById(s.domId) : document.querySelector(`#chat [data-message-id="${s.id}"] .message-content`)
  const read = s => [...root(s).querySelectorAll(s.selector)].map(el => {
    const cs = getComputedStyle(el)
    return {
      label: el.textContent.trim(),
      tag: el.tagName,
      color: cs.color,
      background: cs.backgroundColor,
      backgroundImage: cs.backgroundImage,
      border: `${cs.borderTopStyle} ${cs.borderTopWidth} ${cs.borderTopColor}`,
      opacity: cs.opacity,
      disabled: el.matches(':disabled'),
      classDisabled: el.classList.contains('disabled')
    }
  })
  const targets = specimens.filter(s => /^(enhanced|death)-/.test(s.name))
  const controls = specimens.filter(s => !targets.includes(s) && !s.name.startsWith('inactive-'))
  const controlElements = controls.flatMap(s => [...root(s).querySelectorAll(s.selector)])
  const inline = controlElements.map(el => [el, el.getAttribute('style')])
  const buttons = targets.flatMap(s => [...root(s).querySelectorAll(s.selector)])
  const saved = []
  let mutationCount = 0
  // Resolve native CSS nesting, retaining enclosing layer context. Matching
  // targets catches accidentally broad rules, not only known class selectors.
  const visit = (rules, parent = '') => {
    for (const rule of rules) {
      let selector = parent
      if (rule.selectorText) {
        // Let Chrome parse lists, including commas inside :is()/attributes.
        const own = rule.selectorText
        selector = parent ? (own.includes('&') ? own.replaceAll('&', `:is(${parent})`) : `:is(${parent}) :is(${own})`) : own
        if (buttons.some(el => el.matches(selector))) {
          const props = [...rule.style].filter(p => /^(color|background-color|background-image|border(?:-(top|right|bottom|left))?-color)$/.test(p) || /^--button-(?:hover-)?(text|background|border)-color$/.test(p))
          if (props.length) {
            saved.push([rule.style, rule.style.cssText])
            mutationCount += props.length
            for (const p of props) rule.style.removeProperty(p)
          }
        }
      }
      if (rule.cssRules) visit(rule.cssRules, selector)
    }
  }
  let enabled, disabled
  try {
    // Core buttons animate paint for 0.5s (release notes for 0.2s). Freeze
    // controls before the baseline: its computed-style flush also finishes any
    // transition already running, without a sleep or altering hover/focus tests.
    for (const el of controlElements) el.style.setProperty('transition', 'none', 'important')
    enabled = Object.fromEntries(controls.map(s => [s.name, read(s)]))
    const visitSheet = sheet => {
      if (sheet.href?.includes('/systems/dcc/')) visit(sheet.cssRules)
      else {
        for (const rule of sheet.cssRules) {
          if (rule.styleSheet) visitSheet(rule.styleSheet)
        }
      }
    }
    for (const sheet of document.styleSheets) visitSheet(sheet)
    disabled = Object.fromEntries(controls.map(s => [s.name, read(s)]))
  } finally {
    try {
      for (const [style, cssText] of saved.reverse()) style.cssText = cssText
      // Commit restored paint while transitions are still off, so re-enabling
      // them does not animate from the temporary disabled-rule measurement.
      for (const el of controlElements) getComputedStyle(el).getPropertyValue('color')
    } finally {
      // Preserve shorthand/longhand declarations, priorities, and absent attrs.
      for (const [el, style] of inline) {
        if (style === null) el.removeAttribute('style')
        else el.setAttribute('style', style)
      }
    }
  }
  return { enabled, disabled, mutationCount, targets: Object.fromEntries(targets.map(s => [s.name, read(s)])) }
}

module.exports = { compareChatButtonScope }

/* global document, ResizeObserver */

/**
 * Responsive sheet-tab navigation shared by the actor and item sheets.
 *
 * Measures which tabs fit the nav's width, tucks the rest into an ellipsis
 * dropdown, and keeps the split correct as the sheet resizes. Works with the
 * `.sheet-tabs.responsive-tabs` markup (a `.tabs-container` of tab anchors
 * plus a `.tabs-overflow` button/menu) rendered by the sheet tab partials.
 */

/**
 * Wire up responsive tab overflow handling for a sheet.
 * @param {HTMLElement} element - The sheet's root element.
 * @returns {(() => void)|null} A cleanup function that disconnects the resize
 *   observer and document listener, or null when the element has no
 *   responsive tab nav.
 */
export function setupResponsiveTabs (element) {
  const nav = element?.querySelector('.sheet-tabs.responsive-tabs')
  if (!nav) return null

  const tabsContainer = nav.querySelector('.tabs-container')
  const overflowContainer = nav.querySelector('.tabs-overflow')
  const overflowButton = nav.querySelector('.tabs-overflow-button')
  const overflowMenu = nav.querySelector('.tabs-overflow-menu')

  if (!tabsContainer || !overflowContainer || !overflowMenu) return null

  // Store original tab elements for reference
  const allTabs = Array.from(tabsContainer.querySelectorAll('a[data-tab]'))

  /**
   * Calculate which tabs fit and update the overflow menu
   */
  const updateOverflowTabs = () => {
    // Reset all tabs to visible
    allTabs.forEach(tab => tab.classList.remove('tab-hidden'))
    overflowMenu.innerHTML = ''

    // Get available width (container width minus overflow button width)
    const containerWidth = tabsContainer.offsetWidth
    const overflowButtonWidth = 40 // Approximate width for the overflow button

    let usedWidth = 0
    const overflowTabs = []

    // Determine which tabs fit
    for (const tab of allTabs) {
      // Temporarily show tab to measure
      tab.classList.remove('tab-hidden')
      const tabWidth = tab.offsetWidth

      if (usedWidth + tabWidth + overflowButtonWidth > containerWidth && overflowTabs.length === 0 && usedWidth > 0) {
        // This tab and all following go to overflow
        tab.classList.add('tab-hidden')
        overflowTabs.push(tab)
      } else if (overflowTabs.length > 0) {
        // Already in overflow mode
        tab.classList.add('tab-hidden')
        overflowTabs.push(tab)
      } else {
        usedWidth += tabWidth
      }
    }

    // Update overflow container visibility
    if (overflowTabs.length > 0) {
      overflowContainer.classList.add('has-overflow')

      // Populate overflow menu
      for (const tab of overflowTabs) {
        const menuItem = document.createElement('a')
        menuItem.dataset.action = 'tab'
        menuItem.dataset.group = tab.dataset.group
        menuItem.dataset.tab = tab.dataset.tab
        menuItem.dataset.tooltip = tab.dataset.tooltip
        menuItem.className = tab.className.replace('tab-hidden', '').trim()
        menuItem.textContent = tab.textContent

        // Handle click to switch tab
        menuItem.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          // Trigger the original tab
          tab.click()
          // Close menu
          overflowMenu.classList.remove('open')
        })

        overflowMenu.appendChild(menuItem)
      }
    } else {
      overflowContainer.classList.remove('has-overflow')
    }
  }

  // Toggle overflow menu on button click
  overflowButton?.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    overflowMenu.classList.toggle('open')
  })

  // Close menu when clicking outside
  const onDocumentClick = (event) => {
    if (!overflowContainer.contains(event.target)) {
      overflowMenu.classList.remove('open')
    }
  }
  document.addEventListener('click', onDocumentClick)

  // Set up ResizeObserver to handle window resize
  const resizeObserver = new ResizeObserver(() => {
    updateOverflowTabs()
  })
  resizeObserver.observe(tabsContainer)

  // Initial calculation
  updateOverflowTabs()

  return () => {
    resizeObserver.disconnect()
    document.removeEventListener('click', onDocumentClick)
  }
}

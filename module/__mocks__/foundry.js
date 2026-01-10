/* global foundry */
// noinspection JSUnusedLocalSymbols

import { vi } from 'vitest'
import DCC from '../config.js'
import DCCRoll from './dcc-roll.js'

// console.log('Loading Foundry Mocks')

/**
 * FormApplication - Legacy v1 form application base class
 */
class FormApplicationMock {}

global.FormApplication = FormApplicationMock

/**
 * ApplicationV2 - Base class for all v2 applications in Foundry
 * The Application class is responsible for rendering an HTMLElement into the Foundry VTT user interface.
 * Provides core functionality including:
 * - Render state management (NONE, RENDERING, RENDERED, CLOSING, CLOSED, ERROR)
 * - Window framing and positioning
 * - Event handling and lifecycle management
 * - Tab system for multi-panel interfaces
 * - Action system for declarative event handling
 * - Form handling with validation
 */
class ApplicationV2Mock {
  constructor (options = {}) {
    this.options = {
      id: 'app-{id}',
      classes: [],
      tag: 'div',
      window: {
        frame: true,
        positioned: true,
        title: '',
        icon: '',
        controls: [],
        minimizable: true,
        resizable: false,
        contentTag: 'section',
        contentClasses: []
      },
      actions: {},
      form: {
        handler: undefined,
        submitOnChange: false,
        closeOnSubmit: false
      },
      position: {
        width: 'auto',
        height: 'auto'
      },
      ...options
    }

    this.position = { ...this.options.position }
    this.rendered = false
    this.element = null
    this.window = null // Window controls and frame elements
  }

  // Render states enum - describes application lifecycle
  static RENDER_STATES = {
    ERROR: -3,
    CLOSING: -2,
    CLOSED: -1,
    NONE: 0,
    RENDERING: 1,
    RENDERED: 2
  }

  // Default configuration options for all ApplicationV2 instances
  static DEFAULT_OPTIONS = {
    id: 'app-{id}',
    classes: [],
    tag: 'div',
    window: {
      frame: true,
      positioned: true,
      title: '',
      controls: [],
      minimizable: true,
      resizable: false
    },
    actions: {},
    form: {},
    position: { width: 'auto', height: 'auto' }
  }

  // Tab configuration - defines multi-panel interfaces
  static TABS = {}

  // Core render method - displays the application
  async render (options = {}) {
    // In real Foundry: manages render states, calls lifecycle methods
    // _canRender -> _prepareContext -> _renderHTML -> _onRender
    this.rendered = true
    return this
  }

  // Render permission check - determines if application can be displayed
  _canRender (options) {
    // Override to add custom render restrictions
    return true
  }

  // Context preparation - prepares data for template rendering
  async _prepareContext (options) {
    // Override to provide template data
    return {}
  }

  // HTML rendering - generates application markup
  async _renderHTML (context, options) {
    // Override to provide custom HTML generation
    return '<div>Mock Application</div>'
  }

  // First render lifecycle - called only on initial render
  async _onFirstRender (context, options) {
    // Override for one-time setup after first render
  }

  // Render lifecycle - called after every render
  async _onRender (context, options) {
    // Override for post-render setup (event listeners, etc.)
  }

  // Close application
  async close (options = {}) {
    this.rendered = false
    this._onClose(options)
    return this
  }

  // Close lifecycle - cleanup when application closes
  _onClose (options) {
    // Override for cleanup
  }

  // Header controls generation - returns array of control buttons
  _getHeaderControls () {
    return this.options.window.controls || []
  }

  // Tab configuration retrieval - returns tab setup for a group
  _getTabsConfig (group) {
    return this.constructor.TABS[group] || { tabs: [], initial: null }
  }

  // Position management
  setPosition (position = {}) {
    Object.assign(this.position, position)
    return this.position
  }
}

global.ApplicationV2 = ApplicationV2Mock

/**
 * DialogV2 - Modal dialog application extending ApplicationV2
 * Provides a standardized modal dialog system with:
 * - Button-based user interaction with callbacks
 * - Form submission handling
 * - Modal/non-modal display modes
 * - Keyboard navigation (Enter/Escape handling)
 * - Factory methods for common dialog types (confirm, prompt, input)
 * - Promise-based async interaction patterns
 * - User query system for cross-user dialog requests
 */
class DialogV2Mock extends ApplicationV2Mock {
  constructor (options = {}) {
    super({
      id: 'dialog-{id}',
      classes: ['dialog'],
      tag: 'dialog', // Uses HTML <dialog> element
      form: {
        closeOnSubmit: true // Dialogs typically close after submission
      },
      window: {
        frame: true,
        positioned: true,
        minimizable: false // Dialogs are not minimizable
      },
      ...options
    })

    // Validate required configuration
    if (!this.options.buttons?.length) {
      throw new Error('You must define at least one entry in config.buttons')
    }

    // Process button configuration and set up actions
    this.options.buttons = this._processButtons(this.options.buttons)
  }

  // Default configuration for DialogV2 instances
  static DEFAULT_OPTIONS = {
    id: 'dialog-{id}',
    classes: ['dialog'],
    tag: 'dialog',
    form: { closeOnSubmit: true },
    window: { frame: true, positioned: true, minimizable: false }
  }

  // Process button array into button object with action mapping
  _processButtons (buttons) {
    const processedButtons = {}

    for (const button of buttons) {
      // Register button action handler
      this.options.actions[button.action] = this.constructor._onClickButton
      processedButtons[button.action] = button
    }

    return processedButtons
  }

  // HTML rendering - creates dialog form with content and buttons
  async _renderHTML (context, options) {
    // In real Foundry: creates form element with dialog-content and form-footer
    const content = this.options.content || ''
    const buttons = this._renderButtons()

    return `
      <form class="dialog-form standard-form" autocomplete="off">
        ${content ? `<div class="dialog-content standard-form">${content}</div>` : ''}
        <footer class="form-footer">${buttons}</footer>
      </form>
    `
  }

  // Button rendering - generates HTML for all configured buttons
  _renderButtons () {
    const buttons = Object.values(this.options.buttons)

    return buttons.map((buttonOptions, i) => {
      const {
        action,
        label,
        icon,
        class: cls = '',
        style = {},
        type = 'submit',
        disabled
      } = buttonOptions

      // Determine default button (first button or explicitly marked)
      const isDefault = !!buttonOptions.default || ((i === 0) && !buttons.some(b => b.default))

      // Build button HTML with proper attributes
      let buttonHtml = `<button type="${type}" data-action="${action}" class="${cls}"`

      // Add styling
      const styleEntries = Object.entries(style)
      if (styleEntries.length) {
        const styleString = styleEntries.map(([key, value]) => `${key}: ${value}`).join('; ')
        buttonHtml += ` style="${styleString}"`
      }

      // Add attributes
      if (disabled) buttonHtml += ' disabled'
      if (isDefault) buttonHtml += ' autofocus'

      buttonHtml += '>'

      // Add icon if specified
      if (icon) {
        buttonHtml += `<i class="${icon}"></i>`
      }

      // Add label
      buttonHtml += `<span>${label}</span></button>`

      return buttonHtml
    }).join('')
  }

  // First render lifecycle - shows dialog as modal or non-modal
  async _onFirstRender (context, options) {
    // In real Foundry: calls this.element.showModal() or this.element.show()
    if (this.options.modal) {
      // Modal dialog - blocks interaction with other elements
      console.log('Dialog shown as modal')
    } else {
      // Non-modal dialog - allows interaction with other elements
      console.log('Dialog shown as non-modal')
    }
  }

  // Form submission handler - processes button clicks and callbacks
  async _onSubmit (target, event) {
    event?.preventDefault()

    // Temporarily disable all buttons to prevent double-submission
    const priorDisabledStates = []
    for (const action of Object.keys(this.options.buttons)) {
      // In real Foundry: finds actual button elements and disables them
      priorDisabledStates.push([action, false]) // Mock disabled state
    }

    // Execute button callback
    const button = this.options.buttons[target?.dataset?.action]
    let result

    if (button?.callback) {
      result = await button.callback(event, target, this)
    } else {
      result = button?.action
    }

    // Call overall submit handler if provided
    if (this.options.submit) {
      await this.options.submit(result, this)
    }

    // Restore button states
    // In real Foundry: restores actual button disabled states

    // Close dialog if configured to do so
    if (this.options.form.closeOnSubmit) {
      return this.close({ submitted: true })
    }

    return this
  }

  // Keyboard event handling - processes Enter/Escape keys
  _onKeyDown (event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      this.close()
    }
    // In real Foundry: also handles Enter key for default button activation
  }

  // Static button click handler - redirects to submit handler
  static _onClickButton (event, target) {
    this._onSubmit(target, event)
  }

  // FACTORY METHODS - Static methods for common dialog patterns

  // Confirm dialog - Yes/No buttons with boolean result
  static async confirm ({ yes = {}, no = {}, ...config } = {}) {
    config.buttons = config.buttons || []

    // Add default Yes button
    config.buttons.unshift({
      action: 'yes',
      label: 'Yes',
      icon: 'fa-solid fa-check',
      callback: () => true,
      ...yes
    })

    // Add default No button (default focus)
    config.buttons.push({
      action: 'no',
      label: 'No',
      icon: 'fa-solid fa-xmark',
      default: true,
      callback: () => false,
      ...no
    })

    return this.wait({ position: { width: 400 }, ...config })
  }

  // Prompt dialog - Single OK button for acknowledgment
  static async prompt ({ ok = {}, ...config } = {}) {
    config.buttons = config.buttons || []

    // Add default OK button
    config.buttons.unshift({
      action: 'ok',
      label: 'Confirm',
      icon: 'fa-solid fa-check',
      default: true,
      ...ok
    })

    return this.wait({ position: { width: 400 }, ...config })
  }

  // Input dialog - Form data collection with OK button
  static async input ({ ok, ...config } = {}) {
    // Default callback extracts form data
    const callback = (event, button) => {
      // In real Foundry: return new FormDataExtended(button.form).object
      return {} // Mock form data
    }

    return this.prompt({ ok: { callback, ...ok }, ...config })
  }

  // Wait method - Promise-based dialog interaction
  static async wait ({ rejectClose = false, close, render, ...config } = {}) {
    return new Promise((resolve, reject) => {
      // Wrap submission handler with Promise resolution
      const originalSubmit = config.submit
      config.submit = async (result, dialog) => {
        if (originalSubmit) await originalSubmit(result, dialog)
        resolve(result)
      }

      // Create and show dialog
      const dialog = new this(config)

      // Handle dialog close events
      const handleClose = (event) => {
        const result = close instanceof Function ? close(event, dialog) : undefined
        if (rejectClose) {
          reject(new Error('Dialog was dismissed without pressing a button.'))
        } else {
          resolve(result ?? null)
        }
      }

      // Handle render events if callback provided
      if (render instanceof Function) {
        // In real Foundry: dialog.addEventListener('render', event => render(event, dialog))
      }

      // Simulate dialog rendering and interaction
      setTimeout(() => {
        if (Math.random() > 0.5) {
          // Simulate button click
          if (config.submit) config.submit('mock-result', dialog)
        } else {
          // Simulate dialog close
          handleClose({})
        }
      }, 100)
    })
  }

  // User query system - cross-user dialog requests
  static async query (user, type, config = {}) {
    if (typeof user === 'string') {
      // In real Foundry: user = game.users.get(userId)
      if (!user) throw new Error(`User [${user}] does not exist`)
    }

    // If querying self, execute directly
    // eslint-disable-next-line no-constant-condition
    if (user.isSelf || true) { // Mock always treats as self
      return this[type](config)
    }

    // In real Foundry: return user.query('dialog', {type, config})
    return this[type](config)
  }

  // Query handler for incoming user requests
  static _handleQuery = ({ type, config }) => {
    switch (type) {
      case 'confirm':
        return this.confirm(config)
      case 'input':
        return this.input(config)
      case 'prompt':
        return this.prompt(config)
      case 'wait':
        return this.wait(config)
      default:
        throw new Error(`Unknown dialog type: ${type}`)
    }
  }
}

global.DialogV2 = DialogV2Mock

/**
 * DocumentSheetV2 - Base class for v2 document sheets
 * Extends ApplicationV2 to provide document-specific functionality including:
 * - Document permissions and ownership checks
 * - Form handling with validation and submission
 * - Header controls for configuration, UUID copying, image editing
 * - Sheet theming and styling
 * - Compendium import functionality
 */
class DocumentSheetV2Mock {
  constructor (options = {}) {
    // In real Foundry: options = new.target._migrateConstructorParams(options, args) for v1 compatibility
    this.document = options.document || null
    this.position = options.position || {}
    this.options = {
      viewPermission: 1, // DOCUMENT_OWNERSHIP_LEVELS.LIMITED
      editPermission: 3, // DOCUMENT_OWNERSHIP_LEVELS.OWNER
      canCreate: false,
      sheetConfig: true,
      tag: 'form', // Document sheets are forms by default
      form: {
        submitOnChange: false,
        closeOnSubmit: false
      },
      ...options
    }
    this.element = null // Would be the DOM element in real Foundry
    this.id = `${this.constructor.name}-${this.document?.uuid || 'mock'}`
  }

  // Document getter - returns the document this sheet manages
  get document () {
    return this._document
  }

  set document (doc) {
    this._document = doc
  }

  // Dynamic title generation based on document type and name
  // Format: "{DocumentType}: {DocumentName}"
  get title () {
    if (!this.document) return 'Unknown Document'
    const type = this.document.constructor?.metadata?.label || this.document.documentName || 'Document'
    const name = this.document.name || this.document.id || 'Unnamed'
    return `${type}: ${name}`
  }

  // Visibility check - determines if user can view this sheet
  // Governed by viewPermission threshold (default: LIMITED)
  get isVisible () {
    if (!this.document) return false
    // In real Foundry: return this.document.testUserPermission(game.user, this.options.viewPermission)
    return true // Mock always visible
  }

  // Editability check - determines if user can edit this document
  // Considers: edit permissions, compendium lock status
  get isEditable () {
    if (!this.document) return false

    // Check if document is in a locked compendium pack
    if (this.document.pack) {
      // In real Foundry: const pack = game.packs.get(this.document.pack); if (pack.locked) return false
    }

    // In real Foundry: return this.document.testUserPermission(game.user, this.options.editPermission)
    return true // Mock always editable
  }

  // Core render method - called when sheet needs to be displayed/updated
  async render (options = {}) {
    // In real Foundry: calls _canRender, _prepareContext, template rendering, _onRender
    return this
  }

  // Render permission check - throws error if user cannot view sheet
  _canRender (options) {
    if (!this.isVisible) {
      throw new Error('Document sheet is private and not visible to current user')
    }
  }

  // First render lifecycle - registers sheet with document.apps
  async _onFirstRender (context, options) {
    // In real Foundry: this.document.apps[this.id] = this
  }

  // Render lifecycle - disables form fields if not editable
  async _onRender (context, options) {
    if (!this.isEditable) {
      this._toggleDisabled(true)
    }
  }

  // Close lifecycle - unregisters sheet from document.apps
  _onClose (options) {
    // In real Foundry: delete this.document.apps[this.id]
  }

  // Form field disable/enable - controls form interactivity based on edit permissions
  _toggleDisabled (disabled) {
    // In real Foundry: disables all form elements, image inputs, and editable images
    // Also toggles 'disabled' class on img[data-edit] elements
  }

  // Form change handler - processes form field changes
  _onChangeForm (formConfig, event) {
    // Special handling for HTMLSecretBlockElement (ProseMirror secrets)
    if (event.target.constructor.name === 'HTMLSecretBlockElement') {
      return this._onRevealSecret(event)
    }
    // In real Foundry: calls parent form change handling
  }

  // Secret reveal handler - toggles revealed state of secrets in rich text content
  _onRevealSecret (event) {
    // Handles toggling secrets in ProseMirror editors
    // Updates document with modified content
  }

  // Form data processing - expands form data object from flat structure
  // Override this to customize form data extraction and validation
  _processFormData (event, form, formData) {
    // In real Foundry: return foundry.utils.expandObject(formData.object)
    return formData.object || {}
  }

  // Submit data preparation - cleans and validates form data before submission
  _prepareSubmitData (event, form, formData, updateData) {
    const submitData = this._processFormData(event, form, formData)

    // Merge additional update data if provided
    if (updateData) {
      // In real Foundry: foundry.utils.mergeObject with performDeletions
      Object.assign(submitData, updateData)
    }

    // In real Foundry: this.document.validate({changes: submitData, clean: true, fallback: false})
    return submitData
  }

  // Submit processing - handles document update or creation
  async _processSubmitData (event, form, submitData, options = {}) {
    const document = this.document

    // Update existing document if it exists in a collection
    if (document.collection?.has(document.id)) {
      return await document.update(submitData, options)
    } else if (this.options.canCreate) {
      // In real Foundry: handles parent, pack, keepId options for creation
      const created = await document.constructor.create(submitData, options)
      if (created) {
        this.document = created
      }
      return created
    } else {
      throw new Error(`Document creation from ${this.constructor.name} is not supported.`)
    }
  }

  // Header controls - returns array of control buttons for sheet header
  // Default controls: sheet configuration, UUID copy, image editing, compendium import
  _getHeaderControls () {
    const controls = []

    // Sheet configuration control (gear icon)
    if (this.options.sheetConfig && this.isEditable) {
      controls.push({
        icon: 'fa-solid fa-gear',
        label: 'SHEETS.ConfigureSheet',
        action: 'configureSheet'
      })
    }

    return controls
  }

  // Context preparation - prepares data for template rendering
  // Provides: document, source, fields, editable, user, rootId
  async _prepareContext (options) {
    return {
      document: this.document,
      source: this.document._source || this.document,
      fields: this.document.schema?.fields || {},
      editable: this.isEditable,
      user: global.game?.user || { _id: 1 },
      rootId: this.document.collection?.has(this.document.id) ? this.id : 'mock-root-id'
    }
  }

  // Default action handlers - static methods bound to sheet instance

  // Configure sheet handler - opens DocumentSheetConfig dialog
  static configureSheet (event) {
    // In real Foundry: new foundry.applications.apps.DocumentSheetConfig({document: this.document}).render()
  }

  // Copy UUID handler - copies document UUID or ID to clipboard
  static copyUuid (event) {
    // Left click: copies UUID, Right click: copies ID
    const id = event.button === 2 ? this.document.id : this.document.uuid // eslint-disable-line no-unused-vars
    // In real Foundry: game.clipboard.copyPlainText(id)
  }

  // Edit image handler - opens FilePicker for image selection
  static editImage (event, target) {
    if (target.nodeName !== 'IMG') {
      throw new Error('The editImage action is available only for IMG elements.')
    }
    const field = target.dataset.field || 'img'
    const current = global.foundry.utils.getProperty(this.document, field)

    // Mock FilePicker creation and rendering
    const fp = new global.foundry.applications.apps.FilePicker({
      type: 'image',
      current,
      callback: (path) => {
        this.document.update({ [field]: path })
      }
    })

    return fp.render(true)
  }

  // Import document handler - imports from compendium to world
  static importDocument () {
    // In real Foundry: game.collections.get(documentName).importFromCompendium(collection, id)
  }
}

/**
 * ActorSheetV2 - Enhanced mock matching the real Foundry ActorSheetV2
 * Extends DocumentSheetV2 to provide actor-specific functionality:
 * - Automatic drag/drop setup with '.draggable' selector
 * - Actor and token getters for convenient access
 * - Default drag/drop handlers for items and active effects
 * - Item sorting within same actor
 * - Additional header controls for token/portrait management
 * - Document drop delegation to specific handlers
 */
class ActorSheetV2Mock extends DocumentSheetV2Mock {
  constructor (options = {}) {
    super(options)
  }

  // Actor getter - convenience getter for the managed actor document
  get actor () {
    return this.document
  }

  // Token getter - returns associated token if this is an unlinked token actor
  get token () {
    return this.document?.token || null
  }

  // Render lifecycle - called after sheet is rendered to DOM
  // ActorSheetV2 automatically sets up drag/drop functionality
  async _onRender (context, options) {
    await super._onRender(context, options)

    // In real Foundry, this sets up DragDrop automatically:
    // new DragDrop.implementation({
    //   dragSelector: '.draggable',
    //   permissions: {
    //     dragstart: this._canDragStart.bind(this),
    //     drop: this._canDragDrop.bind(this)
    //   },
    //   callbacks: {
    //     dragstart: this._onDragStart.bind(this),
    //     dragover: this._onDragOver.bind(this),
    //     drop: this._onDrop.bind(this)
    //   }
    // }).bind(this.element)
    //
    // This provides automatic drag/drop for any element with class 'draggable'
    // No manual setup required - just add the class to make elements draggable
  }

  // Drag permission check - determines if user can start dragging an element
  // Default: checks if sheet is editable
  _canDragStart (selector) {
    return this.isEditable
  }

  // Drop permission check - determines if user can drop on an element
  // Default: checks if sheet is editable
  _canDragDrop (selector) {
    return this.isEditable
  }

  // Drag start handler - called when dragging begins
  // Default: handles items (data-item-id) and effects (data-effect-id)
  async _onDragStart (event) {
    const target = event.currentTarget
    if ('link' in event.target.dataset) return
    let dragData

    // Handle owned items - creates drag data from item with data-item-id
    if (target.dataset.itemId) {
      const item = this.actor.items.get(target.dataset.itemId)
      dragData = item?.toDragData?.()
    }

    // Handle active effects - creates drag data from effect with data-effect-id
    if (target.dataset.effectId) {
      const effect = this.actor.effects.get(target.dataset.effectId)
      dragData = effect?.toDragData?.()
    }

    // Set drag data for transfer
    if (dragData) {
      event.dataTransfer.setData('text/plain', JSON.stringify(dragData))
    }
  }

  // Drag over handler - called when dragging over a drop target
  // Default: empty implementation, can be overridden for visual feedback
  _onDragOver (event) {}

  // Drop handler - called when something is dropped on the sheet
  // Default: processes drop data and delegates to specific document handlers
  async _onDrop (event) {
    // Extract drag data from the drop event
    // In real Foundry: const data = TextEditor.getDragEventData(event)
    // const data = {} // Mock data - not used in mock
    const actor = this.actor // eslint-disable-line no-unused-vars

    // Call hook for third-party modules to intercept drops
    // In real Foundry: const allowed = Hooks.call('dropActorSheetData', actor, this, data)
    // if (allowed === false) return

    // Resolve the dropped document and delegate to specific handler
    // In real Foundry:
    // const documentClass = foundry.utils.getDocumentClass(data.type)
    // if (documentClass) {
    //   const document = await documentClass.fromDropData(data)
    //   await this._onDropDocument(event, document)
    // }

    return true
  }

  // Document drop dispatcher - routes drops to specific document type handlers
  async _onDropDocument (event, document) {
    switch (document.documentName) {
      case 'ActiveEffect':
        return this._onDropActiveEffect(event, document)
      case 'Actor':
        return this._onDropActor(event, document)
      case 'Item':
        return this._onDropItem(event, document)
      case 'Folder':
        return this._onDropFolder(event, document)
    }
  }

  // Active Effect drop handler - creates effect on actor
  // Default: creates embedded ActiveEffect with keepId logic
  async _onDropActiveEffect (event, effect) {
    if (!this.actor.isOwner || !effect || effect.target === this.actor) return
    const keepId = !this.actor.effects.has(effect.id) // eslint-disable-line no-unused-vars
    // In real Foundry: await ActiveEffect.implementation.create(effect.toObject(), { parent: this.actor, keepId })
  }

  // Actor drop handler - handles dropping actors on sheet
  // Default: empty implementation, override for specific behavior
  async _onDropActor (event, actor) {}

  // Item drop handler - creates item on actor or handles sorting
  // Default: creates embedded Item or calls _onSortItem for same-actor drops
  async _onDropItem (event, item) {
    if (!this.actor.isOwner) return

    // If dropping item from same actor, handle as sort operation
    if (this.actor.uuid === item.parent?.uuid) {
      return this._onSortItem(event, item)
    }

    // Create new embedded item with keepId logic
    const keepId = !this.actor.items.has(item.id) // eslint-disable-line no-unused-vars
    // In real Foundry: await Item.implementation.create(item.toObject(), { parent: this.actor, keepId })
  }

  // Folder drop handler - handles dropping folders on sheet
  // Default: empty implementation, override for specific behavior
  async _onDropFolder (event, folder) {}

  // Item sorting handler - reorders items within the same actor
  // Default: uses Foundry's integer sort algorithm to reorder items
  _onSortItem (event, item) {
    const items = this.actor.items
    const source = items.get(item.id)

    // Find drop target element with data-item-id
    const dropTarget = event.target.closest('[data-item-id]')
    if (!dropTarget) return

    const target = items.get(dropTarget.dataset.itemId)
    if (source.id === target.id) return

    // Build siblings list from DOM elements (excludes the source item)
    const siblings = []
    for (const element of dropTarget.parentElement.children) {
      const siblingId = element.dataset.itemId
      if (siblingId && siblingId !== source.id) {
        siblings.push(items.get(siblingId))
      }
    }

    // Calculate sort updates using Foundry's integer sort
    // In real Foundry: const sortUpdates = foundry.utils.performIntegerSort(source, { target, siblings })
    // return this.actor.updateEmbeddedDocuments('Item', updateData)
  }

  // Header controls - returns default actor sheet header controls
  // ActorSheetV2 adds token and artwork controls to base DocumentSheetV2 controls
  _getHeaderControls () {
    const controls = super._getHeaderControls()
    const actor = this.actor // eslint-disable-line no-unused-vars

    // Default ActorSheetV2 controls (added automatically):
    // 1. Configure Token - opens token configuration for current token (if actor.isToken)
    // 2. Configure Prototype Token - opens prototype token config (if not token actor and editable)
    // 3. Show Portrait Artwork - displays actor portrait in ImagePopout (if custom portrait exists)
    // 4. Show Token Artwork - displays token artwork in ImagePopout (if custom token art exists)
    //
    // Controls are filtered based on:
    // - actor.img !== CONST.DEFAULT_TOKEN (for portrait)
    // - prototypeToken settings and randomImg status (for token art)
    // - actor.isToken status and edit permissions

    // In real Foundry, these are added automatically via DEFAULT_OPTIONS.window.controls
    // and filtered in _getHeaderControls() based on current state

    return controls
  }
}

// Export mocks to global scope for test access
global.DocumentSheetV2 = DocumentSheetV2Mock
global.ActorSheetV2 = ActorSheetV2Mock

// Additional Foundry constants used by DocumentSheetV2
global.CONST = {
  ...global.CONST,
  DOCUMENT_OWNERSHIP_LEVELS: {
    NONE: 0,
    LIMITED: 1,
    OBSERVER: 2,
    OWNER: 3
  },
  DEFAULT_TOKEN: 'icons/svg/mystery-man.svg'
}

/**
 * Item - Enhanced to better simulate real item behavior
 */
class MockItem {
  constructor (data = {}, context = {}) {
    this._id = data._id || 'mock-item-id'
    this.name = data.name || 'Mock Item'

    if (data.type) {
      this.system = getTemplateData('Item', data.type) || {}
      this.type = data.type
    }

    // Enhanced system defaults for common item types (applied after template but before explicit data)
    if (this.type === 'weapon') {
      // Set enhanced defaults, overriding template defaults where needed
      const weaponDefaults = {
        melee: true,
        damage: '1d6',
        attackBonus: '+0',
        toHit: '+0',
        critRange: 20,
        critDie: '1d6',
        critTable: 'III'
      }
      // Apply our defaults over template data
      this.system = Object.assign({}, this.system, weaponDefaults)
    }

    Object.assign(this, data)

    // Apply any explicit system data from constructor
    if (this.type === 'weapon' && data.system) {
      Object.assign(this.system, data.system)
    } else if (this.type === 'armor') {
      const armorDefaults = {
        equipped: false,
        checkPenalty: 0,
        fumbleDie: '1d4'
      }
      this.system = Object.assign({}, this.system, armorDefaults)
      if (data.system) {
        Object.assign(this.system, data.system)
      }
    }
    this.actor = null // Will be set when added to an actor
  }

  prepareBaseData () {
    // Enhanced preparation for weapons and armor
    if (this.type === 'weapon' && this.actor) {
      this._prepareWeaponData()
    } else if (this.type === 'armor') {
      this._prepareArmorData()
    }
  }

  _prepareWeaponData () {
    // Simulate basic weapon preparation
    if (!this.system.initiativeDie) {
      this.system.initiativeDie = this.actor.system.attributes.actionDice?.value || '1d20'
    }
  }

  _prepareArmorData () {
    // Simulate basic armor preparation
    if (!this.system.fumbleDie) {
      this.system.fumbleDie = '1d4'
    }
  }
}

// Enhanced MockItem with drag data support
MockItem.prototype.toDragData = function () {
  return {
    type: 'Item',
    uuid: `Item.${this._id}`,
    data: this
  }
}

global.Item = MockItem

/**
 * Collection
 */
global.collectionFindMock = vi.fn().mockName('Collection.find')
const CollectionMock = vi.fn().mockImplementation(() => {
  return {
    find: global.collectionFindMock
  }
}).mockName('Collection')
global.Collection = CollectionMock

/**
 * Actor
 */
// Enhanced itemTypes mock that returns proper collections by type
global.itemTypesMock = vi.fn(() => {
  return {
    armor: [],
    weapon: [],
    equipment: [],
    spell: [],
    skill: [],
    treasure: []
  }
}).mockName('Actor.itemTypes getter')
global.actorUpdateMock = vi.fn(data => {}).mockName('Actor.update')

class ActorMock {
  constructor (data, options) {
    // If test-specific data is passed in use it, otherwise use default data
    if (data) {
      Object.assign(this, data)
    } else {
      this._id = 1
      this.name = 'test character'
      Object.assign(this, {
        system: {
          abilities: {
            str: { value: 6, label: 'DCC.AbilityStr' },
            agl: { value: 8, label: 'DCC.AbilityAgl' },
            sta: { value: 12, label: 'DCC.AbilitySta' },
            int: { value: 14, label: 'DCC.AbilityInt' },
            per: { value: 16, label: 'DCC.AbilityPer' },
            lck: { value: 18, label: 'DCC.AbilityLck' }
          },
          attributes: {
            ac: {
              checkPenalty: 0
            },
            init: { value: -1 },
            actionDice: { value: '1d20' },
            fumble: { die: '1d4' },
            speed: {
              value: 30
            },
            hp: {
              value: 3,
              max: 3
            }
          },
          saves: {
            frt: { value: '-1' },
            ref: { value: '0' },
            wil: { value: '+2' }
          },
          details: {
            attackBonus: '+0',
            attackHitBonus: {
              melee: {
                value: '+0',
                adjustment: '+0'
              },
              missile: {
                value: '+0',
                adjustment: '+0'
              }
            },
            attackDamageBonus: {
              melee: {
                value: '+0',
                adjustment: '+0'
              },
              missile: {
                value: '+0',
                adjustment: '+0'
              }
            },
            lastRolledAttackBonus: '',
            level: {
              value: 1
            }
          },
          class: {
            corruption: '',
            luckDie: '1d3',
            spellCheck: 3,
            spellCheckAbility: 'int',
            spellCheckOverride: '',
            spellCheckOverrideDie: ''
          },
          skills: {
            customDieSkill: {
              label: 'Custom Die Skill',
              die: '1d14'
            },
            customDieAndValueSkill: {
              label: 'Custom Die And Value Skill',
              die: '1d14',
              value: +3
            },
            actionDieSkill: {
              label: 'Action Die Skill',
              value: -4
            },
            customDieSkillWithInt: {
              label: 'Custom Die Skill With Int',
              ability: 'int',
              die: '1d24'
            },
            customDieAndValueSkillWithPer: {
              label: 'Custom Die And Value Skill With Per',
              ability: 'per',
              die: '1d24',
              value: +3
            },
            actionDieAndValueSkillWithLck: {
              label: 'Action Die And Value Skill With Lck',
              ability: 'lck',
              value: +1
            }
          },
          config: {
            actionDice: '1d20',
            attackBonusMode: 'flat',
            maxLevel: 0,
            rollAttackBonus: false,
            computeAC: false,
            computeCheckPenalty: true,
            baseACAbility: 'agl',
            initiativeDieOverride: '',
            sortInventory: true,
            removeEmptyItems: true
          }
        }
      })
    }
    this.items = new global.Collection()
    this.effects = new global.Collection() // ActiveEffect collection
    this.prepareData()
    Object.defineProperty(this, 'itemTypes', {
      get: global.itemTypesMock
    })

    // Actor sheet properties
    this.isOwner = true
    this.isToken = false
    this.token = null
    this.uuid = `Actor.${this._id}`

    // Prototype token properties
    this.prototypeToken = {
      texture: {
        src: 'icons/svg/mystery-man.svg'
      }
    }
  }

  prepareData () {
    // Simulate the real prepareBaseData behavior for ability modifiers
    this.prepareBaseData()
  }

  prepareBaseData () {
    // Calculate ability modifiers using CONFIG.DCC.abilityModifiers like the real actor
    const abilities = this.system.abilities
    for (const abilityId in abilities) {
      const config = global.CONFIG?.DCC?.abilityModifiers || DCC.abilityModifiers
      abilities[abilityId].mod = config[abilities[abilityId].value] || 0
      abilities[abilityId].maxMod = config[abilities[abilityId].max] || abilities[abilityId].mod
    }
  }

  getRollData () {
    return this.system
  }

  rollInitiative (createCombatants, rerollInitiative, initiativeOptions) {
    return this.getInitiativeRoll()
  }

  update (data) {
    return global.actorUpdateMock(data)
  }
}

global.Actor = ActorMock

/**
 * ChatMessage
 */
class ChatMessageMock {
  static getSpeaker = vi.fn(({ scene, actor, token, alias } = {}) => { return actor })
  static applyRollMode = vi.fn()

  static create (data, options = {}) { if (data) { this.data = data } }

  constructor (data, options = {}) { if (data) { this.data = data } }
}

global.ChatMessage = ChatMessageMock

// noinspection JSConstantReassignment
/**
 * CONFIG - Enhanced to better simulate Foundry environment
 */
global.CONFIG = {
  DCC: JSON.parse(JSON.stringify(DCC)), // Deep copy to avoid mutations
  sounds: { dice: 'diceSound' },
  Actor: {
    documentClass: ActorMock
  },
  Item: {
    documentClass: MockItem
  }
}

// Enhanced CONST to include more Foundry constants
global.CONST = {
  CHAT_MESSAGE_STYLES: {
    EMOTE: 'emote',
    IC: 'ic',
    OOC: 'ooc'
  },
  DICE_ROLL_MODES: {
    PUBLIC: 'roll',
    PRIVATE: 'gmroll',
    BLIND: 'blindroll',
    SELF: 'selfroll'
  },
  ENTITY_TYPES: {
    ACTOR: 'Actor',
    ITEM: 'Item'
  },
  ACTIVE_EFFECT_MODES: {
    CUSTOM: 0,
    MULTIPLY: 1,
    ADD: 2,
    DOWNGRADE: 3,
    UPGRADE: 4,
    OVERRIDE: 5
  }
}

// Create global actor instance after CONFIG is set up
global.actor = new ActorMock()

/**
 * Localization - Enhanced with common DCC localizations
 */
class Localization {
  constructor () {
    // Common DCC localization strings for more realistic testing
    this.translations = {
      'DCC.AbilityStr': 'Strength',
      'DCC.AbilityAgl': 'Agility',
      'DCC.AbilitySta': 'Stamina',
      'DCC.AbilityPer': 'Personality',
      'DCC.AbilityInt': 'Intelligence',
      'DCC.AbilityLck': 'Luck',
      'DCC.ActionDie': 'Action Die',
      'DCC.RollModifierTitleInitiative': 'Initiative',
      'DCC.ToHit': 'Attack',
      'DCC.SavesReflex': 'Reflex',
      'DCC.SavesFortitude': 'Fortitude',
      'DCC.SavesWill': 'Will',
      'DCC.SpellCheck': 'Spell Check',
      'DCC.LuckDie': 'Luck Die',
      'DCC.Level': 'Level',
      'DCC.AbilityMod': 'Ability Modifier',
      'DCC.SpellCheckOtherMod': 'Other Modifier',
      'DCC.CheckPenalty': 'Check Penalty',
      'DCC.Spellburn': 'Spellburn',
      'DCC.StartingFunds': 'Starting Funds',
      'DCC.Equipment': 'Equipment',
      'DCC.TradeGoods': 'Trade Goods',
      'DCC.BirthAugur': 'Birth Augur',
      'DCC.Languages': 'Languages'
    }
  }

  /**
   * @param {string} stringId - The localization key to translate
   * @returns {string} The translated string
   */
  localize (stringId) {
    // Return actual translation if available, otherwise strip DCC prefix
    return this.translations[stringId] || stringId.replace('DCC.', '')
  }

  format (stringId, data = {}) {
    let returnString = this.localize(stringId)
    for (const datum in data) {
      returnString = returnString.replace(`{${datum}}`, data[datum])
    }
    return returnString
  }
}

global.Localization = Localization

/**
 * Game
 */
class Game {
  constructor (worldData, sessionId, socket) {
    /** @type {Localization} */
    this.i18n = new Localization()
  }

  user = {} // Set up below

  dcc = {} // Set up below
}

global.Game = Game
global.game = new Game()
global.game.user = { _id: 1 }
global.getDCCSkillTableMock = vi.fn((skillName) => { return null }).mockName('game.dcc.getSkillTable')
global.processSpellCheckMock = vi.fn((actor, spellData) => { }).mockName('game.dcc.processSpellCheck')
global.calculateCritAdjustment = vi.fn((original, adjusted) => { return 0 }).mockName('game.dcc.DiceChain.calculateCritAdjustment')
global.updateFlagsMock = vi.fn((flags, roll) => { }).mockName('game.dcc.FleetingLuck.updateFlags')

// Enhanced DiceChain mock with actual DCC dice chain logic
global.rankDiceExpressionMock = vi.fn((expression) => {
  // Simulate the ranking of dice expressions based on the DCC dice chain
  const diceChain = [3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30]
  const match = expression.match(/d(\d+)/)
  if (match) {
    const dieSize = parseInt(match[1])
    const rank = diceChain.indexOf(dieSize)
    return rank >= 0 ? rank : 0
  }
  return 0
}).mockName('game.dcc.DiceChain.rankDiceExpression')

global.game.dcc = {
  DCCRoll,
  getSkillTable: global.getDCCSkillTableMock,
  processSpellCheck: global.processSpellCheckMock,
  DiceChain: {
    calculateCritAdjustment: global.calculateCritAdjustment,
    rankDiceExpression: global.rankDiceExpressionMock,
    DICE_CHAIN: [3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30]
  },
  FleetingLuck: {
    updateFlags: global.updateFlagsMock
  }
}
global.renderTemplate = vi.fn((template, data) => { return '' }).mockName('renderTemplate')

/**
 * Settings - Enhanced with common DCC setting defaults
 */
global.gameSettingsGetMock = vi.fn((module, key) => {
  // Return realistic defaults for common DCC settings
  if (module === 'dcc') {
    switch (key) {
      case 'criticalHitPacks':
        return 'dcc-core-book.dcc-crits'
      case 'fumbleTable':
        return 'dcc-core-book.dcc-fumbles'
      case 'disapprovalPacks':
        return 'dcc-core-book.dcc-disapproval'
      case 'divineAidTable':
        return 'dcc-core-book.dcc-divine-aid'
      case 'mercurialMagicTable':
        return 'dcc-core-book.dcc-mercurial-magic'
      case 'turnUnholyTable':
        return 'dcc-core-book.dcc-turn-unholy'
      case 'layOnHandsTable':
        return 'dcc-core-book.dcc-lay-on-hands'
      case 'levelData':
        return 'dcc-core-book.dcc-level-data'
      default:
        return undefined
    }
  }
  return undefined
}).mockName('game.settings.get')

class ClientSettings {
  constructor (worldSettings) {
    this.get = global.gameSettingsGetMock
  }
}

global.game.settings = new ClientSettings()

/**
 * ChatMessage
 */
global.CONFIG.ChatMessage = {
  documentClass: {
    create: vi.fn((messageData = {}) => {
      // console.log(messageData)
    })
  }
}

/**
 * Notifications
 */
global.uiNotificationsWarnMock = vi.fn((message, options) => {}).mockName('ui.notifications.warn')
global.uiNotificationsErrorMock = vi.fn((message, type, permanent) => {}).mockName('ui.notifications.error')

class Notifications {
  warn = global.uiNotificationsWarnMock
  error = global.uiNotificationsErrorMock
}

global.ui = {
  notifications: new Notifications()
}

/**
 * Global helper functions
 */

// DragDrop mock - simulates Foundry's drag and drop system
class DragDropMock {
  constructor (options = {}) {
    this.dragSelector = options.dragSelector || '.draggable'
    this.dropSelector = options.dropSelector || null
    this.permissions = options.permissions || {}
    this.callbacks = options.callbacks || {}
  }

  // Bind drag/drop handlers to an element - in real Foundry this sets up event listeners
  bind (element) {
    this.element = element
    return this
  }

  // Static implementation property - points to the DragDrop class itself
  static implementation = DragDropMock
}

// Namespace for Foundry helper functions
global.foundry = {
  utils: {},
  applications: {
    api: {
      // HandlebarsApplicationMixin - provides Handlebars template rendering capabilities
      // Adds template-based rendering to ApplicationV2 classes
      HandlebarsApplicationMixin: (BaseClass) => {
        return class extends BaseClass {
          // Render with handlebars template support
          async render (options = {}) {
            return super.render(options)
          }

          // Template rendering - compiles and renders Handlebars templates
          async _renderHTML (context, options) {
            // In real Foundry: compiles templates from PARTS configuration
            // Supports partial templates and automatic template loading
            return '<div>Handlebars Template Rendered</div>'
          }
        }
      },

      // ApplicationV2 base class export
      ApplicationV2: global.ApplicationV2
    },
    handlebars: {
      renderTemplate: vi.fn((template, data) => { return '' }).mockName('renderTemplate')
    },
    sheets: {
      // ActorSheetV2 - export the mock for import statements
      ActorSheetV2: global.ActorSheetV2,
      // DocumentSheetV2 - export the mock for import statements
      DocumentSheetV2: global.DocumentSheetV2
    },
    apps: {
      // DialogV2 - modal dialog application for user interaction
      DialogV2: global.DialogV2,
      // DocumentSheetConfig - configuration dialog for document sheets
      DocumentSheetConfig: class DocumentSheetConfigMock {
        static DEFAULT_OPTIONS = { position: { width: 400 } }

        constructor (options = {}) { this.options = options }

        render () { return this }
      },
      // FilePicker - file browser dialog for asset selection
      FilePicker: class FilePickerMock {
        constructor (options = {}) {
          this.options = options
          this.type = options.type || 'any'
          this.current = options.current || ''
          this.callback = options.callback || (() => {})
        }

        async browse () { return this }

        render (force = false) {
          // Mock rendering - in tests, just return this
          return this
        }
      },
      // ImagePopout - image viewer dialog
      ImagePopout: class ImagePopoutMock {
        constructor (options = {}) { this.options = options }

        render () { return this }
      }
    },
    ux: {
      TextEditor: {
        enrichHTML: vi.fn(async (content, options = {}) => content).mockName('TextEditor.enrichHTML'),
        // getDragEventData - extracts drag data from drop events
        getDragEventData: vi.fn((event) => {
          try {
            return JSON.parse(event.dataTransfer?.getData('text/plain') || '{}')
          } catch {
            return {}
          }
        }).mockName('TextEditor.getDragEventData')
      },
      DragDrop: DragDropMock
    },
    types: {
      // ApplicationTabsConfiguration - type for tab configuration
      ApplicationTabsConfiguration: class {}
    }
  }
}

// Set up the global DragDrop reference
global.DragDrop = DragDropMock

// Foundry's implementation of getType
global.getType = function (token) {
  const tof = typeof token
  if (tof === 'object') {
    if (token === null) return 'null'
    const cn = token.constructor.name
    if (['String', 'Number', 'Boolean', 'Array', 'Set'].includes(cn)) return cn
    else if (/^HTML/.test(cn)) return 'HTMLElement'
    else return 'Object'
  }
  return tof
}

// Foundry's implementation of setProperty
global.setProperty = function (object, key, value) {
  let target = object
  let changed = false

  // Convert the key to an object reference if it contains dot notation
  if (key.indexOf('.') !== -1) {
    const parts = key.split('.')
    key = parts.pop()
    target = parts.reduce((o, i) => {
      if (!Object.hasOwn(o, i)) o[i] = {}
      return o[i]
    }, object)
  }

  // Update the target
  if (target[key] !== value) {
    changed = true
    target[key] = value
  }

  // Return changed status
  return changed
}

// Foundry's implementation of expandObject
global.foundry.utils.expandObject = function (obj, _d = 0) {
  const expanded = {}
  if (_d > 10) throw new Error('Maximum depth exceeded')
  for (let [k, v] of Object.entries(obj)) {
    if (v instanceof Object && !Array.isArray(v)) v = global.foundry.utils.expandObject(v, _d + 1)
    global.setProperty(expanded, k, v)
  }
  return expanded
}

// Foundry's implementation of duplicate
global.foundry.utils.duplicate = function (original) {
  return JSON.parse(JSON.stringify(original))
}

// Foundry's implementation of getProperty
global.foundry.utils.getProperty = function (object, key) {
  if (!object || !key) return undefined

  // Split the key on dots and array notation
  const parts = key.split(/\.|\[(\d+)\]/).filter(p => p)

  // Traverse the object
  let result = object
  for (const part of parts) {
    if (result == null) return undefined

    // Handle array index
    if (/^\d+$/.test(part)) {
      result = result[parseInt(part)]
    } else {
      result = result[part]
    }
  }

  return result
}

// Foundry's implementation of setProperty
global.foundry.utils.setProperty = function (object, key, value) {
  let target = object
  let changed = false

  // Convert the key to an object reference if it contains dot notation
  if (key.indexOf('.') !== -1) {
    const parts = key.split('.')
    key = parts.pop()
    target = parts.reduce((o, i) => {
      if (!Object.hasOwn(o, i)) o[i] = {}
      return o[i]
    }, object)
  }

  // Update the target
  if (target[key] !== value) {
    changed = true
    target[key] = value
  }

  // Return changed status
  return changed
}

// Foundry's implementation of mergeObject
global.foundry.utils.mergeObject = function (original, other = {}, {
  insertKeys = true,
  insertValues = true,
  overwrite = true,
  recursive = true,
  inplace = true,
  enforceTypes = false
} = {}, _d = 0) {
  other = other || {}
  if (!(original instanceof Object) || !(other instanceof Object)) {
    throw new Error('One of original or other are not Objects!')
  }
  const depth = _d + 1

  // Maybe copy the original data at depth 0
  if (!inplace && (_d === 0)) original = foundry.utils.duplicate(original)

  // Enforce object expansion at depth 0
  if ((_d === 0) && Object.keys(original).some(k => /\./.test(k))) original = global.foundry.utils.expandObject(original)
  if ((_d === 0) && Object.keys(other).some(k => /\./.test(k))) other = global.foundry.utils.expandObject(other)

  // Iterate over the other object
  for (let [k, v] of Object.entries(other)) {
    const tv = global.getType(v)

    // Prepare to delete
    let toDelete = false
    if (k.startsWith('-=')) {
      k = k.slice(2)
      toDelete = (v === null)
    }

    // Get the existing object
    let x = original[k]
    let has = Object.hasOwn(original, k)
    let tx = global.getType(x)

    // Ensure that inner objects exist
    if (!has && (tv === 'Object')) {
      x = original[k] = {}
      has = true
      tx = 'Object'
    }

    // Case 1 - Key exists
    if (has) {
      // 1.1 - Recursively merge an inner object
      if ((tv === 'Object') && (tx === 'Object') && recursive) {
        global.foundry.utils.mergeObject(x, v, {
          insertKeys,
          insertValues,
          overwrite,
          inplace: true,
          enforceTypes
        }, depth)

        // 1.2 - Remove an existing key
      } else if (toDelete) {
        delete original[k]

        // 1.3 - Overwrite existing value
      } else if (overwrite) {
        if (tx && (tv !== tx) && enforceTypes) {
          throw new Error('Mismatched data types encountered during object merge.')
        }
        original[k] = v

        // 1.4 - Insert new value
      } else if ((x === undefined) && insertValues) {
        original[k] = v
      }

      // Case 2 - Key does not exist
    } else if (!toDelete) {
      const canInsert = (depth === 1 && insertKeys) || (depth > 1 && insertValues)
      if (canInsert) original[k] = v
    }
  }

  // Return the object for use
  return original
}

/**
 * Handlebars
 * @templateList {Array<string>} A list of template paths to load
 */
global.loadTemplates = vi.fn((templateList) => {}).mockName('loadTemplates')

class TextEditorMock {
  static async enrichHTML (content, options = {}) {
    return content
  }
}

global.TextEditor = TextEditorMock

/**
 * Hooks
 */
class HooksMock {
  static async callAll (hook, rolls, messageData) {
    return true
  }

  static call (hook, ...args) {
    return true
  }
}

global.Hooks = HooksMock

/**
 * Default data for document types - matches TypeDataModel definitions
 * This replaces the legacy template.json approach
 */
const DOCUMENT_DEFAULTS = {
  Actor: {
    common: {
      abilityLog: [],
      abilities: {
        str: { label: 'DCC.AbilityStr', value: 10, max: 10, spent: 0, damage: 0 },
        agl: { label: 'DCC.AbilityAgl', value: 10, max: 10, spent: 0, damage: 0 },
        sta: { label: 'DCC.AbilitySta', value: 10, max: 10, spent: 0, damage: 0 },
        per: { label: 'DCC.AbilityPer', value: 10, max: 10, spent: 0, damage: 0 },
        int: { label: 'DCC.AbilityInt', value: 10, max: 10, spent: 0, damage: 0 },
        lck: { label: 'DCC.AbilityLck', value: 10, max: 10, spent: 0, damage: 0 }
      },
      attributes: {
        ac: { value: 10, checkPenalty: 0, otherMod: 0, speedPenalty: 0 },
        actionDice: { value: '1d20', options: [{ value: '1d20', label: '1d20' }] },
        critical: { die: '1d4', table: 'I' },
        fumble: { die: '1d4' },
        hitDice: { value: '1d4' },
        hp: { value: 10, min: 0, max: 10, temp: 0, tempmax: 0 },
        init: { die: '1d20', otherMod: 0, value: '+0' },
        initDice: { value: '1d20', options: [{ value: '1d20', label: '1d20' }, { value: '1d16', label: '1d16' }] },
        speed: { value: '30', base: '30', special: '', swim: '', fly: '' }
      },
      details: {
        alignment: 'l',
        attackBonus: '+0',
        attackHitBonus: { melee: { value: '+0', adjustment: '+0' }, missile: { value: '+0', adjustment: '+0' } },
        attackDamageBonus: { melee: { value: '+0', adjustment: '+0' }, missile: { value: '+0', adjustment: '+0' } },
        birthAugur: '',
        birthAugurLuckMod: 0,
        critRange: 20,
        languages: '',
        level: { value: 0 },
        occupation: { value: '' },
        notes: { value: '' },
        title: { value: '' },
        xp: { value: 0, min: 0, max: 10 }
      },
      saves: {
        frt: { abbreviation: 'DCC.SavesFortitudeAbbr', label: 'DCC.SavesFortitude', classBonus: '', otherBonus: '', override: '', value: 0 },
        ref: { abbreviation: 'DCC.SavesReflexAbbr', label: 'DCC.SavesReflex', classBonus: '', otherBonus: '', override: '', value: 0 },
        wil: { abbreviation: 'DCC.SavesWillAbbr', label: 'DCC.SavesWill', classBonus: '', otherBonus: '', override: '', value: 0 }
      },
      currency: { pp: 0, ep: 0, gp: 0, sp: 0, cp: 0 }
    },
    config: {
      config: {
        attackBonusMode: 'flat',
        actionDice: '1d20',
        addClassLevelToInitiative: false,
        maxLevel: '',
        rollAttackBonus: false,
        computeAC: true,
        baseACAbility: 'agl',
        computeSpeed: true,
        computeCheckPenalty: true,
        computeInitiative: true,
        computeMeleeAndMissileAttackAndDamage: true,
        computeSavingThrows: true,
        sortInventory: true,
        removeEmptyItems: true,
        showSpells: false,
        showSkills: false,
        showBackstab: false,
        showSwimFlySpeed: false
      }
    },
    Player: {
      class: { className: 'Zero-Level' },
      skills: { detectSecretDoors: { label: 'DCC.DetectSecretDoors', ability: '', value: '+0' } }
    },
    NPC: {
      attributes: { critical: { die: '1d4', table: 'M' }, hitDice: { value: '1d6' } },
      class: { spellCheck: 1, spellCheckAbility: 'int' }
    },
    Party: {}
  },
  Item: {
    itemDescription: {
      description: { value: '', chat: '', unidentified: '', summary: '', judge: { value: '' } },
      source: ''
    },
    physicalItem: {
      quantity: 1,
      weight: 0,
      equipped: true,
      identified: true,
      value: { pp: 0, ep: 0, gp: 0, sp: 0, cp: 0 }
    },
    weapon: {
      config: { actionDieOverride: '', critDieOverride: '', critRangeOverride: null, critTableOverride: '', damageOverride: '', attackBonusOverride: '', initiativeBonusOverride: '', initiativeDieOverride: '' },
      actionDie: '1d20',
      attackBonus: '',
      attackBonusWeapon: '',
      attackBonusLucky: '',
      backstabDamage: '',
      critDie: '',
      critRange: 20,
      critTable: '',
      damage: '',
      damageWeapon: '',
      damageBonus: '',
      damageWeaponBonus: '',
      doubleIfMounted: false,
      initiativeBonus: '',
      initiativeDie: '1d20',
      initiativeWeaponBonus: '',
      melee: false,
      range: '',
      shortRangeStrength: false,
      subdual: false,
      toHit: '+0',
      trained: true,
      twoHanded: false,
      twoWeaponPrimary: false,
      twoWeaponSecondary: false
    },
    ammunition: {},
    armor: { acBonus: '+1', checkPenalty: '-0', speed: '-0', fumbleDie: '1d4' },
    equipment: {},
    level: { class: '', level: '', levelData: '', levelDataLawful: '', levelDataNeutral: '', levelDataChaotic: '' },
    mount: {},
    spell: {
      config: { inheritActionDie: true, inheritSpellCheck: true, inheritCheckPenalty: true, castingMode: 'wizard', showMercurialTab: false },
      level: 1,
      associatedPatron: '',
      lost: false,
      range: '',
      duration: '',
      page: '',
      castingTime: '',
      results: {},
      save: '',
      spellCheck: { die: '1d20', value: '+0', penalty: '-0', otherBonus: '' },
      manifestation: { value: '', description: '', displayInChat: true },
      mercurialEffect: { value: '', summary: '', description: '', displayInChat: true },
      lastResult: ''
    },
    treasure: { value: { pp: 0, ep: 0, gp: 0, sp: 0, cp: 0 }, isCoins: false },
    skill: {
      config: { useSummary: true, useAbility: true, useDie: true, useLevel: false, useValue: true, showLastResult: true, applyCheckPenalty: false },
      ability: '',
      die: '1d20',
      value: '',
      lastResult: '0'
    }
  }
}

export function getTemplateData (documentClass, type) {
  if (!documentClass || !type) {
    return null
  }

  const defaults = DOCUMENT_DEFAULTS[documentClass]
  if (!defaults) return null

  const documentData = {}

  // For Actors, merge common and config templates first
  if (documentClass === 'Actor') {
    Object.assign(documentData, JSON.parse(JSON.stringify(defaults.common || {})))
    Object.assign(documentData, JSON.parse(JSON.stringify(defaults.config || {})))
  }
  // For Items, merge itemDescription and physicalItem templates
  if (documentClass === 'Item') {
    Object.assign(documentData, JSON.parse(JSON.stringify(defaults.itemDescription || {})))
    // Physical items get physicalItem template
    if (['weapon', 'ammunition', 'armor', 'equipment', 'mount'].includes(type)) {
      Object.assign(documentData, JSON.parse(JSON.stringify(defaults.physicalItem || {})))
    }
  }

  // Merge type-specific data
  const typeData = defaults[type]
  if (typeData) {
    Object.assign(documentData, JSON.parse(JSON.stringify(typeData)))
  }

  return documentData
}

// Mock DCCActorLevelChange
global.DCCActorLevelChange = class DCCActorLevelChange {
  constructor (actor) {
    this.actor = actor
  }

  render (force) {
    return true
  }
}

/**
 * @typedef HandlebarsRenderOptions
 * @property {string[]} parts                       An array of named template parts to render
 */

/**
 * @typedef HandlebarsTemplatePart
 * @property {string} template                      The template entry-point for the part
 * @property {string} [id]                          A CSS id to assign to the top-level element of the rendered part.
 *                                                  This id string is automatically prefixed by the application id.
 * @property {boolean} [root=false]                 Does this rendered contents of this template part replace the
 *                                                  children of the root element?
 * @property {string[]} [classes]                   An array of CSS classes to apply to the top-level element of the
 *                                                  rendered part.
 * @property {string[]} [templates]                 An array of additional templates that are required to render the
 *                                                  part. If omitted, only the entry-point is inferred as required.
 * @property {string[]} [scrollable]                An array of selectors within this part whose scroll positions should
 *                                                  be persisted during a re-render operation. A blank string is used
 *                                                  to denote that the root level of the part is scrollable.
 * @property {Record<string, ApplicationFormConfiguration>} [forms] A registry of forms selectors and submission
 *                                                                  handlers.
 */

/**
 * Augment an Application class with [Handlebars](https://handlebarsjs.com) template rendering behavior.
 * @param {Constructor<ApplicationV2>} BaseApplication
 */
function HandlebarsApplicationMixin(BaseApplication) {
  /**
   * The mixed application class augmented with [Handlebars](https://handlebarsjs.com) template rendering behavior.
   * @extends {ApplicationV2<ApplicationConfiguration, HandlebarsRenderOptions>}
   */
  class HandlebarsApplication extends BaseApplication {
    constructor(...args) {
      super(...args);
      Object.values(this.constructor.PARTS).forEach((part, i) => {
        if ( part.root && (i > 0) ) throw new Error("A root template must be first in the PARTS record.");
      });
    }

    /**
     * Configure a registry of template parts which are supported for this application for partial rendering.
     * @type {Record<string, HandlebarsTemplatePart>}
     */
    static PARTS = {};

    /**
     * A record of all rendered template parts.
     * @returns {Record<string, HTMLElement>}
     */
    get parts() {
      return this.#parts;
    }

    #parts = {};

    /**
     * Dynamically configured part descriptors.
     * @type {Readonly<Record<string, HandlebarsTemplatePart>>}
     */
    #partDescriptors;

    /* -------------------------------------------- */

    /** @inheritDoc */
    _configureRenderOptions(options) {
      super._configureRenderOptions(options);
      this.#partDescriptors = Object.freeze(this._configureRenderParts(options));
      // Render all parts if we are rendering the root element
      if ( options.parts && options.parts.some(id => this.#partDescriptors[id]?.root) ) options.parts = undefined;
      options.parts ??= Object.keys(this.#partDescriptors);
    }

    /* -------------------------------------------- */

    /**
     * Allow subclasses to dynamically configure render parts.
     * @param {HandlebarsRenderOptions} options
     * @returns {Record<string, HandlebarsTemplatePart>}
     * @protected
     */
    _configureRenderParts(options) {
      const parts = foundry.utils.deepClone(this.constructor.PARTS);
      Object.values(parts).forEach(p => p.templates ??= []);
      return parts;
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    async _preRender(context, options) {
      await super._preRender(context, options);
      const allTemplates = new Set();
      for ( const part of Object.values(this.#partDescriptors) ) {
        allTemplates.add(part.template);
        part.templates ??= [];
        for ( const template of part.templates ) allTemplates.add(template);
      }
      await foundry.applications.handlebars.loadTemplates(Array.from(allTemplates));
    }

    /* -------------------------------------------- */

    /**
     * Render each configured application part using Handlebars templates.
     * @param {ApplicationRenderContext} context        Context data for the render operation
     * @param {HandlebarsRenderOptions} options         Options which configure application rendering behavior
     * @returns {Promise<Record<string, HTMLElement>>}  A single rendered HTMLElement for each requested part
     * @protected
     * @override
     */
    async _renderHTML(context, options) {
      const rendered = {};
      const partInfo = this.#partDescriptors;
      for ( const partId of options.parts ) {
        const part = partInfo[partId];
        if ( !part ) {
          ui.notifications.warn(`Part "${partId}" is not a supported template part for ${this.constructor.name}`);
          continue;
        }
        const partContext = await this._preparePartContext(partId, context, options);
        try {
          const htmlString = await foundry.applications.handlebars.renderTemplate(part.template, partContext);
          rendered[partId] = this.#parsePartHTML(partId, part, htmlString);
        } catch(err) {
          throw new Error(`Failed to render template part "${partId}":\n${err.message}`, {cause: err});
        }
      }
      return rendered;
    }

    /* -------------------------------------------- */

    /**
     * Prepare context that is specific to only a single rendered part.
     *
     * It is recommended to augment or mutate the shared context so that downstream methods like _onRender have
     * visibility into the data that was used for rendering. It is acceptable to return a different context object
     * rather than mutating the shared context at the expense of this transparency.
     *
     * @param {string} partId                         The part being rendered
     * @param {ApplicationRenderContext} context      Shared context provided by _prepareContext
     * @param {HandlebarsRenderOptions} options       Options which configure application rendering behavior
     * @returns {Promise<ApplicationRenderContext>}   Context data for a specific part
     * @protected
     */
    async _preparePartContext(partId, context, options) {
      context.partId = `${this.id}-${partId}`;
      return context;
    }

    /* -------------------------------------------- */

    /**
     * Parse the returned HTML string from template rendering into a uniquely identified HTMLElement for insertion.
     * @param {string} partId                   The id of the part being rendered
     * @param {HandlebarsTemplatePart} part     Configuration of the part being parsed
     * @param {string} htmlString               The string rendered for the part
     * @returns {HTMLElement}                   The parsed HTMLElement for the part
     */
    #parsePartHTML(partId, part, htmlString) {
      const tempEl = document.createElement("div");
      tempEl.innerHTML = htmlString;
      const isMultipartRoot = part.root && tempEl.children.length > 1;
      if ( (tempEl.children.length !== 1) && !isMultipartRoot ) {
        throw new Error(`Template part "${partId}" must render a single HTML element.`);
      }
      const element = isMultipartRoot ? tempEl : tempEl.firstElementChild;
      element.dataset.applicationPart = partId;
      if ( part.id ) element.id = `${this.id}-${part.id}`;
      if ( part.classes ) element.classList.add(...part.classes);
      return element;
    }

    /* -------------------------------------------- */

    /**
     * Replace the HTML of the application with the result provided by Handlebars rendering.
     * @param {Record<string, HTMLElement>} result  The result from Handlebars template rendering
     * @param {HTMLElement} content                 The content element into which the rendered result must be inserted
     * @param {HandlebarsRenderOptions} options     Options which configure application rendering behavior
     * @protected
     * @override
     */
    _replaceHTML(result, content, options) {
      const partInfo = this.#partDescriptors;
      for ( const [partId, htmlElement] of Object.entries(result) ) {
        const part = partInfo[partId];
        const priorElement = part.root ? content : content.querySelector(`[data-application-part="${partId}"]`);
        const state = {};
        if ( priorElement ) {
          this._preSyncPartState(partId, htmlElement, priorElement, state);
          if ( part.root ) priorElement.replaceChildren(...htmlElement.children);
          else priorElement.replaceWith(htmlElement);
          this._syncPartState(partId, htmlElement, priorElement, state);
        }
        else content.appendChild(htmlElement);
        this._attachPartListeners(partId, htmlElement, options);
        this.#parts[partId] = htmlElement;
      }
    }

    /* -------------------------------------------- */

    /**
     * Prepare data used to synchronize the state of a template part.
     * @param {string} partId                       The id of the part being rendered
     * @param {HTMLElement} newElement              The new rendered HTML element for the part
     * @param {HTMLElement} priorElement            The prior rendered HTML element for the part
     * @param {object} state                        A state object which is used to synchronize after replacement
     * @protected
     */
    _preSyncPartState(partId, newElement, priorElement, state) {
      const part = this.#partDescriptors[partId];

      // Focused element or field
      const focus = priorElement.querySelector(":focus");
      if ( focus?.id ) state.focus = `#${CSS.escape(focus.id)}`;
      else if ( focus?.name ) state.focus = `${focus.tagName}[name="${focus.name}"]`;
      else state.focus = undefined;

      // Scroll positions
      state.scrollPositions = [];
      for ( const selector of (part.scrollable || []) ) {
        const el0 = selector === "" ? priorElement : priorElement.querySelector(selector);
        if ( el0 ) {
          const el1 = selector === "" ? newElement : newElement.querySelector(selector);
          if ( el1 ) state.scrollPositions.push([el1, el0.scrollTop, el0.scrollLeft]);
        }
      }
    }

    /* -------------------------------------------- */

    /**
     * Synchronize the state of a template part after it has been rendered and replaced in the DOM.
     * @param {string} partId                       The id of the part being rendered
     * @param {HTMLElement} newElement              The new rendered HTML element for the part
     * @param {HTMLElement} priorElement            The prior rendered HTML element for the part
     * @param {object} state                        A state object which is used to synchronize after replacement
     * @protected
     */
    _syncPartState(partId, newElement, priorElement, state) {
      if ( state.focus ) {
        const newFocus = newElement.querySelector(state.focus);
        if ( newFocus ) newFocus.focus();
      }
      for ( const [el, scrollTop, scrollLeft] of state.scrollPositions ) Object.assign(el, {scrollTop, scrollLeft});
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    _tearDown(options) {
      super._tearDown(options);
      this.#parts = {};
    }

    /* -------------------------------------------- */
    /*  Event Listeners and Handlers                */
    /* -------------------------------------------- */

    /**
     * Attach event listeners to rendered template parts.
     * @param {string} partId                       The id of the part being rendered
     * @param {HTMLElement} htmlElement             The rendered HTML element for the part
     * @param {ApplicationRenderOptions} options    Rendering options passed to the render method
     * @protected
     */
    _attachPartListeners(partId, htmlElement, options) {
      const part = this.#partDescriptors[partId];

      // Attach form submission handlers
      if ( part.forms ) {
        for ( const [selector, formConfig] of Object.entries(part.forms) ) {
          const form = htmlElement.matches(selector) ? htmlElement : htmlElement.querySelector(selector);
          form.addEventListener("submit", this._onSubmitForm.bind(this, formConfig));
          form.addEventListener("change", this._onChangeForm.bind(this, formConfig));
        }
      }
    }
  }
  return HandlebarsApplication;
}

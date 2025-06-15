class KeyState {
  /**
   * Construct a KeyState object
   */
  constructor () {
    this._ctrlKeyState = false
    this._shiftKeyState = false
    document.addEventListener('keydown', (event) => this.handleEvent(event))
    document.addEventListener('keyup', (event) => this.handleEvent(event))
    document.addEventListener('click', (event) => this.handleEvent(event))
  }

  /**
   * Get the ctrl key's last seen state
   * @return {Boolean}  State of the ctrl key
   */
  get ctrlKey () {
    return this._ctrlKeyState
  }

  /**
   * Get the shift key's last seen state
   * @return {Boolean}  State of the shift key
   */
  get shiftKey () {
    return this._shiftKeyState
  }

  /**
   * Handle events to update our record of key states
   * Foundry convention is to treat the meta key like ctrl
   * @param event {Object}  The incoming event
   */
  handleEvent (event) {
    this._ctrlKeyState = (event.ctrlKey || event.metaKey)
    this._shiftKeyState = event.shiftKey
  }
}

export default KeyState

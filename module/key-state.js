class KeyState {
  /**
   * Construct a KeyState object
   */
  constructor () {
    this._ctrlKeyState = false
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
   * Handle events to update our record of key states
   * Foundry convention is to treat the meta key like ctrl
   * @param event {Object}  The incoming event
   */
  handleEvent (event) {
    this._ctrlKeyState = (event.ctrlKey || event.metaKey)
  }
}

export default KeyState

/**
 * Highlight critical success or failure on d20 rolls
 */
const highlightCriticalSuccessFailure = function (message, html, data) {
  if (!message.roll || !message.isContentVisible) return

  // Highlight rolls where the first part is a d20 roll
  const roll = message.roll
  if (!roll.dice.length) return
  const d = roll.dice[0]

  // Ensure it is a d20 roll
  const isD20 = (d.faces === 20) && (d.results.length === 1)
  if (!isD20) return

  // Highlight successes and failures
  if (d.total >= 20) html.find('.dice-total').addClass('critical')
  else if (d.total <= 1) html.find('.dice-total').addClass('fumble')
}

export default highlightCriticalSuccessFailure

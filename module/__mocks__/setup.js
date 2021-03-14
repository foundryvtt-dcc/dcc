/* global fail */

process.on('unhandledRejection', (err) => {
  fail(err)
})

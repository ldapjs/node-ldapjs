'use strict'

const { MAX_MSGID } = require('../constants')

/**
 * Compare a reference id with another id to determine "greater than or equal"
 * between the two values according to a sliding window.
 *
 * @param {integer} ref
 * @param {integer} comp
 *
 * @returns {boolean} `true` if the `comp` value is >= to the `ref` value
 * within the computed window, otherwise `false`.
 */
module.exports = function geWindow (ref, comp) {
  let max = ref + Math.floor(MAX_MSGID / 2)
  const min = ref
  if (max >= MAX_MSGID) {
    // Handle roll-over
    max = max - MAX_MSGID - 1
    return ((comp <= max) || (comp >= min))
  } else {
    return ((comp <= max) && (comp >= min))
  }
}

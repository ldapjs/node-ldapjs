'use strict'

const { MAX_MSGID } = require('../constants')

/**
 * Returns a function that generates message identifiers. According to RFC 4511
 * the identifers should be `(0, MAX_MSGID)`. The returned function handles
 * this and wraps around when the maximum has been reached.
 *
 * @param {integer} [start=0] Starting number in the identifier sequence.
 *
 * @returns {function} This function accepts no parameters and returns an
 * increasing sequence identifier each invocation until it reaches the maximum
 * identifier. At this point the sequence starts over.
 */
module.exports = function idGeneratorFactory (start = 0) {
  let currentID = start
  return function nextID () {
    const id = currentID + 1
    currentID = (id >= MAX_MSGID) ? 1 : id
    return currentID
  }
}

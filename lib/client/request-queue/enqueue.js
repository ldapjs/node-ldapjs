'use strict'

/**
 * Adds requests to the queue. If a timeout has been added to the queue then
 * this will freeze the queue with the newly added item, flush it, and then
 * unfreeze it when the queue has been cleared.
 *
 * @param {object} message An LDAP message object.
 * @param {object} expect An expectation object.
 * @param {object} emitter An event emitter or `null`.
 * @param {function} cb A callback to invoke when the request is finished.
 *
 * @returns {boolean} `true` if the requested was queued. `false` if the queue
 * is not accepting any requests.
 */
module.exports = function enqueue (message, expect, emitter, cb) {
  if (this._queue.length >= this.size || this._frozen) {
    return false
  }

  this._queue.add({ message, expect, emitter, cb })

  if (this.timeout === 0) return true
  if (this._timer === null) return true

  // A queue can have a specified time allotted for it to be cleared. If that
  // time has been reached, reject new entries until the queue has been cleared.
  this._timer = setTimeout(queueTimeout.bind(this), this.timeout)

  return true

  function queueTimeout () {
    this.freeze()
    this.purge()
  }
}

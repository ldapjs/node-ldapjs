'use strict'

/**
 * Invokes all requests in the queue by passing them to the supplied callback
 * function and then clears all items from the queue.
 *
 * @param {function} cb A function used to handle the requests.
 */
module.exports = function flush (cb) {
  if (this._timer) {
    clearTimeout(this._timer)
    this._timer = null
  }

  // We must get a local copy of the queue and clear it before iterating it.
  // The client will invoke this flush function _many_ times. If we try to
  // iterate it without a local copy and clearing first then we will overflow
  // the stack.
  const requests = Array.from(this._queue.values())
  this._queue.clear()
  for (const req of requests) {
    cb(req.message, req.expect, req.emitter, req.cb)
  }
}

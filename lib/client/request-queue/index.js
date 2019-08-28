'use strict'

const enqueue = require('./enqueue')
const flush = require('./flush')
const purge = require('./purge')

/**
 * Builds a request queue object and returns it.
 *
 * @param {object} [options]
 * @param {integer} [options.size] Maximum size of the request queue. Must be
 * a number greater than `0` if supplied. Default: `Infinity`.
 * @param {integer} [options.timeout] Time in milliseconds a queue has to
 * complete the requests it contains.
 *
 * @returns {object} A queue instance.
 */
module.exports = function requestQueueFactory (options) {
  const opts = Object.assign({}, options)
  const q = {
    size: (opts.size > 0) ? opts.size : Infinity,
    timeout: (opts.timeout > 0) ? opts.timeout : 0,
    _queue: new Set(),
    _timer: null,
    _frozen: false
  }

  q.enqueue = enqueue.bind(q)
  q.flush = flush.bind(q)
  q.purge = purge.bind(q)
  q.freeze = function freeze () {
    this._frozen = true
  }
  q.thaw = function thaw () {
    this._frozen = false
  }

  return q
}

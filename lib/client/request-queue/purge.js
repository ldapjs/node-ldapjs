'use strict'

const { TimeoutError } = require('../../errors')

/**
 * Flushes the queue by rejecting all pending requests with a timeout error.
 */
module.exports = function purge () {
  this.flush(function flushCB (a, b, c, cb) {
    cb(new TimeoutError('request queue timeout'))
  })
}

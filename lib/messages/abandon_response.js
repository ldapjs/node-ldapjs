// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const LDAPMessage = require('./result')
// var Protocol = require('../protocol')

/// --- API

function AbandonResponse (options) {
  options = options || {}
  assert.object(options)

  options.protocolOp = 0
  LDAPMessage.call(this, options)
}
util.inherits(AbandonResponse, LDAPMessage)
Object.defineProperties(AbandonResponse.prototype, {
  type: {
    get: function getType () { return 'AbandonResponse' },
    configurable: false
  }
})

AbandonResponse.prototype.end = function (_status) {}

AbandonResponse.prototype._json = function (j) {
  return j
}

/// --- Exports

module.exports = AbandonResponse

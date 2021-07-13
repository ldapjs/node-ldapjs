// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const LDAPMessage = require('./message')
const Protocol = require('../protocol')

/// --- API

function IntermediateResponse (options) {
  LDAPMessage.call(this, options)
  options = options || {}
  assert.object(options)
  assert.optionalString(options.responseName)
  assert.optionalString(options.responsevalue)

  this.responseName = options.responseName || undefined
  this.responseValue = options.responseValue || undefined

  options.protocolOp = Protocol.LDAP_REP_INTERMEDIATE
}
util.inherits(IntermediateResponse, LDAPMessage)
Object.defineProperties(IntermediateResponse.prototype, {
  type: {
    get: function getType () { return 'IntermediateResponse' },
    configurable: false
  },
  _dn: {
    get: function getDN () { return this.responseName },
    configurable: false
  },
  name: {
    get: function getName () { return this.responseName },
    set: function setName (val) {
      assert.string(val)
      this.responseName = val
    },
    configurable: false
  },
  value: {
    get: function getValue () { return this.responseValue },
    set: function (val) {
      assert.string(val)
      this.responseValue = val
    },
    configurable: false
  }
})

IntermediateResponse.prototype._parse = function (ber) {
  assert.ok(ber)

  if (ber.peek() === 0x8a) { this.responseName = ber.readString(0x8a) }
  if (ber.peek() === 0x8b) { this.responseValue = ber.readString(0x8b) }

  return true
}

IntermediateResponse.prototype._toBer = function (ber) {
  assert.ok(ber)

  if (this.responseName) { ber.writeString(this.responseName, 0x8a) }
  if (this.responseValue) { ber.writeString(this.responseValue, 0x8b) }

  return ber
}

IntermediateResponse.prototype._json = function (j) {
  assert.ok(j)

  j.responseName = this.responseName
  j.responseValue = this.responseValue

  return j
}

/// --- Exports

module.exports = IntermediateResponse

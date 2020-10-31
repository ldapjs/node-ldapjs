// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const LDAPMessage = require('./message')
const Protocol = require('../protocol')
const lassert = require('../assert')

/// --- API

function CompareRequest (options) {
  options = options || {}
  assert.object(options)
  assert.optionalString(options.attribute)
  assert.optionalString(options.value)
  lassert.optionalStringDN(options.entry)

  options.protocolOp = Protocol.LDAP_REQ_COMPARE
  LDAPMessage.call(this, options)

  this.entry = options.entry || null
  this.attribute = options.attribute || ''
  this.value = options.value || ''
}
util.inherits(CompareRequest, LDAPMessage)
Object.defineProperties(CompareRequest.prototype, {
  type: {
    get: function getType () { return 'CompareRequest' },
    configurable: false
  },
  _dn: {
    get: function getDN () { return this.entry },
    configurable: false
  }
})

CompareRequest.prototype._parse = function (ber) {
  assert.ok(ber)

  this.entry = ber.readString()

  ber.readSequence()
  this.attribute = ber.readString().toLowerCase()
  this.value = ber.readString()

  return true
}

CompareRequest.prototype._toBer = function (ber) {
  assert.ok(ber)

  ber.writeString(this.entry.toString())
  ber.startSequence()
  ber.writeString(this.attribute)
  ber.writeString(this.value)
  ber.endSequence()

  return ber
}

CompareRequest.prototype._json = function (j) {
  assert.ok(j)

  j.entry = this.entry.toString()
  j.attribute = this.attribute
  j.value = this.value

  return j
}

/// --- Exports

module.exports = CompareRequest

// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const LDAPMessage = require('./message')
const Protocol = require('../protocol')
const lassert = require('../assert')

/// --- API

function DeleteRequest (options) {
  options = options || {}
  assert.object(options)
  lassert.optionalStringDN(options.entry)

  options.protocolOp = Protocol.LDAP_REQ_DELETE
  LDAPMessage.call(this, options)

  this.entry = options.entry || null
}
util.inherits(DeleteRequest, LDAPMessage)
Object.defineProperties(DeleteRequest.prototype, {
  type: {
    get: function getType () { return 'DeleteRequest' },
    configurable: false
  },
  _dn: {
    get: function getDN () { return this.entry },
    configurable: false
  }
})

DeleteRequest.prototype._parse = function (ber, length) {
  assert.ok(ber)

  this.entry = ber.buffer.slice(0, length).toString('utf8')
  ber._offset += ber.length

  return true
}

DeleteRequest.prototype._toBer = function (ber) {
  assert.ok(ber)

  const buf = Buffer.from(this.entry.toString())
  for (let i = 0; i < buf.length; i++) { ber.writeByte(buf[i]) }

  return ber
}

DeleteRequest.prototype._json = function (j) {
  assert.ok(j)

  j.entry = this.entry

  return j
}

/// --- Exports

module.exports = DeleteRequest

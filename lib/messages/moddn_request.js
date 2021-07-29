// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const LDAPMessage = require('./message')
const Protocol = require('../protocol')
const dn = require('../dn')
const lassert = require('../assert')

/// --- API

function ModifyDNRequest (options) {
  options = options || {}
  assert.object(options)
  assert.optionalBool(options.deleteOldRdn)
  lassert.optionalStringDN(options.entry)
  lassert.optionalDN(options.newRdn)
  lassert.optionalDN(options.newSuperior)

  options.protocolOp = Protocol.LDAP_REQ_MODRDN
  LDAPMessage.call(this, options)

  this.entry = options.entry || null
  this.newRdn = options.newRdn || null
  this.deleteOldRdn = options.deleteOldRdn || true
  this.newSuperior = options.newSuperior || null
}
util.inherits(ModifyDNRequest, LDAPMessage)
Object.defineProperties(ModifyDNRequest.prototype, {
  type: {
    get: function getType () { return 'ModifyDNRequest' },
    configurable: false
  },
  _dn: {
    get: function getDN () { return this.entry },
    configurable: false
  }
})

ModifyDNRequest.prototype._parse = function (ber) {
  assert.ok(ber)

  this.entry = ber.readString()
  this.newRdn = dn.parse(ber.readString())
  this.deleteOldRdn = ber.readBoolean()
  if (ber.peek() === 0x80) { this.newSuperior = dn.parse(ber.readString(0x80)) }

  return true
}

ModifyDNRequest.prototype._toBer = function (ber) {
  // assert.ok(ber);

  ber.writeString(this.entry.toString())
  ber.writeString(this.newRdn.toString())
  ber.writeBoolean(this.deleteOldRdn)
  if (this.newSuperior) {
    const s = this.newSuperior.toString()
    const len = Buffer.byteLength(s)

    ber.writeByte(0x80) // MODIFY_DN_REQUEST_NEW_SUPERIOR_TAG
    ber.writeLength(len)
    ber._ensure(len)
    ber._buf.write(s, ber._offset)
    ber._offset += len
  }

  return ber
}

ModifyDNRequest.prototype._json = function (j) {
  assert.ok(j)

  j.entry = this.entry.toString()
  j.newRdn = this.newRdn.toString()
  j.deleteOldRdn = this.deleteOldRdn
  j.newSuperior = this.newSuperior ? this.newSuperior.toString() : ''

  return j
}

/// --- Exports

module.exports = ModifyDNRequest

// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const LDAPResult = require('./result')
const Protocol = require('../protocol')
const { LDAP_SASL_BIND_IN_PROGRESS } = require('../errors/codes')

/// --- API

function BindResponse (options) {
  options = options || {}
  assert.object(options)

  options.protocolOp = Protocol.LDAP_REP_BIND
  LDAPResult.call(this, options)
}
util.inherits(BindResponse, LDAPResult)

BindResponse.prototype._parse = function (ber) {
  assert.ok(ber)

  this.status = ber.readEnumeration()
  this.matchedDN = ber.readString()
  this.errorMessage = ber.readString()

  if (this.status === LDAP_SASL_BIND_IN_PROGRESS) {
    readByteString(ber, ber.buffer.length - 230)
    this.saslChallange = ber.buffer
  }

  return true
}

function readByteString (ber, len) { return String.fromCharCode(...range(0, len - 1).map(function () { return ber.readByte() })) }
function range (start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => i)
}

/// --- Exports

module.exports = BindResponse

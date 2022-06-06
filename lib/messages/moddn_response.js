// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const LDAPResult = require('./result')
const Protocol = require('@ldapjs/protocol')

/// --- API

function ModifyDNResponse (options) {
  options = options || {}
  assert.object(options)

  options.protocolOp = Protocol.operations.LDAP_RES_MODRDN
  LDAPResult.call(this, options)
}
util.inherits(ModifyDNResponse, LDAPResult)

/// --- Exports

module.exports = ModifyDNResponse

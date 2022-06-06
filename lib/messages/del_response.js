// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const LDAPResult = require('./result')
const Protocol = require('@ldapjs/protocol')

/// --- API

function DeleteResponse (options) {
  options = options || {}
  assert.object(options)

  options.protocolOp = Protocol.operations.LDAP_RES_DELETE
  LDAPResult.call(this, options)
}
util.inherits(DeleteResponse, LDAPResult)

/// --- Exports

module.exports = DeleteResponse

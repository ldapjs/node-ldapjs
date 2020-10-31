// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const LDAPResult = require('./result')
const Protocol = require('../protocol')

/// --- API

function ModifyResponse (options) {
  options = options || {}
  assert.object(options)

  options.protocolOp = Protocol.LDAP_REP_MODIFY
  LDAPResult.call(this, options)
}
util.inherits(ModifyResponse, LDAPResult)

/// --- Exports

module.exports = ModifyResponse

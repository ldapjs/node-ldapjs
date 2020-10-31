// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const LDAPResult = require('./result')
const Protocol = require('../protocol')

/// --- API

function AddResponse (options) {
  options = options || {}
  assert.object(options)

  options.protocolOp = Protocol.LDAP_REP_ADD
  LDAPResult.call(this, options)
}
util.inherits(AddResponse, LDAPResult)

/// --- Exports

module.exports = AddResponse

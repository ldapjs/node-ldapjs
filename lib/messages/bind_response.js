// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const LDAPResult = require('./result')
const Protocol = require('../protocol')

/// --- API

function BindResponse (options) {
  options = options || {}
  assert.object(options)

  options.protocolOp = Protocol.LDAP_REP_BIND
  LDAPResult.call(this, options)
}
util.inherits(BindResponse, LDAPResult)

/// --- Exports

module.exports = BindResponse

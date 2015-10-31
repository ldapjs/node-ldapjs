// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var util = require('util');

var LDAPResult = require('./result');
var Protocol = require('../protocol');


///--- API

function AddResponse(options) {
  options = options || {};
  assert.object(options);

  options.protocolOp = Protocol.LDAP_REP_ADD;
  LDAPResult.call(this, options);
}
util.inherits(AddResponse, LDAPResult);


///--- Exports

module.exports = AddResponse;

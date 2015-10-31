// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var util = require('util');

var LDAPResult = require('./result');
var Protocol = require('../protocol');


///--- API

function DeleteResponse(options) {
  options = options || {};
  assert.object(options);

  options.protocolOp = Protocol.LDAP_REP_DELETE;
  LDAPResult.call(this, options);
}
util.inherits(DeleteResponse, LDAPResult);


///--- Exports

module.exports = DeleteResponse;

// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var util = require('util');

var LDAPResult = require('./result');
var Protocol = require('../protocol');


///--- API

function BindResponse(options) {
  options = options || {};
  assert.object(options);

  options.protocolOp = Protocol.LDAP_REP_BIND;
  LDAPResult.call(this, options);
}
util.inherits(BindResponse, LDAPResult);

BindResponse.prototype._parse = function(ber) {
  assert.ok(ber)

  if (!LDAPResult.prototype._parse.call(this, ber)) {
    return false
  }
  const saslCredentials = ber.readString(135)
  if (saslCredentials) {
    this.saslCredentials = saslCredentials
  }

  return true
}



///--- Exports

module.exports = BindResponse;

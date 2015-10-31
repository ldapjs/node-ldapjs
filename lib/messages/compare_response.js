// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var util = require('util');

var LDAPResult = require('./result');
var Protocol = require('../protocol');


///--- API

function CompareResponse(options) {
  options = options || {};
  assert.object(options);

  options.protocolOp = Protocol.LDAP_REP_COMPARE;
  LDAPResult.call(this, options);
}
util.inherits(CompareResponse, LDAPResult);

CompareResponse.prototype.end = function (matches) {
  var status = 0x06;
  if (typeof (matches) === 'boolean') {
    if (!matches)
      status = 0x05; // Compare false
  } else {
    status = matches;
  }

  return LDAPResult.prototype.end.call(this, status);
};


///--- Exports

module.exports = CompareResponse;

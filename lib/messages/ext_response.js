// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var util = require('util');

var LDAPResult = require('./result');
var Protocol = require('../protocol');


///--- API

function ExtendedResponse(options) {
  options = options || {};
  assert.object(options);
  assert.optionalString(options.responseName);
  assert.optionalString(options.responsevalue);

  this.responseName = options.responseName || undefined;
  this.responseValue = options.responseValue || undefined;

  options.protocolOp = Protocol.LDAP_REP_EXTENSION;
  LDAPResult.call(this, options);
}
util.inherits(ExtendedResponse, LDAPResult);
Object.defineProperties(ExtendedResponse.prototype, {
  type: {
    get: function getType() { return 'ExtendedResponse'; },
    configurable: false
  },
  _dn: {
    get: function getDN() { return this.responseName; },
    configurable: false
  },
  name: {
    get: function getName() { return this.responseName; },
    set: function setName(val) {
      assert.string(val);
      this.responseName = val;
    },
    configurable: false
  },
  value: {
    get: function getValue() { return this.responseValue; },
    set: function (val) {
      assert.string(val);
      this.responseValue = val;
    },
    configurable: false
  }
});

ExtendedResponse.prototype._parse = function (ber) {
  assert.ok(ber);

  if (!LDAPResult.prototype._parse.call(this, ber))
    return false;

  if (ber.peek() === 0x8a)
    this.responseName = ber.readString(0x8a);
  if (ber.peek() === 0x8b)
    this.responseValue = ber.readString(0x8b);

  return true;
};

ExtendedResponse.prototype._toBer = function (ber) {
  assert.ok(ber);

  if (!LDAPResult.prototype._toBer.call(this, ber))
    return false;

  if (this.responseName)
    ber.writeString(this.responseName, 0x8a);
  if (this.responseValue)
    ber.writeString(this.responseValue, 0x8b);

  return ber;
};

ExtendedResponse.prototype._json = function (j) {
  assert.ok(j);

  j = LDAPResult.prototype._json.call(this, j);

  j.responseName = this.responseName;
  j.responseValue = this.responseValue;

  return j;
};


///--- Exports

module.exports = ExtendedResponse;

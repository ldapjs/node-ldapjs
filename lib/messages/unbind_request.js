// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var util = require('util');

var LDAPMessage = require('./message');
var dn = require('../dn');
var Protocol = require('../protocol');


///--- Globals

var DN = dn.DN;
var RDN = dn.RDN;


///--- API

function UnbindRequest(options) {
  options = options || {};
  assert.object(options);

  options.protocolOp = Protocol.LDAP_REQ_UNBIND;
  LDAPMessage.call(this, options);
}
util.inherits(UnbindRequest, LDAPMessage);
Object.defineProperties(UnbindRequest.prototype, {
  type: {
    get: function getType() { return 'UnbindRequest'; },
    configurable: false
  },
  _dn: {
    get: function getDN() {
      if (this.connection) {
        return this.connection.ldap.bindDN;
      } else {
        return new DN([new RDN({cn: 'anonymous'})]);
      }
    },
    configurable: false
  }
});

UnbindRequest.prototype._parse = function (ber) {
  assert.ok(ber);

  return true;
};

UnbindRequest.prototype._toBer = function (ber) {
  assert.ok(ber);

  return ber;
};

UnbindRequest.prototype._json = function (j) {
  assert.ok(j);

  return j;
};


///--- Exports

module.exports = UnbindRequest;

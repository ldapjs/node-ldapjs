// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var util = require('util');

var asn1 = require('asn1');

var LDAPMessage = require('./message');
var Protocol = require('../protocol');


///--- Globals

var Ber = asn1.Ber;
var LDAP_BIND_SIMPLE = 'simple';
var LDAP_BIND_SASL = 'sasl';


///--- API

function BindRequest(options) {
  options = options || {};
  assert.object(options);

  options.protocolOp = Protocol.LDAP_REQ_BIND;
  LDAPMessage.call(this, options);

  this.version = options.version || 0x03;
  this.name = options.name || null;
  this.authentication = options.authentication || LDAP_BIND_SIMPLE;
  this.credentials = options.credentials || '';
}
util.inherits(BindRequest, LDAPMessage);
Object.defineProperties(BindRequest.prototype, {
  type: {
    get: function getType() { return 'BindRequest'; },
    configurable: false
  },
  _dn: {
    get: function getDN() { return this.name; },
    configurable: false
  }
});

BindRequest.prototype._parse = function (ber) {
  assert.ok(ber);

  this.version = ber.readInt();
  this.name = ber.readString();

  var t = ber.peek();

  // TODO add support for SASL et al
  if (t !== Ber.Context)
    throw new Error('authentication 0x' + t.toString(16) + ' not supported');

  this.authentication = LDAP_BIND_SIMPLE;
  this.credentials = ber.readString(Ber.Context);

  return true;
};

BindRequest.prototype._toBer = function (ber) {
  assert.ok(ber);

  ber.writeInt(this.version);
  ber.writeString((this.name || '').toString());
  // TODO add support for SASL et al
  ber.writeString((this.credentials || ''), Ber.Context);

  return ber;
};

BindRequest.prototype._json = function (j) {
  assert.ok(j);

  j.version = this.version;
  j.name = this.name;
  j.authenticationType = this.authentication;
  j.credentials = this.credentials;

  return j;
};


///--- Exports

module.exports = BindRequest;

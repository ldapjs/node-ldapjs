// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var util = require('util');

var LDAPMessage = require('./message');
var Change = require('../change');
var Protocol = require('../protocol');
var lassert = require('../assert');


///--- API

function ModifyRequest(options) {
  options = options || {};
  assert.object(options);
  lassert.optionalStringDN(options.object);
  lassert.optionalArrayOfAttribute(options.attributes);

  options.protocolOp = Protocol.LDAP_REQ_MODIFY;
  LDAPMessage.call(this, options);

  this.object = options.object || null;
  this.changes = options.changes ? options.changes.slice(0) : [];
}
util.inherits(ModifyRequest, LDAPMessage);
Object.defineProperties(ModifyRequest.prototype, {
  type: {
    get: function getType() { return 'ModifyRequest'; },
    configurable: false
  },
  _dn: {
    get: function getDN() { return this.object; },
    configurable: false
  }
});

ModifyRequest.prototype._parse = function (ber) {
  assert.ok(ber);

  this.object = ber.readString();

  ber.readSequence();
  var end = ber.offset + ber.length;
  while (ber.offset < end) {
    var c = new Change();
    c.parse(ber);
    c.modification.type = c.modification.type.toLowerCase();
    this.changes.push(c);
  }

  this.changes.sort(Change.compare);
  return true;
};

ModifyRequest.prototype._toBer = function (ber) {
  assert.ok(ber);

  ber.writeString(this.object.toString());
  ber.startSequence();
  this.changes.forEach(function (c) {
    c.toBer(ber);
  });
  ber.endSequence();

  return ber;
};

ModifyRequest.prototype._json = function (j) {
  assert.ok(j);

  j.object = this.object;
  j.changes = [];

  this.changes.forEach(function (c) {
    j.changes.push(c.json);
  });

  return j;
};


///--- Exports

module.exports = ModifyRequest;

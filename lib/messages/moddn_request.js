// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var LDAPMessage = require('./message');
var Protocol = require('../protocol');
var dn = require('../dn');


///--- Globals

var isDN = dn.DN.isDN;


///--- API

function ModifyDNRequest(options) {
  if (options) {
    if (typeof (options) !== 'object')
      throw new TypeError('options must be an object');
    if (options.entry &&
        !(isDN(options.entry) || typeof (options.entry) === 'string')) {
      throw new TypeError('options.entry must be a DN or string');
    }
    if (options.newRdn && !isDN(options.newRdn))
      throw new TypeError('options.newRdn must be a DN');
    if (options.deleteOldRdn !== undefined &&
        typeof (options.deleteOldRdn) !== 'boolean')
      throw new TypeError('options.deleteOldRdn must be a boolean');
    if (options.newSuperior && !isDN(options.newSuperior))
      throw new TypeError('options.newSuperior must be a DN');

  } else {
    options = {};
  }

  options.protocolOp = Protocol.LDAP_REQ_MODRDN;
  LDAPMessage.call(this, options);

  this.entry = options.entry || null;
  this.newRdn = options.newRdn || null;
  this.deleteOldRdn = options.deleteOldRdn || true;
  this.newSuperior = options.newSuperior || null;

  var self = this;
  this.__defineGetter__('type', function () { return 'ModifyDNRequest'; });
  this.__defineGetter__('_dn', function () { return self.entry; });
}
util.inherits(ModifyDNRequest, LDAPMessage);
module.exports = ModifyDNRequest;


ModifyDNRequest.prototype._parse = function (ber) {
  assert.ok(ber);

  this.entry = ber.readString();
  this.newRdn = dn.parse(ber.readString());
  this.deleteOldRdn = ber.readBoolean();
  if (ber.peek() === 0x80)
    this.newSuperior = dn.parse(ber.readString(0x80));

  return true;
};


ModifyDNRequest.prototype._toBer = function (ber) {
  //assert.ok(ber);

  ber.writeString(this.entry.toString());
  ber.writeString(this.newRdn.toString());
  ber.writeBoolean(this.deleteOldRdn);
  if (this.newSuperior) {
    var s = this.newSuperior.toString();
    var len = Buffer.byteLength(s);

    ber.writeByte(0x80); // MODIFY_DN_REQUEST_NEW_SUPERIOR_TAG
    ber.writeByte(len);
    ber._ensure(len);
    ber._buf.write(s, ber._offset);
    ber._offset += len;
  }

  return ber;
};


ModifyDNRequest.prototype._json = function (j) {
  assert.ok(j);

  j.entry = this.entry.toString();
  j.newRdn = this.newRdn.toString();
  j.deleteOldRdn = this.deleteOldRdn;
  j.newSuperior = this.newSuperior ? this.newSuperior.toString() : '';

  return j;
};

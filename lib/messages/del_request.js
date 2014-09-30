// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var LDAPMessage = require('./message');
var dn = require('../dn');
var Protocol = require('../protocol');



///--- Globals

var isDN = dn.DN.isDN;


///--- API

function DeleteRequest(options) {
  if (options) {
    if (typeof (options) !== 'object')
      throw new TypeError('options must be an object');
    if (options.entry &&
        !(isDN(options.entry) || typeof (options.entry) === 'string')) {
      throw new TypeError('options.entry must be a DN or string');
    }
  } else {
    options = {};
  }

  options.protocolOp = Protocol.LDAP_REQ_DELETE;
  LDAPMessage.call(this, options);

  this.entry = options.entry || null;

  var self = this;
  this.__defineGetter__('type', function () { return 'DeleteRequest'; });
  this.__defineGetter__('_dn', function () { return self.entry; });
}
util.inherits(DeleteRequest, LDAPMessage);
module.exports = DeleteRequest;


DeleteRequest.prototype._parse = function (ber, length) {
  assert.ok(ber);

  this.entry = ber.buffer.slice(0, length).toString('utf8');
  ber._offset += ber.length;

  return true;
};


DeleteRequest.prototype._toBer = function (ber) {
  assert.ok(ber);

  var buf = new Buffer(this.entry.toString());
  for (var i = 0; i < buf.length; i++)
    ber.writeByte(buf[i]);

  return ber;
};


DeleteRequest.prototype._json = function (j) {
  assert.ok(j);

  j.entry = this.entry;

  return j;
};

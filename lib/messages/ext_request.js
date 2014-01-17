// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var asn1 = require('asn1');

var LDAPMessage = require('./message');
var LDAPResult = require('./result');

var dn = require('../dn');
var Protocol = require('../protocol');



///--- Globals

var Ber = asn1.Ber;



///--- API

function ExtendedRequest(options) {
  if (options) {
    if (typeof (options) !== 'object')
      throw new TypeError('options must be an object');
    if (options.requestName && typeof (options.requestName) !== 'string')
      throw new TypeError('options.requestName must be a string');
    if (options.requestValue && !(Buffer.isBuffer(options.requestValue) ||
                                  typeof (options.requestValue) === 'string'))
      throw new TypeError('options.requestValue must be a buffer or a string');
  } else {
    options = {};
  }

  options.protocolOp = Protocol.LDAP_REQ_EXTENSION;
  LDAPMessage.call(this, options);

  this.requestName = options.requestName || '';
  this.requestValue = options.requestValue;

  this.__defineGetter__('type', function () { return 'ExtendedRequest'; });
  this.__defineGetter__('_dn', function () { return this.requestName; });
  this.__defineGetter__('name', function () {
    return this.requestName;
  });
  this.__defineGetter__('value', function () {
    return this.requestValue;
  });
  this.__defineSetter__('name', function (name) {
    if (typeof (name) !== 'string')
      throw new TypeError('name must be a string');

    this.requestName = name;
  });
  this.__defineSetter__('value', function (val) {
    if (!(Buffer.isBuffer(val) || typeof (val) === 'string'))
      throw new TypeError('value must be a buffer or a string');

    this.requestValue = val;
  });
}
util.inherits(ExtendedRequest, LDAPMessage);
module.exports = ExtendedRequest;


ExtendedRequest.prototype._parse = function (ber) {
  assert.ok(ber);

  this.requestName = ber.readString(0x80);
  if (ber.peek() === 0x81)
    try {
      this.requestValue = ber.readString(0x81);
    } catch (e) {
      this.requestValue = ber.readBuffer(0x81);
    }

  return true;
};


ExtendedRequest.prototype._toBer = function (ber) {
  assert.ok(ber);

  ber.writeString(this.requestName, 0x80);
  if (Buffer.isBuffer(this.requestValue))
    ber.writeBuffer(this.requestValue, 0x81);
  else {
    ber.writeString(this.requestValue, 0x81);
  }

  return ber;
};


ExtendedRequest.prototype._json = function (j) {
  assert.ok(j);

  j.requestName = this.requestName;
  j.requestValue = (Buffer.isBuffer(this.requestValue)) ?
    this.requestValue.toString('hex') : this.requestValue;

  return j;
};

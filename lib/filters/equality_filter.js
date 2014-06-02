// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var ASN1 = require('asn1').Ber;

var escape = require('./escape').escape;

var Filter = require('./filter');

var Protocol = require('../protocol');



///--- API

function EqualityFilter(options) {
  if (typeof (options) === 'object') {
    if (!options.attribute || typeof (options.attribute) !== 'string')
      throw new TypeError('options.attribute (string) required');
    if (!options.value)
      throw new TypeError('options.value required');
  } else {
    this.raw = new Buffer(0);
    options = {};
  }
  options.type = Protocol.FILTER_EQUALITY;
  Filter.call(this, options);

  var self = this;
  this.__defineGetter__('value', function () {
    return self.raw.toString();
  });
  this.__defineSetter__('value', function (data) {
    if (typeof (data) === 'string') {
      self.raw = new Buffer(data);
    } else if (Buffer.isBuffer(data)) {
      self.raw = new Buffer(data.length);
      data.copy(self.raw);
    } else {
      throw new TypeError('value (string|buffer) required');
    }
  });
  this.__defineGetter__('json', function () {
    return {
      type: 'EqualityMatch',
      attribute: self.attribute || undefined,
      value: self.value || undefined
    };
  });
  if (options.attribute !== undefined && options.value !== undefined) {
    this.attribute = options.attribute;
    this.value = options.value;
  }
}
util.inherits(EqualityFilter, Filter);
module.exports = EqualityFilter;


EqualityFilter.prototype.toString = function () {
  return '(' + escape(this.attribute) + '=' + escape(this.value) + ')';
};


EqualityFilter.prototype.matches = function (target) {
  if (typeof (target) !== 'object')
    throw new TypeError('target (object) required');

  var self = this;
  var tv = Filter.get_attr_caseless(target, this.attribute);

  if (tv !== null) {
    var value = this.value;
    return Filter.multi_test(
      function (v) {
        if (self.attribute === 'objectclass')
          v = v.toLowerCase();
        return value === v;
      },
      tv);
  }

  return false;
};


EqualityFilter.prototype.parse = function (ber) {
  assert.ok(ber);

  this.attribute = ber.readString().toLowerCase();
  this.value = ber.readString(ASN1.OctetString, true);

  if (this.attribute === 'objectclass')
    this.value = this.value.toLowerCase();

  return true;
};


EqualityFilter.prototype._toBer = function (ber) {
  assert.ok(ber);

  ber.writeString(this.attribute);
  ber.writeBuffer(this.raw, ASN1.OctetString);

  return ber;
};

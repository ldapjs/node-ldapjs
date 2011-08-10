// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');

var Protocol = require('./protocol');



///--- API

function Attribute(options) {
  if (options) {
    if (typeof(options) !== 'object')
      throw new TypeError('options must be an object');
    if (options.type && typeof(options.type) !== 'string')
      throw new TypeError('options.type must be a string');
    if (options.vals && !Array.isArray(options.vals))
      throw new TypeErrr('options.vals must be an array[string]');
    if (options.vals && options.vals.length) {
      options.vals.forEach(function(v) {
        if (typeof(v) !== 'string')
          throw new TypeErrr('options.vals must be an array[string]');
      });
    }
  } else {
    options = {};
  }

  this.type = options.type || '';
  this.vals = options.vals ? options.vals.slice(0) : [];

  var self = this;
  this.__defineGetter__('json', function() {
    return {
      type: self.type,
      vals: self.vals
    };
  });
}
module.exports = Attribute;


Attribute.compare = function(a, b) {
  if (!(a instanceof Attribute) || !(b instanceof Attribute))
    throw new TypeError('can only compare Attributes');

  if (a.type < b.type) return -1;
  if (a.type > b.type) return 1;
  if (a.vals.length < b.vals.length) return -1;
  if (a.vals.length > b.vals.length) return 1;

  for (var i = 0; i < a.vals.length; i++) {
    if (a.vals[i] < b.vals[i]) return -1;
    if (a.vals[i] > b.vals[i]) return 1;
  }

  return 0;
};

Attribute.prototype.addValue = function(val) {
  if (typeof(val) !== 'string')
    throw new TypeError('val (string) required');

  this.vals.push(val);
};


Attribute.prototype.parse = function(ber) {
  assert.ok(ber);

  ber.readSequence();
  this.type = ber.readString().toLowerCase();


  if (ber.readSequence(Protocol.LBER_SET)) {
    var end = ber.offset + ber.length;
    while (ber.offset < end)
      this.vals.push(ber.readString());

  }

  return true;
};


Attribute.prototype.toBer = function(ber) {
  assert.ok(ber);

  ber.startSequence();
  ber.writeString(this.type);
  if (this.vals && this.vals.length) {
    ber.startSequence(Protocol.LBER_SET);
    ber.writeStringArray(this.vals);
    ber.endSequence();
  }
  ber.endSequence();

  return ber;
};

Attribute.toBer = function(attr, ber) {
  return Attribute.prototype.toBer.call(attr, ber);
};


Attribute.isAttribute = function(attr) {
  if (!attr) return false;
  if (typeof(attr) !== 'object') return false;
  if (attr instanceof Attribute) return true;
  if (!attr.type || typeof(attr.type) !== 'string') return false;
  if (!attr.vals || !Array.isArray(attr.vals)) return false;
  for (var i = 0; i < attr.vals.length; i++)
    if (typeof(attr.vals[i]) !== 'string') return false;

  return true;
};


Attribute.prototype.toString = function() {
  return JSON.stringify(this.json);
};

// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');

var Attribute = require('./attribute');
var Protocol = require('./protocol');



///--- API

function Change(options) {
  if (options) {
    if (typeof(options) !== 'object')
      throw new TypeError('options must be an object');
    if (options.operation && typeof(options.operation) !== 'string')
      throw new TypeError('options.operation must be a string');
  } else {
    options = {};
  }

  var self = this;
  this.__defineGetter__('operation', function() {
    switch (self._operation) {
    case 0x00: return 'Add';
    case 0x01: return 'Delete';
    case 0x02: return 'Replace';
    default: return 'Invalid';
    }
  });
  this.__defineSetter__('operation', function(val) {
    if (typeof(val) !== 'string')
      throw new TypeError('operation must be a string');

    switch (val.toLowerCase()) {
    case 'add':
      self._operation = 0x00;
      break;
    case 'delete':
      self._operation = 0x01;
      break;
    case 'replace':
      self._operation = 0x02;
      break;
    default:
      throw new Error('Invalid operation type: 0x' + val.toString(16));
    }
  });
  this.__defineGetter__('modification', function() {
    return self._modification;
  });
  this.__defineSetter__('modification', function(attr) {
    if (Attribute.isAttribute(attr))
      self._modification = attr;
    Object.keys(attr).forEach(function(k) {
      var _attr = new Attribute({type: k});
      if (Array.isArray(attr[k])) {
        attr[k].forEach(function(v) {
          _attr.addValue(v.toString());
        });
      } else {
        _attr.addValue(attr[k].toString());
      }
      self._modification = _attr;
    });
  });
  this.__defineGetter__('json', function() {
    return {
      operation: self.operation,
      modification: self.modification ? self.modification.json : {}
    };
  });

  this.operation = options.operation || 'add';
  this.modification = options.modification || {};
}
module.exports = Change;


Change.prototype.parse = function(ber) {
  assert.ok(ber);

  ber.readSequence();
  this._operation = ber.readEnumeration();
  this._modification = new Attribute();
  this._modification.parse(ber);

  return true;
};


Change.prototype.toBer = function(ber) {
  assert.ok(ber);

  ber.startSequence();
  ber.writeEnumeration(this._operation);
  ber = this._modification.toBer(ber);
  ber.endSequence();

  return ber;
};

// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');

var asn1 = require('asn1');


var Protocol = require('../protocol');



///--- Globals

var BerWriter = asn1.BerWriter;



///--- API

function Filter(options) {
  if (!options || typeof (options) !== 'object')
    throw new TypeError('options (object) required');
  if (typeof (options.type) !== 'number')
    throw new TypeError('options.type (number) required');

  this._type = options.type;

  var self = this;
  this.__defineGetter__('type', function () {
    switch (self._type) {
    case Protocol.FILTER_AND: return 'and';
    case Protocol.FILTER_OR: return 'or';
    case Protocol.FILTER_NOT: return 'not';
    case Protocol.FILTER_EQUALITY: return 'equal';
    case Protocol.FILTER_SUBSTRINGS: return 'substring';
    case Protocol.FILTER_GE: return 'ge';
    case Protocol.FILTER_LE: return 'le';
    case Protocol.FILTER_PRESENT: return 'present';
    case Protocol.FILTER_APPROX: return 'approx';
    case Protocol.FILTER_EXT: return 'ext';
    default:
      throw new Error('0x' + self._type.toString(16) +
                      ' is an invalid search filter');
    }
  });
}
module.exports = Filter;


Filter.prototype.toBer = function (ber) {
  if (!ber || !(ber instanceof BerWriter))
    throw new TypeError('ber (BerWriter) required');

  ber.startSequence(this._type);
  ber = this._toBer(ber);
  ber.endSequence();
  return ber;
};


// Test a rule against one or more values.
Filter.multi_test = function (rule, value) {
  if (Array.isArray(value)) {
    var response = false;
    for (var i = 0; i < value.length; i++) {
      if (rule(value[i])) {
        response = true;
        break;
      }
    }
    return response;
  } else {
    return rule(value);
  }
};

// Search object for attribute, insensitive to case
Filter.get_attr_caseless = function (target, attr) {
  // Check for exact case match first
  if (target.hasOwnProperty(attr)) {
    return target[attr];
  }
  // Perform case-insensitive enumeration after that
  var lower = attr.toLowerCase();
  var result = null;
  Object.getOwnPropertyNames(target).some(function (item) {
    if (item.toLowerCase() == lower) {
      result = target[item];
      return true;
    }
    return false;
  });
  return result;
};

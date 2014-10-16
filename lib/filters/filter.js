// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');

var asn1 = require('asn1');

var Protocol = require('../protocol');


///--- Globals

var BerWriter = asn1.BerWriter;

var TYPES = {
  'and':       Protocol.FILTER_AND,
  'or':        Protocol.FILTER_OR,
  'not':       Protocol.FILTER_NOT,
  'equal':     Protocol.FILTER_EQUALITY,
  'substring': Protocol.FILTER_SUBSTRINGS,
  'ge':        Protocol.FILTER_GE,
  'le':        Protocol.FILTER_LE,
  'present':   Protocol.FILTER_PRESENT,
  'approx':    Protocol.FILTER_APPROX,
  'ext':       Protocol.FILTER_EXT
};


///--- API

function isFilter(filter) {
  if (!filter || typeof (filter) !== 'object') {
    return false;
  }
  // Do our best to duck-type it
  if (typeof (filter.toBer) === 'function' &&
      typeof (filter.matches) === 'function' &&
      TYPES[filter.type] !== undefined) {
    return true;
  }
  return false;
}

function mixin(target) {
  target.prototype.toBer = function toBer(ber) {
    if (!ber || !(ber instanceof BerWriter))
      throw new TypeError('ber (BerWriter) required');

    ber.startSequence(TYPES[this.type]);
    ber = this._toBer(ber);
    ber.endSequence();
    return ber;
  };
}

module.exports = {
  isFilter: isFilter,
  mixin: mixin
};

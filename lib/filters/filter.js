// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

// var assert = require('assert')

const Protocol = require('@ldapjs/protocol')

/// --- Globals

const TYPES = {
  and: Protocol.search.FILTER_AND,
  or: Protocol.search.FILTER_OR,
  not: Protocol.search.FILTER_NOT,
  equal: Protocol.search.FILTER_EQUALITY,
  substring: Protocol.search.FILTER_SUBSTRINGS,
  ge: Protocol.search.FILTER_GE,
  le: Protocol.search.FILTER_LE,
  present: Protocol.search.FILTER_PRESENT,
  approx: Protocol.search.FILTER_APPROX,
  ext: Protocol.search.FILTER_EXT
}

/// --- API

function isBerWriter (ber) {
  return Boolean(
    ber &&
    typeof (ber) === 'object' &&
    typeof (ber.startSequence) === 'function' &&
    typeof (ber.endSequence) === 'function'
  )
}

function mixin (target) {
  target.prototype.toBer = function toBer (ber) {
    if (isBerWriter(ber) === false) { throw new TypeError('ber (BerWriter) required') }

    ber.startSequence(TYPES[this.type])
    ber = this._toBer(ber)
    ber.endSequence()
    return ber
  }
}

module.exports = {
  mixin: mixin
}

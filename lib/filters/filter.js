// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

// var assert = require('assert')

const Protocol = require('@ldapjs/protocol')
// TODO: fix when base object is exported from package
const FilterString = require('@ldapjs/filter/lib/filter-string')

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

function isFilter (filter) {
  if (!filter || typeof (filter) !== 'object') {
    return false
  }
  // Do our best to duck-type it
  if (typeof (filter.toBer) === 'function' &&
      typeof (filter.matches) === 'function' &&
      TYPES[filter.type] !== undefined) {
    return true
  }
  if (filter instanceof FilterString) { return true }
  return false
}

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
  isFilter: isFilter,
  mixin: mixin
}

// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert')
const util = require('util')

const parents = require('ldap-filter')

const Filter = require('./filter')

/// --- API

function AndFilter (options) {
  parents.AndFilter.call(this, options)
}
util.inherits(AndFilter, parents.AndFilter)
Filter.mixin(AndFilter)
module.exports = AndFilter

AndFilter.prototype._toBer = function (ber) {
  assert.ok(ber)

  this.filters.forEach(function (f) {
    ber = f.toBer(ber)
  })

  return ber
}

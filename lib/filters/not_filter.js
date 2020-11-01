// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert')
const util = require('util')

const parents = require('ldap-filter')

const Filter = require('./filter')

/// --- API

function NotFilter (options) {
  parents.NotFilter.call(this, options)
}
util.inherits(NotFilter, parents.NotFilter)
Filter.mixin(NotFilter)
module.exports = NotFilter

NotFilter.prototype._toBer = function (ber) {
  assert.ok(ber)

  return this.filter.toBer(ber)
}

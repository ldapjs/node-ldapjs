// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert')
const util = require('util')

const parents = require('@ldapjs/filter')

const Filter = require('./filter')

/// --- API

function PresenceFilter (options) {
  parents.PresenceFilter.call(this, options)
}
util.inherits(PresenceFilter, parents.PresenceFilter)
Filter.mixin(PresenceFilter)
module.exports = PresenceFilter

PresenceFilter.prototype.parse = function (ber) {
  assert.ok(ber)

  this.attribute =
    ber.buffer.slice(0, ber.length).toString('utf8').toLowerCase()

  ber._offset += ber.length

  return true
}

PresenceFilter.prototype._toBer = function (ber) {
  assert.ok(ber)

  for (let i = 0; i < this.attribute.length; i++) { ber.writeByte(this.attribute.charCodeAt(i)) }

  return ber
}

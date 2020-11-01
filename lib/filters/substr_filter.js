// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert')
const util = require('util')

const parents = require('ldap-filter')

const Filter = require('./filter')

/// --- API

function SubstringFilter (options) {
  parents.SubstringFilter.call(this, options)
}
util.inherits(SubstringFilter, parents.SubstringFilter)
Filter.mixin(SubstringFilter)
module.exports = SubstringFilter

SubstringFilter.prototype.parse = function (ber) {
  assert.ok(ber)

  this.attribute = ber.readString().toLowerCase()
  ber.readSequence()
  const end = ber.offset + ber.length

  while (ber.offset < end) {
    const tag = ber.peek()
    switch (tag) {
      case 0x80: // Initial
        this.initial = ber.readString(tag)
        if (this.attribute === 'objectclass') { this.initial = this.initial.toLowerCase() }
        break
      case 0x81: { // Any
        let anyVal = ber.readString(tag)
        if (this.attribute === 'objectclass') { anyVal = anyVal.toLowerCase() }
        this.any.push(anyVal)
        break
      }
      case 0x82: // Final
        this.final = ber.readString(tag)
        if (this.attribute === 'objectclass') { this.final = this.final.toLowerCase() }
        break
      default:
        throw new Error('Invalid substrings filter type: 0x' + tag.toString(16))
    }
  }

  return true
}

SubstringFilter.prototype._toBer = function (ber) {
  assert.ok(ber)

  ber.writeString(this.attribute)
  ber.startSequence()

  if (this.initial) { ber.writeString(this.initial, 0x80) }

  if (this.any && this.any.length) {
    this.any.forEach(function (s) {
      ber.writeString(s, 0x81)
    })
  }

  if (this.final) { ber.writeString(this.final, 0x82) }

  ber.endSequence()

  return ber
}

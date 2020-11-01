// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert')
const util = require('util')

const parents = require('ldap-filter')

const Filter = require('./filter')

// THIS IS A STUB!
//
// ldapjs does not support server side extensible matching.
// This class exists only for the client to send them.

/// --- API

function ExtensibleFilter (options) {
  parents.ExtensibleFilter.call(this, options)
}
util.inherits(ExtensibleFilter, parents.ExtensibleFilter)
Filter.mixin(ExtensibleFilter)
module.exports = ExtensibleFilter

ExtensibleFilter.prototype.parse = function (ber) {
  const end = ber.offset + ber.length
  while (ber.offset < end) {
    const tag = ber.peek()
    switch (tag) {
      case 0x81:
        this.rule = ber.readString(tag)
        break
      case 0x82:
        this.matchType = ber.readString(tag)
        break
      case 0x83:
        this.value = ber.readString(tag)
        break
      case 0x84:
        this.dnAttributes = ber.readBoolean(tag)
        break
      default:
        throw new Error('Invalid ext_match filter type: 0x' + tag.toString(16))
    }
  }

  return true
}

ExtensibleFilter.prototype._toBer = function (ber) {
  assert.ok(ber)

  if (this.rule) { ber.writeString(this.rule, 0x81) }
  if (this.matchType) { ber.writeString(this.matchType, 0x82) }

  ber.writeString(this.value, 0x83)
  if (this.dnAttributes) { ber.writeBoolean(this.dnAttributes, 0x84) }

  return ber
}

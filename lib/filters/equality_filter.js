// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const ASN1 = require('asn1').Ber
const parents = require('ldap-filter')

const Filter = require('./filter')

/// --- API

function EqualityFilter (options) {
  parents.EqualityFilter.call(this, options)
}
util.inherits(EqualityFilter, parents.EqualityFilter)
Filter.mixin(EqualityFilter)
module.exports = EqualityFilter

EqualityFilter.prototype.matches = function (target, strictAttrCase) {
  assert.object(target, 'target')

  const tv = parents.getAttrValue(target, this.attribute, strictAttrCase)
  let value = this.value

  if (this.attribute.toLowerCase() === 'objectclass') {
    /*
     * Perform case-insensitive match for objectClass since nearly every LDAP
     * implementation behaves in this manner.
     */
    value = value.toLowerCase()
    return parents.testValues(function (v) {
      return value === v.toLowerCase()
    }, tv)
  } else {
    return parents.testValues(function (v) {
      return value === v
    }, tv)
  }
}

EqualityFilter.prototype.parse = function (ber) {
  assert.ok(ber)

  this.attribute = ber.readString().toLowerCase()
  this.value = ber.readString(ASN1.OctetString, true)

  if (this.attribute === 'objectclass') { this.value = this.value.toLowerCase() }

  return true
}

EqualityFilter.prototype._toBer = function (ber) {
  assert.ok(ber)

  ber.writeString(this.attribute)
  ber.writeBuffer(this.raw, ASN1.OctetString)

  return ber
}

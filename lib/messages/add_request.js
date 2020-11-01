// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const LDAPMessage = require('./message')
const Attribute = require('../attribute')
const Protocol = require('../protocol')
const lassert = require('../assert')

/// --- API

function AddRequest (options) {
  options = options || {}
  assert.object(options)
  lassert.optionalStringDN(options.entry)
  lassert.optionalArrayOfAttribute(options.attributes)

  options.protocolOp = Protocol.LDAP_REQ_ADD
  LDAPMessage.call(this, options)

  this.entry = options.entry || null
  this.attributes = options.attributes ? options.attributes.slice(0) : []
}
util.inherits(AddRequest, LDAPMessage)
Object.defineProperties(AddRequest.prototype, {
  type: {
    get: function getType () { return 'AddRequest' },
    configurable: false
  },
  _dn: {
    get: function getDN () { return this.entry },
    configurable: false
  }
})

AddRequest.prototype._parse = function (ber) {
  assert.ok(ber)

  this.entry = ber.readString()

  ber.readSequence()

  const end = ber.offset + ber.length
  while (ber.offset < end) {
    const a = new Attribute()
    a.parse(ber)
    a.type = a.type.toLowerCase()
    if (a.type === 'objectclass') {
      for (let i = 0; i < a.vals.length; i++) { a.vals[i] = a.vals[i].toLowerCase() }
    }
    this.attributes.push(a)
  }

  this.attributes.sort(Attribute.compare)
  return true
}

AddRequest.prototype._toBer = function (ber) {
  assert.ok(ber)

  ber.writeString(this.entry.toString())
  ber.startSequence()
  this.attributes.forEach(function (a) {
    a.toBer(ber)
  })
  ber.endSequence()

  return ber
}

AddRequest.prototype._json = function (j) {
  assert.ok(j)

  j.entry = this.entry.toString()
  j.attributes = []

  this.attributes.forEach(function (a) {
    j.attributes.push(a.json)
  })

  return j
}

AddRequest.prototype.indexOf = function (attr) {
  if (!attr || typeof (attr) !== 'string') { throw new TypeError('attr (string) required') }

  for (let i = 0; i < this.attributes.length; i++) {
    if (this.attributes[i].type === attr) { return i }
  }

  return -1
}

AddRequest.prototype.attributeNames = function () {
  const attrs = []

  for (let i = 0; i < this.attributes.length; i++) { attrs.push(this.attributes[i].type.toLowerCase()) }

  return attrs
}

AddRequest.prototype.getAttribute = function (name) {
  if (!name || typeof (name) !== 'string') { throw new TypeError('attribute name (string) required') }

  name = name.toLowerCase()

  for (let i = 0; i < this.attributes.length; i++) {
    if (this.attributes[i].type === name) { return this.attributes[i] }
  }

  return null
}

AddRequest.prototype.addAttribute = function (attr) {
  if (!(attr instanceof Attribute)) { throw new TypeError('attribute (Attribute) required') }

  return this.attributes.push(attr)
}

/**
 * Returns a "pure" JS representation of this object.
 *
 * An example object would look like:
 *
 * {
 *   "dn": "cn=unit, dc=test",
 *   "attributes": {
 *     "cn": ["unit", "foo"],
 *     "objectclass": ["top", "person"]
 *   }
 * }
 *
 * @return {Object} that looks like the above.
 */
AddRequest.prototype.toObject = function () {
  const self = this

  const obj = {
    dn: self.entry ? self.entry.toString() : '',
    attributes: {}
  }

  if (!this.attributes || !this.attributes.length) { return obj }

  this.attributes.forEach(function (a) {
    if (!obj.attributes[a.type]) { obj.attributes[a.type] = [] }

    a.vals.forEach(function (v) {
      if (obj.attributes[a.type].indexOf(v) === -1) { obj.attributes[a.type].push(v) }
    })
  })

  return obj
}

/// --- Exports

module.exports = AddRequest

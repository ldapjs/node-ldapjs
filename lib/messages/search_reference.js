// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

// var asn1 = require('asn1')

const LDAPMessage = require('./message')
const Protocol = require('../protocol')
const dn = require('../dn')
const url = require('../url')

/// --- Globals

// var BerWriter = asn1.BerWriter
const parseURL = url.parse

/// --- API

function SearchReference (options) {
  options = options || {}
  assert.object(options)

  options.protocolOp = Protocol.LDAP_REP_SEARCH_REF
  LDAPMessage.call(this, options)

  this.uris = options.uris || []
}
util.inherits(SearchReference, LDAPMessage)
Object.defineProperties(SearchReference.prototype, {
  type: {
    get: function getType () { return 'SearchReference' },
    configurable: false
  },
  _dn: {
    get: function getDN () { return new dn.DN('') },
    configurable: false
  },
  object: {
    get: function getObject () {
      return {
        dn: this.dn.toString(),
        uris: this.uris.slice()
      }
    },
    configurable: false
  },
  urls: {
    get: function getUrls () { return this.uris },
    set: function setUrls (val) {
      assert.ok(val)
      assert.ok(Array.isArray(val))
      this.uris = val.slice()
    },
    configurable: false
  }
})

SearchReference.prototype.toObject = function () {
  return this.object
}

SearchReference.prototype.fromObject = function (obj) {
  if (typeof (obj) !== 'object') { throw new TypeError('object required') }

  this.uris = obj.uris ? obj.uris.slice() : []

  return true
}

SearchReference.prototype._json = function (j) {
  assert.ok(j)
  j.uris = this.uris.slice()
  return j
}

SearchReference.prototype._parse = function (ber, length) {
  assert.ok(ber)

  while (ber.offset < length) {
    const _url = ber.readString()
    parseURL(_url)
    this.uris.push(_url)
  }

  return true
}

SearchReference.prototype._toBer = function (ber) {
  assert.ok(ber)

  this.uris.forEach(function (u) {
    ber.writeString(u.href || u)
  })

  return ber
}

/// --- Exports

module.exports = SearchReference

// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const asn1 = require('asn1')

const LDAPMessage = require('./message')
// var LDAPResult = require('./result')
const dn = require('../dn')
const filters = require('../filters')
const Protocol = require('../protocol')

/// --- Globals

const Ber = asn1.Ber

/// --- API

function SearchRequest (options) {
  options = options || {}
  assert.object(options)

  options.protocolOp = Protocol.LDAP_REQ_SEARCH
  LDAPMessage.call(this, options)

  if (options.baseObject !== undefined) {
    this.baseObject = options.baseObject
  } else {
    this.baseObject = dn.parse('')
  }
  this.scope = options.scope || 'base'
  this.derefAliases = options.derefAliases || Protocol.NEVER_DEREF_ALIASES
  this.sizeLimit = options.sizeLimit || 0
  this.timeLimit = options.timeLimit || 0
  this.typesOnly = options.typesOnly || false
  this.filter = options.filter || null
  this.attributes = options.attributes ? options.attributes.slice(0) : []
}
util.inherits(SearchRequest, LDAPMessage)
Object.defineProperties(SearchRequest.prototype, {
  type: {
    get: function getType () { return 'SearchRequest' },
    configurable: false
  },
  _dn: {
    get: function getDN () { return this.baseObject },
    configurable: false
  },
  scope: {
    get: function getScope () {
      switch (this._scope) {
        case Protocol.SCOPE_BASE_OBJECT: return 'base'
        case Protocol.SCOPE_ONE_LEVEL: return 'one'
        case Protocol.SCOPE_SUBTREE: return 'sub'
        default:
          throw new Error(this._scope + ' is an invalid search scope')
      }
    },
    set: function setScope (val) {
      if (typeof (val) === 'string') {
        switch (val) {
          case 'base':
            this._scope = Protocol.SCOPE_BASE_OBJECT
            break
          case 'one':
            this._scope = Protocol.SCOPE_ONE_LEVEL
            break
          case 'sub':
            this._scope = Protocol.SCOPE_SUBTREE
            break
          default:
            throw new Error(val + ' is an invalid search scope')
        }
      } else {
        this._scope = val
      }
    },
    configurable: false
  }
})

SearchRequest.prototype._parse = function (ber) {
  assert.ok(ber)

  this.baseObject = ber.readString()
  this.scope = ber.readEnumeration()
  this.derefAliases = ber.readEnumeration()
  this.sizeLimit = ber.readInt()
  this.timeLimit = ber.readInt()
  this.typesOnly = ber.readBoolean()

  this.filter = filters.parse(ber)

  // look for attributes
  if (ber.peek() === 0x30) {
    ber.readSequence()
    const end = ber.offset + ber.length
    while (ber.offset < end) { this.attributes.push(ber.readString().toLowerCase()) }
  }

  return true
}

SearchRequest.prototype._toBer = function (ber) {
  assert.ok(ber)

  // Format only with commas, since that is what RFC 4514 mandates.
  // There's a gotcha here: even though it's called baseObject,
  //  it can be a string or a DN object.
  const formattedDN = dn.DN.isDN(this.baseObject)
    ? this.baseObject.format({ skipSpace: true })
    : this.baseObject.toString()
  ber.writeString(formattedDN)
  ber.writeEnumeration(this._scope)
  ber.writeEnumeration(this.derefAliases)
  ber.writeInt(this.sizeLimit)
  ber.writeInt(this.timeLimit)
  ber.writeBoolean(this.typesOnly)

  const f = this.filter || new filters.PresenceFilter({ attribute: 'objectclass' })
  ber = f.toBer(ber)

  ber.startSequence(Ber.Sequence | Ber.Constructor)
  if (this.attributes && this.attributes.length) {
    this.attributes.forEach(function (a) {
      ber.writeString(a)
    })
  }
  ber.endSequence()

  return ber
}

SearchRequest.prototype._json = function (j) {
  assert.ok(j)

  j.baseObject = this.baseObject
  j.scope = this.scope
  j.derefAliases = this.derefAliases
  j.sizeLimit = this.sizeLimit
  j.timeLimit = this.timeLimit
  j.typesOnly = this.typesOnly
  j.filter = this.filter.toString()
  j.attributes = this.attributes

  return j
}

/// --- Exports

module.exports = SearchRequest

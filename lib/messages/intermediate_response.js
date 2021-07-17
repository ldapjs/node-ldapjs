'use strict'

const assert = require('assert-plus')
const util = require('util')

const LDAPMessage = require('./message')
const Protocol = require('../protocol')
const asn1 = require('asn1')

const BerReader = asn1.BerReader

const SYNCINFO = '1.3.6.1.4.1.4203.1.9.1.4'

/// --- API

function IntermediateResponse (options) {
  LDAPMessage.call(this, options)
  options = options || {}
  assert.object(options)
  assert.optionalString(options.responseName)
  assert.optionalString(options.responsevalue)

  this.responseName = options.responseName || undefined
  this.responseValue = options.responseValue || undefined

  options.protocolOp = Protocol.LDAP_REP_INTERMEDIATE
}
util.inherits(IntermediateResponse, LDAPMessage)
Object.defineProperties(IntermediateResponse.prototype, {
  type: {
    get: function getType () { return 'IntermediateResponse' },
    configurable: false
  },
  _dn: {
    get: function getDN () { return this.responseName },
    configurable: false
  },
  name: {
    get: function getName () { return this.responseName },
    set: function setName (val) {
      assert.string(val)
      this.responseName = val
    },
    configurable: false
  },
  value: {
    get: function getValue () { return this.responseValue },
    set: function (val) {
      assert.string(val)
      this.responseValue = val
    },
    configurable: false
  }
})

IntermediateResponse.prototype._parse = function (ber) {
  assert.ok(ber)

  if (ber.peek() === 0x80) { this.responseName = ber.readString(0x80) }
  if (ber.peek() === 0x81) { this.responseBuffer = ber.readString(0x81, true) }

  switch (this.responseName) {
    case SYNCINFO: {
      const val = {}
      const read = new BerReader(this.responseBuffer)

      // newcookie
      if (read.peek() === 0x04) {
        val.cookie = read.readString()
      }
      // refreshDelete
      if (read.peek() === 0xa1 && read.readSequence(0xa1)) {
        const o = {
          refreshDone: true
        }
        if (read.peek() === 0x04) {
          o.cookie = read.readString()
        }
        if (read.peek() === 0x01) {
          o.refreshDone = read.readBoolean()
        }
        val.refreshDelete = o
        val.type = 'refreshDelete'
      }
      // refreshPresent
      if (read.peek() === 0xa2 && read.readSequence(0xa2)) {
        const o = {
          refreshDone: true
        }
        if (read.peek() === 0x04) {
          o.cookie = read.readString()
        }
        if (read.peek() === 0x01) {
          o.refreshDone = read.readBoolean()
        }
        val.refreshPresent = o
        val.type = 'refreshPresent'
      }
      // syncidset
      if (read.peek() === 0xa3 && read.readSequence(0xa3)) {
        const o = {
          refreshDeletes: false
        }
        if (read.peek() === 0x04) {
          o.cookie = read.readString()
        }
        if (read.peek() === 0x01) {
          o.refreshDeletes = read.readBoolean()
        }
        if (read.peek() === 0x31) {
          const syncUUIDs = []
          read.readSequence()
          while (read.peek() === 0x04) {
            const v = read.readString(0x04, true).toString('hex')
            syncUUIDs.push(v)
          }
          o.syncUUIDs = syncUUIDs
        }
        val.syncIdSet = o
        val.type = 'syncIdSet'
        this.responseValue = val
      }
      break
    }
  }

  return true
}

IntermediateResponse.prototype._toBer = function (ber) {
  assert.ok(ber)

  if (this.responseName) { ber.writeString(this.responseName, 0x8a) }
  if (this.responseValue) { ber.writeString(this.responseValue, 0x8b) }

  return ber
}

IntermediateResponse.prototype._json = function (j) {
  assert.ok(j)

  j.responseName = this.responseName
  j.responseValue = this.responseValue

  return j
}

/// --- Exports

module.exports = IntermediateResponse

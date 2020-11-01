// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const LDAPMessage = require('./message')
const Protocol = require('../protocol')

/// --- API

function ExtendedRequest (options) {
  options = options || {}
  assert.object(options)
  assert.optionalString(options.requestName)
  if (options.requestValue &&
      !(Buffer.isBuffer(options.requestValue) ||
      typeof (options.requestValue) === 'string')) {
    throw new TypeError('options.requestValue must be a buffer or a string')
  }

  options.protocolOp = Protocol.LDAP_REQ_EXTENSION
  LDAPMessage.call(this, options)

  this.requestName = options.requestName || ''
  this.requestValue = options.requestValue

  if (Buffer.isBuffer(this.requestValue)) {
    this.requestValueBuffer = this.requestValue
  } else {
    this.requestValueBuffer = Buffer.from(this.requestValue || '', 'utf8')
  }
}
util.inherits(ExtendedRequest, LDAPMessage)
Object.defineProperties(ExtendedRequest.prototype, {
  type: {
    get: function getType () { return 'ExtendedRequest' },
    configurable: false
  },
  _dn: {
    get: function getDN () { return this.requestName },
    configurable: false
  },
  name: {
    get: function getName () { return this.requestName },
    set: function setName (val) {
      assert.string(val)
      this.requestName = val
    },
    configurable: false
  },
  value: {
    get: function getValue () { return this.requestValue },
    set: function setValue (val) {
      if (!(Buffer.isBuffer(val) || typeof (val) === 'string')) { throw new TypeError('value must be a buffer or a string') }

      if (Buffer.isBuffer(val)) {
        this.requestValueBuffer = val
      } else {
        this.requestValueBuffer = Buffer.from(val, 'utf8')
      }

      this.requestValue = val
    },
    configurable: false
  },
  valueBuffer: {
    get: function getValueBuffer () {
      return this.requestValueBuffer
    },
    set: function setValueBuffer (val) {
      if (!Buffer.isBuffer(val)) { throw new TypeError('valueBuffer must be a buffer') }

      this.value = val
    },
    configurable: false
  }
})

ExtendedRequest.prototype._parse = function (ber) {
  assert.ok(ber)

  this.requestName = ber.readString(0x80)
  if (ber.peek() === 0x81) {
    this.requestValueBuffer = ber.readString(0x81, true)
    this.requestValue = this.requestValueBuffer.toString('utf8')
  }

  return true
}

ExtendedRequest.prototype._toBer = function (ber) {
  assert.ok(ber)

  ber.writeString(this.requestName, 0x80)
  if (Buffer.isBuffer(this.requestValue)) {
    ber.writeBuffer(this.requestValue, 0x81)
  } else if (typeof (this.requestValue) === 'string') {
    ber.writeString(this.requestValue, 0x81)
  }

  return ber
}

ExtendedRequest.prototype._json = function (j) {
  assert.ok(j)

  j.requestName = this.requestName
  j.requestValue = (Buffer.isBuffer(this.requestValue))
    ? this.requestValue.toString('hex')
    : this.requestValue

  return j
}

/// --- Exports

module.exports = ExtendedRequest

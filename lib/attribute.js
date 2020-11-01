// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert')

const asn1 = require('asn1')

const Protocol = require('./protocol')

/// --- API

function Attribute (options) {
  if (options) {
    if (typeof (options) !== 'object') { throw new TypeError('options must be an object') }
    if (options.type && typeof (options.type) !== 'string') { throw new TypeError('options.type must be a string') }
  } else {
    options = {}
  }

  this.type = options.type || ''
  this._vals = []

  if (options.vals !== undefined && options.vals !== null) { this.vals = options.vals }
}

module.exports = Attribute

Object.defineProperties(Attribute.prototype, {
  buffers: {
    get: function getBuffers () {
      return this._vals
    },
    configurable: false
  },
  json: {
    get: function getJson () {
      return {
        type: this.type,
        vals: this.vals
      }
    },
    configurable: false
  },
  vals: {
    get: function getVals () {
      const eType = _bufferEncoding(this.type)
      return this._vals.map(function (v) {
        return v.toString(eType)
      })
    },
    set: function setVals (vals) {
      const self = this
      this._vals = []
      if (Array.isArray(vals)) {
        vals.forEach(function (v) {
          self.addValue(v)
        })
      } else {
        self.addValue(vals)
      }
    },
    configurable: false
  }
})

Attribute.prototype.addValue = function addValue (val) {
  if (Buffer.isBuffer(val)) {
    this._vals.push(val)
  } else {
    this._vals.push(Buffer.from(val + '', _bufferEncoding(this.type)))
  }
}

/* BEGIN JSSTYLED */
Attribute.compare = function compare (a, b) {
  if (!(Attribute.isAttribute(a)) || !(Attribute.isAttribute(b))) {
    throw new TypeError('can only compare Attributes')
  }

  if (a.type < b.type) return -1
  if (a.type > b.type) return 1
  if (a.vals.length < b.vals.length) return -1
  if (a.vals.length > b.vals.length) return 1

  for (let i = 0; i < a.vals.length; i++) {
    if (a.vals[i] < b.vals[i]) return -1
    if (a.vals[i] > b.vals[i]) return 1
  }

  return 0
}
/* END JSSTYLED */

Attribute.prototype.parse = function parse (ber) {
  assert.ok(ber)

  ber.readSequence()
  this.type = ber.readString()

  if (ber.peek() === Protocol.LBER_SET) {
    if (ber.readSequence(Protocol.LBER_SET)) {
      const end = ber.offset + ber.length
      while (ber.offset < end) { this._vals.push(ber.readString(asn1.Ber.OctetString, true)) }
    }
  }

  return true
}

Attribute.prototype.toBer = function toBer (ber) {
  assert.ok(ber)

  ber.startSequence()
  ber.writeString(this.type)
  ber.startSequence(Protocol.LBER_SET)
  if (this._vals.length) {
    this._vals.forEach(function (b) {
      ber.writeByte(asn1.Ber.OctetString)
      ber.writeLength(b.length)
      for (let i = 0; i < b.length; i++) { ber.writeByte(b[i]) }
    })
  } else {
    ber.writeStringArray([])
  }
  ber.endSequence()
  ber.endSequence()

  return ber
}

Attribute.prototype.toString = function () {
  return JSON.stringify(this.json)
}

Attribute.toBer = function (attr, ber) {
  return Attribute.prototype.toBer.call(attr, ber)
}

Attribute.isAttribute = function isAttribute (attr) {
  if (!attr || typeof (attr) !== 'object') {
    return false
  }
  if (attr instanceof Attribute) {
    return true
  }
  if ((typeof (attr.toBer) === 'function') &&
      (typeof (attr.type) === 'string') &&
      (Array.isArray(attr.vals)) &&
      (attr.vals.filter(function (item) {
        return (typeof (item) === 'string' ||
                  Buffer.isBuffer(item))
      }).length === attr.vals.length)) {
    return true
  }
  return false
}

function _bufferEncoding (type) {
  /* JSSTYLED */
  return /;binary$/.test(type) ? 'base64' : 'utf8'
}

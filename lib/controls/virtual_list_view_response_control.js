const assert = require('assert-plus')
const util = require('util')

const asn1 = require('asn1')

const Control = require('./control')
const CODES = require('../errors/codes')

/// --- Globals

const BerReader = asn1.BerReader
const BerWriter = asn1.BerWriter

const VALID_CODES = [
  CODES.LDAP_SUCCESS,
  CODES.LDAP_OPERATIONS_ERROR,
  CODES.LDAP_UNWILLING_TO_PERFORM,
  CODES.LDAP_INSUFFICIENT_ACCESS_RIGHTS,
  CODES.LDAP_BUSY,
  CODES.LDAP_TIME_LIMIT_EXCEEDED,
  CODES.LDAP_ADMIN_LIMIT_EXCEEDED,
  CODES.LDAP_SORT_CONTROL_MISSING,
  CODES.LDAP_INDEX_RANGE_ERROR,
  CODES.LDAP_CONTROL_ERROR,
  CODES.LDAP_OTHER
]

function VirtualListViewResponseControl (options) {
  assert.optionalObject(options)
  options = options || {}
  options.type = VirtualListViewResponseControl.OID
  options.criticality = false

  if (options.value) {
    if (Buffer.isBuffer(options.value)) {
      this.parse(options.value)
    } else if (typeof (options.value) === 'object') {
      if (VALID_CODES.indexOf(options.value.result) === -1) {
        throw new Error('Invalid result code')
      }
      this._value = options.value
    } else {
      throw new TypeError('options.value must be a Buffer or Object')
    }
    options.value = null
  }
  Control.call(this, options)
}
util.inherits(VirtualListViewResponseControl, Control)
Object.defineProperties(VirtualListViewResponseControl.prototype, {
  value: {
    get: function () { return this._value || {} },
    configurable: false
  }
})

VirtualListViewResponseControl.prototype.parse = function parse (buffer) {
  assert.ok(buffer)
  const ber = new BerReader(buffer)
  if (ber.readSequence()) {
    this._value = {}
    if (ber.peek(0x02)) {
      this._value.targetPosition = ber.readInt()
    }
    if (ber.peek(0x02)) {
      this._value.contentCount = ber.readInt()
    }
    this._value.result = ber.readEnumeration()
    this._value.cookie = ber.readString(asn1.Ber.OctetString, true)
    // readString returns '' instead of a zero-length buffer
    if (!this._value.cookie) {
      this._value.cookie = Buffer.alloc(0)
    }
    return true
  }
  return false
}

VirtualListViewResponseControl.prototype._toBer = function (ber) {
  assert.ok(ber)

  if (!this._value || this.value.length === 0) {
    return
  }

  const writer = new BerWriter()
  writer.startSequence()
  if (this.value.targetPosition !== undefined) {
    writer.writeInt(this.value.targetPosition)
  }
  if (this.value.contentCount !== undefined) {
    writer.writeInt(this.value.contentCount)
  }
  writer.writeEnumeration(this.value.result)
  if (this.value.cookie && this.value.cookie.length > 0) {
    writer.writeBuffer(this.value.cookie, asn1.Ber.OctetString)
  } else {
    writer.writeString('') // writeBuffer rejects zero-length buffers
  }
  writer.endSequence()
  ber.writeBuffer(writer.buffer, 0x04)
}

VirtualListViewResponseControl.prototype._json = function (obj) {
  obj.controlValue = this.value
  return obj
}

VirtualListViewResponseControl.OID = '2.16.840.1.113730.3.4.10'

/// --- Exports
module.exports = VirtualListViewResponseControl

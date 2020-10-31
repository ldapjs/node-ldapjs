const assert = require('assert-plus')
const util = require('util')

const asn1 = require('asn1')

const Control = require('./control')

/// --- Globals

const BerReader = asn1.BerReader
const BerWriter = asn1.BerWriter

/// --- API

function VirtualListViewControl (options) {
  assert.optionalObject(options)
  options = options || {}
  options.type = VirtualListViewControl.OID
  if (options.value) {
    if (Buffer.isBuffer(options.value)) {
      this.parse(options.value)
    } else if (typeof (options.value) === 'object') {
      if (Object.prototype.hasOwnProperty.call(options.value, 'beforeCount') === false) {
        throw new Error('Missing required key: beforeCount')
      }
      if (Object.prototype.hasOwnProperty.call(options.value, 'afterCount') === false) {
        throw new Error('Missing required key: afterCount')
      }
      this._value = options.value
    } else {
      throw new TypeError('options.value must be a Buffer or Object')
    }
    options.value = null
  }
  Control.call(this, options)
}
util.inherits(VirtualListViewControl, Control)
Object.defineProperties(VirtualListViewControl.prototype, {
  value: {
    get: function () { return this._value || [] },
    configurable: false
  }
})

VirtualListViewControl.prototype.parse = function parse (buffer) {
  assert.ok(buffer)
  const ber = new BerReader(buffer)
  if (ber.readSequence()) {
    this._value = {}
    this._value.beforeCount = ber.readInt()
    this._value.afterCount = ber.readInt()
    if (ber.peek() === 0xa0) {
      if (ber.readSequence(0xa0)) {
        this._value.targetOffset = ber.readInt()
        this._value.contentCount = ber.readInt()
      }
    }
    if (ber.peek() === 0x81) {
      this._value.greaterThanOrEqual = ber.readString(0x81)
    }
    return true
  }
  return false
}

VirtualListViewControl.prototype._toBer = function (ber) {
  assert.ok(ber)
  if (!this._value || this.value.length === 0) {
    return
  }
  const writer = new BerWriter()
  writer.startSequence(0x30)
  writer.writeInt(this.value.beforeCount)
  writer.writeInt(this.value.afterCount)
  if (this.value.targetOffset !== undefined) {
    writer.startSequence(0xa0)
    writer.writeInt(this.value.targetOffset)
    writer.writeInt(this.value.contentCount)
    writer.endSequence()
  } else if (this.value.greaterThanOrEqual !== undefined) {
    writer.writeString(this.value.greaterThanOrEqual, 0x81)
  }
  writer.endSequence()
  ber.writeBuffer(writer.buffer, 0x04)
}
VirtualListViewControl.prototype._json = function (obj) {
  obj.controlValue = this.value
  return obj
}
VirtualListViewControl.OID = '2.16.840.1.113730.3.4.9'

/// ---Exports

module.exports = VirtualListViewControl

const assert = require('assert-plus')
const util = require('util')

const asn1 = require('asn1')

const Control = require('./control')

/// --- Globals

const BerReader = asn1.BerReader
const BerWriter = asn1.BerWriter

/// --- API

function ServerSideSortingRequestControl (options) {
  assert.optionalObject(options)
  options = options || {}
  options.type = ServerSideSortingRequestControl.OID
  if (options.value) {
    if (Buffer.isBuffer(options.value)) {
      this.parse(options.value)
    } else if (Array.isArray(options.value)) {
      assert.arrayOfObject(options.value, 'options.value must be Objects')
      for (let i = 0; i < options.value.length; i++) {
        if (Object.prototype.hasOwnProperty.call(options.value[i], 'attributeType') === false) {
          throw new Error('Missing required key: attributeType')
        }
      }
      this._value = options.value
    } else if (typeof (options.value) === 'object') {
      if (Object.prototype.hasOwnProperty.call(options.value, 'attributeType') === false) {
        throw new Error('Missing required key: attributeType')
      }
      this._value = [options.value]
    } else {
      throw new TypeError('options.value must be a Buffer, Array or Object')
    }
    options.value = null
  }
  Control.call(this, options)
}
util.inherits(ServerSideSortingRequestControl, Control)
Object.defineProperties(ServerSideSortingRequestControl.prototype, {
  value: {
    get: function () { return this._value || [] },
    configurable: false
  }
})

ServerSideSortingRequestControl.prototype.parse = function parse (buffer) {
  assert.ok(buffer)

  const ber = new BerReader(buffer)
  let item
  if (ber.readSequence(0x30)) {
    this._value = []

    while (ber.readSequence(0x30)) {
      item = {}
      item.attributeType = ber.readString(asn1.Ber.OctetString)
      if (ber.peek() === 0x80) {
        item.orderingRule = ber.readString(0x80)
      }
      if (ber.peek() === 0x81) {
        item.reverseOrder = (ber._readTag(0x81) !== 0)
      }
      this._value.push(item)
    }
    return true
  }
  return false
}

ServerSideSortingRequestControl.prototype._toBer = function (ber) {
  assert.ok(ber)

  if (!this._value || this.value.length === 0) { return }

  const writer = new BerWriter()
  writer.startSequence(0x30)
  for (let i = 0; i < this.value.length; i++) {
    const item = this.value[i]
    writer.startSequence(0x30)
    if (item.attributeType) {
      writer.writeString(item.attributeType, asn1.Ber.OctetString)
    }
    if (item.orderingRule) {
      writer.writeString(item.orderingRule, 0x80)
    }
    if (item.reverseOrder) {
      writer.writeBoolean(item.reverseOrder, 0x81)
    }
    writer.endSequence()
  }
  writer.endSequence()
  ber.writeBuffer(writer.buffer, 0x04)
}

ServerSideSortingRequestControl.prototype._json = function (obj) {
  obj.controlValue = this.value
  return obj
}

ServerSideSortingRequestControl.OID = '1.2.840.113556.1.4.473'

/// ---Exports

module.exports = ServerSideSortingRequestControl

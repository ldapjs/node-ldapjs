const assert = require('assert-plus')
const util = require('util')

const asn1 = require('asn1')

const Control = require('./control')

/// --- Globals

const BerReader = asn1.BerReader
const BerWriter = asn1.BerWriter

/// --- API

function EntryChangeNotificationControl (options) {
  assert.optionalObject(options)
  options = options || {}
  options.type = EntryChangeNotificationControl.OID
  if (options.value) {
    if (Buffer.isBuffer(options.value)) {
      this.parse(options.value)
    } else if (typeof (options.value) === 'object') {
      this._value = options.value
    } else {
      throw new TypeError('options.value must be a Buffer or Object')
    }
    options.value = null
  }
  Control.call(this, options)
}
util.inherits(EntryChangeNotificationControl, Control)
Object.defineProperties(EntryChangeNotificationControl.prototype, {
  value: {
    get: function () { return this._value || {} },
    configurable: false
  }
})

EntryChangeNotificationControl.prototype.parse = function parse (buffer) {
  assert.ok(buffer)

  const ber = new BerReader(buffer)
  if (ber.readSequence()) {
    this._value = {
      changeType: ber.readInt()
    }

    // if the operation was moddn, then parse the optional previousDN attr
    if (this._value.changeType === 8) { this._value.previousDN = ber.readString() }

    this._value.changeNumber = ber.readInt()

    return true
  }

  return false
}

EntryChangeNotificationControl.prototype._toBer = function (ber) {
  assert.ok(ber)

  if (!this._value) { return }

  const writer = new BerWriter()
  writer.startSequence()
  writer.writeInt(this.value.changeType)
  if (this.value.previousDN) { writer.writeString(this.value.previousDN) }

  writer.writeInt(parseInt(this.value.changeNumber, 10))
  writer.endSequence()

  ber.writeBuffer(writer.buffer, 0x04)
}

EntryChangeNotificationControl.prototype._json = function (obj) {
  obj.controlValue = this.value
  return obj
}

EntryChangeNotificationControl.OID = '2.16.840.1.113730.3.4.7'

/// --- Exports
module.exports = EntryChangeNotificationControl

'use strict'
const assert = require('assert-plus')
const util = require('util')

const asn1 = require('asn1')

const Control = require('./control')

/// --- Globals

const BerReader = asn1.BerReader
const BerWriter = asn1.BerWriter

/// --- API

function SyncDoneControl (options) {
  assert.optionalObject(options)
  options = options || {}
  options.type = SyncDoneControl.OID

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
util.inherits(SyncDoneControl, Control)
Object.defineProperties(SyncDoneControl.prototype, {
  value: {
    get: function () { return this._value || {} },
    configurable: false
  }
})

SyncDoneControl.prototype.parse = function parse (buffer) {
  assert.ok(buffer)

  const ber = new BerReader(buffer)
  if (ber.readSequence()) {
    this._value = {}

    // cookie ?
    if (ber.peek() === 0x04) {
      this._value.cookie = ber.readString(0x04)
    }

    if (ber.peek() === 0x01) {
      this._value.refreshDeletes = ber.readBoolean()
    }

    return true
  }

  return false
}

SyncDoneControl.prototype._toBer = function (ber) {
  assert.ok(ber)

  if (!this._value) { return }

  const writer = new BerWriter()
  writer.startSequence()
  if (this.value.cookie) {
    writer.writeString(this.value.cookie, 0x04)
  }
  writer.writeBoolean(this.value.refreshDeletes || false)
  writer.endSequence()

  ber.writeBuffer(writer.buffer, 0x04)
}

SyncDoneControl.prototype._json = function (obj) {
  obj.controlValue = this.value
  return obj
}

SyncDoneControl.OID = '1.3.6.1.4.1.4203.1.9.1.3'

/// --- Exports
module.exports = SyncDoneControl

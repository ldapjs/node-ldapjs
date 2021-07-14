'use strict'

const assert = require('assert-plus')
const util = require('util')

const asn1 = require('asn1')

const Control = require('./control')

/// --- Globals

const BerReader = asn1.BerReader
const BerWriter = asn1.BerWriter

/// --- API

function SyncRequestControl (options) {
  assert.optionalObject(options)
  options = options || {}
  options.type = SyncRequestControl.OID

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
util.inherits(SyncRequestControl, Control)
Object.defineProperties(SyncRequestControl.prototype, {
  value: {
    get: function () { return this._value || {} },
    configurable: false
  }
})

SyncRequestControl.prototype.parse = function parse (buffer) {
  assert.ok(buffer)

  const ber = new BerReader(buffer)
  if (ber.readSequence()) {
    const mode = ber._readTag(0x0a)
    // only valid options
    if (mode !== 1 && mode !== 3) {
      return false
    }
    this._value = {
      mode: mode === 1 ? 'refreshOnly' : 'refreshAndPersist',
      reloadHint: false
    }
    // do we have an octet string
    if (ber.peek() === 0x04) {
      this._value.cookie = ber.readString(0x04)
    }
    if (ber.peek() === 0x01) {
      this._value.reloadHint = ber.readBoolean()
    }

    return true
  }

  return false
}

SyncRequestControl.prototype._toBer = function (ber) {
  assert.ok(ber)

  if (!this._value) { return }

  const writer = new BerWriter()
  writer.startSequence()
  writer.writeInt(this.value.mode === 'refreshOnly' ? 1 : 3, 0x0a)
  if (this.value.cookie) {
    writer.writeString(this.value.cookie, 0x04)
  }
  writer.writeBoolean(this.value.reloadHint || false)
  writer.endSequence()

  ber.writeBuffer(writer.buffer, 0x04)
}

SyncRequestControl.prototype._json = function (obj) {
  obj.controlValue = this.value
  return obj
}

SyncRequestControl.OID = '1.3.6.1.4.1.4203.1.9.1.1'

/// --- Exports
module.exports = SyncRequestControl

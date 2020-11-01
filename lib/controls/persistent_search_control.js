// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const asn1 = require('asn1')

const Control = require('./control')

/// --- Globals

const BerReader = asn1.BerReader
const BerWriter = asn1.BerWriter

/// --- API

function PersistentSearchControl (options) {
  assert.optionalObject(options)
  options = options || {}
  options.type = PersistentSearchControl.OID

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
util.inherits(PersistentSearchControl, Control)
Object.defineProperties(PersistentSearchControl.prototype, {
  value: {
    get: function () { return this._value || {} },
    configurable: false
  }
})

PersistentSearchControl.prototype.parse = function parse (buffer) {
  assert.ok(buffer)

  const ber = new BerReader(buffer)
  if (ber.readSequence()) {
    this._value = {
      changeTypes: ber.readInt(),
      changesOnly: ber.readBoolean(),
      returnECs: ber.readBoolean()
    }

    return true
  }

  return false
}

PersistentSearchControl.prototype._toBer = function (ber) {
  assert.ok(ber)

  if (!this._value) { return }

  const writer = new BerWriter()
  writer.startSequence()
  writer.writeInt(this.value.changeTypes)
  writer.writeBoolean(this.value.changesOnly)
  writer.writeBoolean(this.value.returnECs)
  writer.endSequence()

  ber.writeBuffer(writer.buffer, 0x04)
}

PersistentSearchControl.prototype._json = function (obj) {
  obj.controlValue = this.value
  return obj
}

PersistentSearchControl.OID = '2.16.840.1.113730.3.4.3'

/// --- Exports
module.exports = PersistentSearchControl

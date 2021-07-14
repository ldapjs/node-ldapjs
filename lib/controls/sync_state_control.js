'use strict'

const assert = require('assert-plus')
const util = require('util')

const asn1 = require('asn1')

const Control = require('./control')

/// --- Globals

const BerReader = asn1.BerReader
const BerWriter = asn1.BerWriter

const StateMappings = {
  0: 'present',
  1: 'add',
  2: 'modify',
  3: 'delete'
}
const StateMappingsRev = {}
for (const [k, v] of Object.entries(StateMappings)) {
  StateMappingsRev[v] = k
}

/// --- API

function SyncStateControl (options) {
  assert.optionalObject(options)
  options = options || {}
  options.type = SyncStateControl.OID

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
util.inherits(SyncStateControl, Control)
Object.defineProperties(SyncStateControl.prototype, {
  value: {
    get: function () { return this._value || {} },
    configurable: false
  }
})

SyncStateControl.prototype.parse = function parse (buffer) {
  assert.ok(buffer)

  const ber = new BerReader(buffer)
  if (ber.readSequence()) {
    const mode = ber._readTag(0x0a)
    // only valid options
    if (!StateMappings[mode]) {
      return false
    }
    this._value = {
      state: StateMappings[mode],
      entryUUID: Buffer.from(ber.readString(0x04), 'utf8').toString('hex')
    }
    // cookie ?
    if (ber.peek() === 0x04) {
      this._value.cookie = ber.readString(0x04)
    }

    return true
  }

  return false
}

SyncStateControl.prototype._toBer = function (ber) {
  assert.ok(ber)

  if (!this._value) { return }
  if (!Object.hasOwnProperty.call(StateMappingsRev, this.value.state)) { return }

  const writer = new BerWriter()
  writer.startSequence()
  writer.writeInt(StateMappingsRev[this.value.state], 0x0a)

  writer.writeString(Buffer.from(this.value.entryUUID, 'hex').toString('utf8'), 0x04)
  if (this.value.cookie) {
    writer.writeString(this.value.cookie, 0x04)
  }
  writer.endSequence()

  ber.writeBuffer(writer.buffer, 0x04)
}

SyncStateControl.prototype._json = function (obj) {
  obj.controlValue = this.value
  return obj
}

SyncStateControl.OID = '1.3.6.1.4.1.4203.1.9.1.2'

/// --- Exports
module.exports = SyncStateControl

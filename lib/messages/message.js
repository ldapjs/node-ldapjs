// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const asn1 = require('asn1')

const logger = require('../logger')
// var Control = require('../controls').Control
// var Protocol = require('../protocol')

/// --- Globals

// var Ber = asn1.Ber
// var BerReader = asn1.BerReader
const BerWriter = asn1.BerWriter
const getControl = require('../controls').getControl

/// --- API

/**
 * LDAPMessage structure.
 *
 * @param {Object} options stuff.
 */
function LDAPMessage (options) {
  assert.object(options)

  this.messageID = options.messageID || 0
  this.protocolOp = options.protocolOp || undefined
  this.controls = options.controls ? options.controls.slice(0) : []

  this.log = options.log || logger
}
Object.defineProperties(LDAPMessage.prototype, {
  id: {
    get: function getId () { return this.messageID },
    configurable: false
  },
  dn: {
    get: function getDN () { return this._dn || '' },
    configurable: false
  },
  type: {
    get: function getType () { return 'LDAPMessage' },
    configurable: false
  },
  json: {
    get: function () {
      const out = this._json({
        messageID: this.messageID,
        protocolOp: this.type
      })
      out.controls = this.controls
      return out
    },
    configurable: false
  }
})

LDAPMessage.prototype.toString = function () {
  return JSON.stringify(this.json)
}

LDAPMessage.prototype.parse = function (ber) {
  assert.ok(ber)

  this.log.trace('parse: data=%s', util.inspect(ber.buffer))

  // Delegate off to the specific type to parse
  this._parse(ber, ber.length)

  // Look for controls
  if (ber.peek() === 0xa0) {
    ber.readSequence()
    const end = ber.offset + ber.length
    while (ber.offset < end) {
      const c = getControl(ber)
      if (c) { this.controls.push(c) }
    }
  }

  this.log.trace('Parsing done: %j', this.json)
  return true
}

LDAPMessage.prototype.toBer = function () {
  let writer = new BerWriter()
  writer.startSequence()
  writer.writeInt(this.messageID)

  writer.startSequence(this.protocolOp)
  if (this._toBer) { writer = this._toBer(writer) }
  writer.endSequence()

  if (this.controls && this.controls.length) {
    writer.startSequence(0xa0)
    this.controls.forEach(function (c) {
      c.toBer(writer)
    })
    writer.endSequence()
  }

  writer.endSequence()
  return writer.buffer
}

/// --- Exports

module.exports = LDAPMessage

// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const test = require('tap').test

const asn1 = require('asn1')

const BerReader = asn1.BerReader
const BerWriter = asn1.BerWriter
let getControl
let PersistentSearchControl

/// --- Tests

test('load library', function (t) {
  PersistentSearchControl = require('../../lib').PersistentSearchControl
  t.ok(PersistentSearchControl)
  getControl = require('../../lib').getControl
  t.ok(getControl)
  t.end()
})

test('new no args', function (t) {
  t.ok(new PersistentSearchControl())
  t.end()
})

test('new with args', function (t) {
  const c = new PersistentSearchControl({
    type: '2.16.840.1.113730.3.4.3',
    criticality: true,
    value: {
      changeTypes: 15,
      changesOnly: false,
      returnECs: false
    }
  })
  t.ok(c)
  t.equal(c.type, '2.16.840.1.113730.3.4.3')
  t.ok(c.criticality)

  t.equal(c.value.changeTypes, 15)
  t.equal(c.value.changesOnly, false)
  t.equal(c.value.returnECs, false)

  const writer = new BerWriter()
  c.toBer(writer)
  const reader = new BerReader(writer.buffer)
  const psc = getControl(reader)
  t.ok(psc)
  t.equal(psc.type, '2.16.840.1.113730.3.4.3')
  t.ok(psc.criticality)
  t.equal(psc.value.changeTypes, 15)
  t.equal(psc.value.changesOnly, false)
  t.equal(psc.value.returnECs, false)

  t.end()
})

test('getControl with args', function (t) {
  const buf = Buffer.from([
    0x30, 0x26, 0x04, 0x17, 0x32, 0x2e, 0x31, 0x36, 0x2e, 0x38, 0x34, 0x30,
    0x2e, 0x31, 0x2e, 0x31, 0x31, 0x33, 0x37, 0x33, 0x30, 0x2e, 0x33, 0x2e,
    0x34, 0x2e, 0x33, 0x04, 0x0b, 0x30, 0x09, 0x02, 0x01, 0x0f, 0x01, 0x01,
    0xff, 0x01, 0x01, 0xff])

  const ber = new BerReader(buf)
  const psc = getControl(ber)
  t.ok(psc)
  t.equal(psc.type, '2.16.840.1.113730.3.4.3')
  t.equal(psc.criticality, false)
  t.equal(psc.value.changeTypes, 15)
  t.equal(psc.value.changesOnly, true)
  t.equal(psc.value.returnECs, true)
  t.end()
})

test('tober', function (t) {
  const psc = new PersistentSearchControl({
    type: '2.16.840.1.113730.3.4.3',
    criticality: true,
    value: {
      changeTypes: 15,
      changesOnly: false,
      returnECs: false
    }
  })

  const ber = new BerWriter()
  psc.toBer(ber)

  const c = getControl(new BerReader(ber.buffer))
  t.ok(c)
  t.equal(c.type, '2.16.840.1.113730.3.4.3')
  t.ok(c.criticality)
  t.equal(c.value.changeTypes, 15)
  t.equal(c.value.changesOnly, false)
  t.equal(c.value.returnECs, false)
  t.end()
})

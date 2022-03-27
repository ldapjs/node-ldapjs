'use strict'

const { test } = require('tap')
const { BerReader, BerWriter } = require('@ldapjs/asn1')
const { Control, getControl } = require('../../lib')

test('new no args', function (t) {
  t.ok(new Control())
  t.end()
})

test('new with args', function (t) {
  const c = new Control({
    type: '2.16.840.1.113730.3.4.2',
    criticality: true
  })
  t.ok(c)
  t.equal(c.type, '2.16.840.1.113730.3.4.2')
  t.ok(c.criticality)
  t.end()
})

test('parse', function (t) {
  const ber = new BerWriter()
  ber.startSequence()
  ber.writeString('2.16.840.1.113730.3.4.2')
  ber.writeBoolean(true)
  ber.writeString('foo')
  ber.endSequence()

  const c = getControl(new BerReader(ber.buffer))

  t.ok(c)
  t.equal(c.type, '2.16.840.1.113730.3.4.2')
  t.ok(c.criticality)
  t.equal(c.value.toString('utf8'), 'foo')
  t.end()
})

test('parse no value', function (t) {
  const ber = new BerWriter()
  ber.startSequence()
  ber.writeString('2.16.840.1.113730.3.4.2')
  ber.endSequence()

  const c = getControl(new BerReader(ber.buffer))

  t.ok(c)
  t.equal(c.type, '2.16.840.1.113730.3.4.2')
  t.equal(c.criticality, false)
  t.notOk(c.value, null)
  t.end()
})

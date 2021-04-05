'use strict'

const { test } = require('tap')
const { BerReader, BerWriter } = require('asn1')
const { getControl, PagedResultsControl } = require('../../lib')

test('new no args', function (t) {
  t.ok(new PagedResultsControl())
  t.end()
})

test('new with args', function (t) {
  const c = new PagedResultsControl({
    type: '1.2.840.113556.1.4.319',
    criticality: true,
    value: {
      size: 1000,
      cookie: Buffer.from([1, 2, 3])
    }
  })
  t.ok(c)
  t.equal(c.type, '1.2.840.113556.1.4.319')
  t.ok(c.criticality)
  t.equal(c.value.size, 1000)
  t.equal(Buffer.compare(c.value.cookie, Buffer.from([1, 2, 3])), 0)

  const writer = new BerWriter()
  c.toBer(writer)
  const reader = new BerReader(writer.buffer)
  const psc = getControl(reader)
  t.ok(psc)
  t.equal(psc.type, '1.2.840.113556.1.4.319')
  t.ok(psc.criticality)
  t.equal(psc.value.size, 1000)
  t.equal(Buffer.compare(psc.value.cookie, Buffer.from([1, 2, 3])), 0)

  t.end()
})

test('tober', function (t) {
  const psc = new PagedResultsControl({
    type: '1.2.840.113556.1.4.319',
    criticality: true,
    value: {
      size: 20,
      cookie: Buffer.alloc(0)
    }
  })

  const ber = new BerWriter()
  psc.toBer(ber)

  const c = getControl(new BerReader(ber.buffer))
  t.ok(c)
  t.equal(c.type, '1.2.840.113556.1.4.319')
  t.ok(c.criticality)
  t.equal(c.value.size, 20)
  t.equal(Buffer.compare(c.value.cookie, Buffer.alloc(0)), 0)

  t.end()
})

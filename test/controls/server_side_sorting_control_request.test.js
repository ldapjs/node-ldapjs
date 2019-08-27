'use strict'

const { test } = require('tap')
const { BerReader, BerWriter } = require('asn1')
const { getControl, ServerSideSortingRequestControl: SSSRControl } = require('../../lib')

test('new no args', function (t) {
  t.ok(new SSSRControl())
  t.end()
})

test('new with args', function (t) {
  const c = new SSSRControl({
    criticality: true,
    value: {
      attributeType: 'sn'
    }
  })
  t.ok(c)
  t.equal(c.type, '1.2.840.113556.1.4.473')
  t.ok(c.criticality)
  t.equal(c.value.length, 1)
  t.equal(c.value[0].attributeType, 'sn')

  t.end()
})

test('toBer - object', function (t) {
  const sssc = new SSSRControl({
    criticality: true,
    value: {
      attributeType: 'sn',
      orderingRule: 'caseIgnoreOrderingMatch',
      reverseOrder: true
    }
  })

  const ber = new BerWriter()
  sssc.toBer(ber)

  const c = getControl(new BerReader(ber.buffer))
  t.ok(c)
  t.equal(c.type, '1.2.840.113556.1.4.473')
  t.ok(c.criticality)
  t.equal(c.value[0].attributeType, 'sn')
  t.equal(c.value[0].orderingRule, 'caseIgnoreOrderingMatch')
  t.equal(c.value[0].reverseOrder, true)

  t.end()
})

test('toBer - array', function (t) {
  const sssc = new SSSRControl({
    criticality: true,
    value: [
      {
        attributeType: 'sn',
        orderingRule: 'caseIgnoreOrderingMatch',
        reverseOrder: true
      },
      {
        attributeType: 'givenName',
        orderingRule: 'caseIgnoreOrderingMatch'
      }
    ]
  })

  const ber = new BerWriter()
  sssc.toBer(ber)

  const c = getControl(new BerReader(ber.buffer))
  t.ok(c)
  t.equal(c.type, '1.2.840.113556.1.4.473')
  t.ok(c.criticality)
  t.equal(c.value.length, 2)
  t.equal(c.value[0].attributeType, 'sn')
  t.equal(c.value[0].orderingRule, 'caseIgnoreOrderingMatch')
  t.equal(c.value[0].reverseOrder, true)
  t.equal(c.value[1].attributeType, 'givenName')
  t.equal(c.value[1].orderingRule, 'caseIgnoreOrderingMatch')

  t.end()
})

test('toBer - empty', function (t) {
  const sssc = new SSSRControl()
  const ber = new BerWriter()
  sssc.toBer(ber)

  const c = getControl(new BerReader(ber.buffer))
  t.ok(c)
  t.equal(c.type, '1.2.840.113556.1.4.473')
  t.equal(c.value.length, 0)
  t.end()
})

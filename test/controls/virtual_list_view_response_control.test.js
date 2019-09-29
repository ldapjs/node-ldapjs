'use strict'

const { test } = require('tap')
const { BerReader, BerWriter } = require('asn1')
const ldap = require('../../lib')
const { getControl, VirtualListViewResponseControl: VLVResponseControl } = require('../../lib')
const OID = '2.16.840.1.113730.3.4.10'

test('VLV response - new no args', function (t) {
  const c = new VLVResponseControl()
  t.ok(c)
  t.equal(c.type, OID)
  t.equal(c.criticality, false)
  t.end()
})

test('VLV response - new with args', function (t) {
  const c = new VLVResponseControl({
    criticality: true,
    value: {
      result: ldap.LDAP_SUCCESS,
      targetPosition: 0,
      contentCount: 10
    }
  })
  t.ok(c)
  t.equal(c.type, OID)
  t.equal(c.criticality, false)
  t.equal(c.value.result, ldap.LDAP_SUCCESS)
  t.equal(c.value.targetPosition, 0)
  t.equal(c.value.contentCount, 10)
  t.end()
})

test('VLV response - toBer', function (t) {
  const vlpc = new VLVResponseControl({
    value: {
      targetPosition: 0,
      contentCount: 10,
      result: ldap.LDAP_SUCCESS
    }
  })

  const ber = new BerWriter()
  vlpc.toBer(ber)

  const c = getControl(new BerReader(ber.buffer))
  t.ok(c)
  t.equal(c.type, OID)
  t.equal(c.criticality, false)
  t.equal(c.value.result, ldap.LDAP_SUCCESS)
  t.equal(c.value.targetPosition, 0)
  t.equal(c.value.contentCount, 10)
  t.end()
})

test('VLV response - toBer - empty', function (t) {
  const vlpc = new VLVResponseControl()
  const ber = new BerWriter()
  vlpc.toBer(ber)

  const c = getControl(new BerReader(ber.buffer))
  t.ok(c)
  t.equal(c.type, OID)
  t.equal(c.criticality, false)
  t.notOk(c.value.result)
  t.end()
})

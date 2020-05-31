'use strict'

const { test } = require('tap')
const { BerReader, BerWriter } = require('asn1')
const ldap = require('../../lib')
const { getControl, ServerSideSortingResponseControl: SSSResponseControl } = ldap
const OID = '1.2.840.113556.1.4.474'

test('new no args', function (t) {
  const c = new SSSResponseControl()
  t.ok(c)
  t.equal(c.type, OID)
  t.equal(c.criticality, false)
  t.end()
})

test('new with args', function (t) {
  const c = new SSSResponseControl({
    criticality: true,
    value: {
      result: ldap.LDAP_SUCCESS,
      failedAttribute: 'cn'
    }
  })
  t.ok(c)
  t.equal(c.type, OID)
  t.equal(c.criticality, false)
  t.equal(c.value.result, ldap.LDAP_SUCCESS)
  t.equal(c.value.failedAttribute, 'cn')

  t.end()
})

test('toBer - success', function (t) {
  const sssc = new SSSResponseControl({
    value: {
      result: ldap.LDAP_SUCCESS,
      failedAttribute: 'foobar'
    }
  })

  const ber = new BerWriter()
  sssc.toBer(ber)

  const c = getControl(new BerReader(ber.buffer))
  t.ok(c)
  t.equal(c.type, '1.2.840.113556.1.4.474')
  t.equal(c.criticality, false)
  t.equal(c.value.result, ldap.LDAP_SUCCESS)
  t.notOk(c.value.failedAttribute)
  t.end()
})

test('toBer - simple failure', function (t) {
  const sssc = new SSSResponseControl({
    value: {
      result: ldap.LDAP_NO_SUCH_ATTRIBUTE
    }
  })

  const ber = new BerWriter()
  sssc.toBer(ber)

  const c = getControl(new BerReader(ber.buffer))
  t.ok(c)
  t.equal(c.type, OID)
  t.equal(c.criticality, false)
  t.equal(c.value.result, ldap.LDAP_NO_SUCH_ATTRIBUTE)
  t.notOk(c.value.failedAttribute)
  t.end()
})

test('toBer - detailed failure', function (t) {
  const sssc = new SSSResponseControl({
    value: {
      result: ldap.LDAP_NO_SUCH_ATTRIBUTE,
      failedAttribute: 'foobar'
    }
  })

  const ber = new BerWriter()
  sssc.toBer(ber)

  const c = getControl(new BerReader(ber.buffer))
  t.ok(c)
  t.equal(c.type, OID)
  t.equal(c.criticality, false)
  t.equal(c.value.result, ldap.LDAP_NO_SUCH_ATTRIBUTE)
  t.equal(c.value.failedAttribute, 'foobar')
  t.end()
})

test('toBer - empty', function (t) {
  const sssc = new SSSResponseControl()
  const ber = new BerWriter()
  sssc.toBer(ber)

  const c = getControl(new BerReader(ber.buffer))
  t.ok(c)
  t.equal(c.type, OID)
  t.equal(c.criticality, false)
  t.notOk(c.value.result)
  t.notOk(c.value.failedAttribute)
  t.end()
})

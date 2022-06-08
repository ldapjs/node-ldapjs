'use strict'

const { test } = require('tap')
const { BerReader, BerWriter } = require('@ldapjs/asn1')
const { ModifyDNRequest, dn } = require('../../lib')

test('new no args', function (t) {
  t.ok(new ModifyDNRequest())
  t.end()
})

test('new with args', function (t) {
  const req = new ModifyDNRequest({
    entry: dn.parse('cn=foo, o=test'),
    newRdn: dn.parse('cn=foo2'),
    deleteOldRdn: true
  })
  t.ok(req)
  t.equal(req.dn.toString(), 'cn=foo, o=test')
  t.equal(req.newRdn.toString(), 'cn=foo2')
  t.equal(req.deleteOldRdn, true)
  t.end()
})

test('parse', function (t) {
  const ber = new BerWriter()
  ber.writeString('cn=foo, o=test')
  ber.writeString('cn=foo2')
  ber.writeBoolean(true)

  const req = new ModifyDNRequest()
  t.ok(req._parse(new BerReader(ber.buffer)))
  t.equal(req.dn.toString(), 'cn=foo, o=test')
  t.equal(req.newRdn.toString(), 'cn=foo2')
  t.equal(req.deleteOldRdn, true)

  t.end()
})

test('toBer', function (t) {
  const req = new ModifyDNRequest({
    messageID: 123,
    entry: dn.parse('cn=foo, o=test'),
    newRdn: dn.parse('cn=foo2'),
    deleteOldRdn: true
  })

  t.ok(req)

  const ber = new BerReader(req.toBer())
  t.ok(ber)
  t.equal(ber.readSequence(), 0x30)
  t.equal(ber.readInt(), 123)
  t.equal(ber.readSequence(), 0x6c)
  t.equal(ber.readString(), 'cn=foo, o=test')
  t.equal(ber.readString(), 'cn=foo2')
  t.equal(ber.readBoolean(), true)

  t.end()
})

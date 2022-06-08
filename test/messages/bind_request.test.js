'use strict'

const { test } = require('tap')
const { BerReader, BerWriter } = require('@ldapjs/asn1')
const { BindRequest, dn } = require('../../lib')

test('new no args', function (t) {
  t.ok(new BindRequest())
  t.end()
})

test('new with args', function (t) {
  const req = new BindRequest({
    version: 3,
    name: dn.parse('cn=root'),
    credentials: 'secret'
  })
  t.ok(req)
  t.equal(req.version, 3)
  t.equal(req.name.toString(), 'cn=root')
  t.equal(req.credentials, 'secret')
  t.end()
})

test('parse', function (t) {
  const ber = new BerWriter()
  ber.writeInt(3)
  ber.writeString('cn=root')
  ber.writeString('secret', 0x80)

  const req = new BindRequest()
  t.ok(req._parse(new BerReader(ber.buffer)))
  t.equal(req.version, 3)
  t.equal(req.dn.toString(), 'cn=root')
  t.equal(req.credentials, 'secret')
  t.end()
})

test('toBer', function (t) {
  const req = new BindRequest({
    messageID: 123,
    version: 3,
    name: dn.parse('cn=root'),
    credentials: 'secret'
  })
  t.ok(req)

  const ber = new BerReader(req.toBer())
  t.ok(ber)
  t.equal(ber.readSequence(), 0x30)
  t.equal(ber.readInt(), 123)
  t.equal(ber.readSequence(), 0x60)
  t.equal(ber.readInt(), 0x03)
  t.equal(ber.readString(), 'cn=root')
  t.equal(ber.readString(0x80), 'secret')

  t.end()
})

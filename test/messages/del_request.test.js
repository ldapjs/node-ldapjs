'use strict'

const { test } = require('tap')
const { BerReader, BerWriter } = require('asn1')
const { DeleteRequest, dn } = require('../../lib')

test('new no args', function (t) {
  t.ok(new DeleteRequest())
  t.end()
})

test('new with args', function (t) {
  const req = new DeleteRequest({
    entry: dn.parse('cn=test')
  })
  t.ok(req)
  t.equal(req.dn.toString(), 'cn=test')
  t.end()
})

test('parse', function (t) {
  const ber = new BerWriter()
  ber.writeString('cn=test', 0x4a)

  const req = new DeleteRequest()
  const reader = new BerReader(ber.buffer)
  reader.readSequence(0x4a)
  t.ok(req.parse(reader, reader.length))
  t.equal(req.dn.toString(), 'cn=test')
  t.end()
})

test('toBer', function (t) {
  const req = new DeleteRequest({
    messageID: 123,
    entry: dn.parse('cn=test')
  })
  t.ok(req)

  const ber = new BerReader(req.toBer())
  t.ok(ber)
  t.equal(ber.readSequence(), 0x30)
  t.equal(ber.readInt(), 123)
  t.equal(ber.readString(0x4a), 'cn=test')

  t.end()
})

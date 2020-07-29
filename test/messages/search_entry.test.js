'use strict'

const { test } = require('tap')
const { BerReader, BerWriter } = require('asn1')
const { SearchEntry, Attribute, dn } = require('../../lib')

test('new no args', function (t) {
  t.ok(new SearchEntry())
  t.end()
})

test('new with args', function (t) {
  const res = new SearchEntry({
    messageID: 123,
    objectName: dn.parse('cn=foo, o=test'),
    attributes: [new Attribute({ type: 'cn', vals: ['foo'] }),
      new Attribute({ type: 'objectclass', vals: ['person'] })]
  })
  t.ok(res)
  t.equal(res.messageID, 123)
  t.equal(res.dn.toString(), 'cn=foo, o=test')
  t.equal(res.attributes.length, 2)
  t.equal(res.attributes[0].type, 'cn')
  t.equal(res.attributes[0].vals[0], 'foo')
  t.equal(res.attributes[1].type, 'objectclass')
  t.equal(res.attributes[1].vals[0], 'person')
  t.end()
})

test('parse', function (t) {
  const ber = new BerWriter()
  ber.writeString('cn=foo, o=test')

  ber.startSequence()

  ber.startSequence()
  ber.writeString('cn')
  ber.startSequence(0x31)
  ber.writeString('foo')
  ber.endSequence()
  ber.endSequence()

  ber.startSequence()
  ber.writeString('objectclass')
  ber.startSequence(0x31)
  ber.writeString('person')
  ber.endSequence()
  ber.endSequence()

  ber.endSequence()

  const res = new SearchEntry()
  t.ok(res._parse(new BerReader(ber.buffer)))
  t.equal(res.dn, 'cn=foo, o=test')
  t.equal(res.attributes.length, 2)
  t.equal(res.attributes[0].type, 'cn')
  t.equal(res.attributes[0].vals[0], 'foo')
  t.equal(res.attributes[1].type, 'objectclass')
  t.equal(res.attributes[1].vals[0], 'person')
  t.end()
})

test('toBer', function (t) {
  const res = new SearchEntry({
    messageID: 123,
    objectName: dn.parse('cn=foo, o=test'),
    attributes: [new Attribute({ type: 'cn', vals: ['foo'] }),
      new Attribute({ type: 'objectclass', vals: ['person'] })]
  })
  t.ok(res)

  const ber = new BerReader(res.toBer())
  t.ok(ber)
  t.equal(ber.readSequence(), 0x30)
  t.equal(ber.readInt(), 123)
  t.equal(ber.readSequence(), 0x64)
  t.equal(ber.readString(), 'cn=foo,o=test')
  t.ok(ber.readSequence())

  t.ok(ber.readSequence())
  t.equal(ber.readString(), 'cn')
  t.equal(ber.readSequence(), 0x31)
  t.equal(ber.readString(), 'foo')

  t.ok(ber.readSequence())
  t.equal(ber.readString(), 'objectclass')
  t.equal(ber.readSequence(), 0x31)
  t.equal(ber.readString(), 'person')

  t.end()
})

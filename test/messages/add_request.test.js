'use strict'

const { test } = require('tap')
const { BerReader, BerWriter } = require('asn1')
const { AddRequest, Attribute, dn } = require('../../lib')

test('new no args', t => {
  t.ok(new AddRequest())
  t.end()
})

test('new with args', t => {
  const req = new AddRequest({
    entry: dn.parse('cn=foo, o=test'),
    attributes: [new Attribute({ type: 'cn', vals: ['foo'] }),
      new Attribute({ type: 'objectclass', vals: ['person'] })]
  })
  t.ok(req)
  t.equal(req.dn.toString(), 'cn=foo, o=test')
  t.equal(req.attributes.length, 2)
  t.equal(req.attributes[0].type, 'cn')
  t.equal(req.attributes[0].vals[0], 'foo')
  t.equal(req.attributes[1].type, 'objectclass')
  t.equal(req.attributes[1].vals[0], 'person')
  t.end()
})

test('parse', t => {
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

  const req = new AddRequest()
  t.ok(req._parse(new BerReader(ber.buffer)))
  t.equal(req.dn.toString(), 'cn=foo, o=test')
  t.equal(req.attributes.length, 2)
  t.equal(req.attributes[0].type, 'cn')
  t.equal(req.attributes[0].vals[0], 'foo')
  t.equal(req.attributes[1].type, 'objectclass')
  t.equal(req.attributes[1].vals[0], 'person')
  t.end()
})

test('toBer', t => {
  const req = new AddRequest({
    messageID: 123,
    entry: dn.parse('cn=foo, o=test'),
    attributes: [new Attribute({ type: 'cn', vals: ['foo'] }),
      new Attribute({ type: 'objectclass', vals: ['person'] })]
  })

  t.ok(req)

  const ber = new BerReader(req.toBer())
  t.ok(ber)
  t.equal(ber.readSequence(), 0x30)
  t.equal(ber.readInt(), 123)
  t.equal(ber.readSequence(), 0x68)
  t.equal(ber.readString(), 'cn=foo, o=test')
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

test('toObject', t => {
  const req = new AddRequest({
    entry: dn.parse('cn=foo, o=test'),
    attributes: [new Attribute({ type: 'cn', vals: ['foo', 'bar'] }),
      new Attribute({ type: 'objectclass', vals: ['person'] })]
  })

  t.ok(req)

  const obj = req.toObject()
  t.ok(obj)

  t.ok(obj.dn)
  t.equal(obj.dn, 'cn=foo, o=test')
  t.ok(obj.attributes)
  t.ok(obj.attributes.cn)
  t.ok(Array.isArray(obj.attributes.cn))
  t.equal(obj.attributes.cn.length, 2)
  t.equal(obj.attributes.cn[0], 'foo')
  t.equal(obj.attributes.cn[1], 'bar')
  t.ok(obj.attributes.objectclass)
  t.ok(Array.isArray(obj.attributes.objectclass))
  t.equal(obj.attributes.objectclass.length, 1)
  t.equal(obj.attributes.objectclass[0], 'person')

  t.end()
})

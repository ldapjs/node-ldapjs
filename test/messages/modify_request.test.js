'use strict'

const { test } = require('tap')
const { BerReader, BerWriter } = require('asn1')
const { ModifyRequest, Attribute, Change, dn } = require('../../lib')

test('new no args', function (t) {
  t.ok(new ModifyRequest())
  t.end()
})

test('new with args', function (t) {
  const req = new ModifyRequest({
    object: dn.parse('cn=foo, o=test'),
    changes: [new Change({
      operation: 'Replace',
      modification: new Attribute({ type: 'objectclass', vals: ['person'] })
    })]
  })
  t.ok(req)
  t.equal(req.dn.toString(), 'cn=foo, o=test')
  t.equal(req.changes.length, 1)
  t.equal(req.changes[0].operation, 'replace')
  t.equal(req.changes[0].modification.type, 'objectclass')
  t.equal(req.changes[0].modification.vals[0], 'person')
  t.end()
})

test('parse', function (t) {
  const ber = new BerWriter()
  ber.writeString('cn=foo, o=test')
  ber.startSequence()

  ber.startSequence()
  ber.writeEnumeration(0x02)

  ber.startSequence()
  ber.writeString('objectclass')
  ber.startSequence(0x31)
  ber.writeString('person')
  ber.endSequence()
  ber.endSequence()

  ber.endSequence()

  ber.endSequence()

  const req = new ModifyRequest()
  t.ok(req._parse(new BerReader(ber.buffer)))
  t.equal(req.dn.toString(), 'cn=foo, o=test')
  t.equal(req.changes.length, 1)
  t.equal(req.changes[0].operation, 'replace')
  t.equal(req.changes[0].modification.type, 'objectclass')
  t.equal(req.changes[0].modification.vals[0], 'person')
  t.end()
})

test('toBer', function (t) {
  const req = new ModifyRequest({
    messageID: 123,
    object: dn.parse('cn=foo, o=test'),
    changes: [new Change({
      operation: 'Replace',
      modification: new Attribute({ type: 'objectclass', vals: ['person'] })
    })]
  })

  t.ok(req)

  const ber = new BerReader(req.toBer())
  t.ok(ber)
  t.equal(ber.readSequence(), 0x30)
  t.equal(ber.readInt(), 123)
  t.equal(ber.readSequence(), 0x66)
  t.equal(ber.readString(), 'cn=foo, o=test')
  t.ok(ber.readSequence())
  t.ok(ber.readSequence())
  t.equal(ber.readEnumeration(), 0x02)

  t.ok(ber.readSequence())
  t.equal(ber.readString(), 'objectclass')
  t.equal(ber.readSequence(), 0x31)
  t.equal(ber.readString(), 'person')

  t.end()
})

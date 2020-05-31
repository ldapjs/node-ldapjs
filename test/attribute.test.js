'use strict'

const { test } = require('tap')
const { BerReader, BerWriter } = require('asn1')
const { Attribute } = require('../lib')

test('new no args', function (t) {
  t.ok(new Attribute())
  t.end()
})

test('new with args', function (t) {
  let attr = new Attribute({
    type: 'cn',
    vals: ['foo', 'bar']
  })
  t.ok(attr)
  attr.addValue('baz')
  t.equal(attr.type, 'cn')
  t.equal(attr.vals.length, 3)
  t.equal(attr.vals[0], 'foo')
  t.equal(attr.vals[1], 'bar')
  t.equal(attr.vals[2], 'baz')
  t.throws(function () {
    attr = new Attribute('not an object')
  })
  t.throws(function () {
    const typeThatIsNotAString = 1
    attr = new Attribute({
      type: typeThatIsNotAString
    })
  })
  t.end()
})

test('toBer', function (t) {
  const attr = new Attribute({
    type: 'cn',
    vals: ['foo', 'bar']
  })
  t.ok(attr)
  const ber = new BerWriter()
  attr.toBer(ber)
  const reader = new BerReader(ber.buffer)
  t.ok(reader.readSequence())
  t.equal(reader.readString(), 'cn')
  t.equal(reader.readSequence(), 0x31) // lber set
  t.equal(reader.readString(), 'foo')
  t.equal(reader.readString(), 'bar')
  t.end()
})

test('parse', function (t) {
  const ber = new BerWriter()
  ber.startSequence()
  ber.writeString('cn')
  ber.startSequence(0x31)
  ber.writeStringArray(['foo', 'bar'])
  ber.endSequence()
  ber.endSequence()

  const attr = new Attribute()
  t.ok(attr)
  t.ok(attr.parse(new BerReader(ber.buffer)))

  t.equal(attr.type, 'cn')
  t.equal(attr.vals.length, 2)
  t.equal(attr.vals[0], 'foo')
  t.equal(attr.vals[1], 'bar')
  t.end()
})

test('parse - without 0x31', function (t) {
  const ber = new BerWriter()
  ber.startSequence()
  ber.writeString('sn')
  ber.endSequence()

  const attr = new Attribute()
  t.ok(attr)
  t.ok(attr.parse(new BerReader(ber.buffer)))

  t.equal(attr.type, 'sn')
  t.equal(attr.vals.length, 0)

  t.end()
})

test('toString', function (t) {
  const attr = new Attribute({
    type: 'foobar',
    vals: ['asdf']
  })
  const expected = attr.toString()
  const actual = JSON.stringify(attr.json)
  t.equal(actual, expected)
  t.end()
})

test('isAttribute', function (t) {
  const isA = Attribute.isAttribute
  t.notOk(isA(null))
  t.notOk(isA('asdf'))
  t.ok(isA(new Attribute({
    type: 'foobar',
    vals: ['asdf']
  })))

  t.ok(isA({
    type: 'foo',
    vals: ['item', Buffer.alloc(5)],
    toBer: function () { /* placeholder */ }
  }))

  // bad type in vals
  t.notOk(isA({
    type: 'foo',
    vals: ['item', null],
    toBer: function () { /* placeholder */ }
  }))

  t.end()
})

test('compare', function (t) {
  const comp = Attribute.compare
  const a = new Attribute({
    type: 'foo',
    vals: ['bar']
  })
  const b = new Attribute({
    type: 'foo',
    vals: ['bar']
  })
  const notAnAttribute = 'this is not an attribute'

  t.throws(function () {
    comp(a, notAnAttribute)
  })
  t.throws(function () {
    comp(notAnAttribute, b)
  })

  t.equal(comp(a, b), 0)

  // Different types
  a.type = 'boo'
  t.equal(comp(a, b), -1)
  t.equal(comp(b, a), 1)
  a.type = 'foo'

  // Different value counts
  a.vals = ['bar', 'baz']
  t.equal(comp(a, b), 1)
  t.equal(comp(b, a), -1)

  // Different value contents (same count)
  a.vals = ['baz']
  t.equal(comp(a, b), 1)
  t.equal(comp(b, a), -1)

  t.end()
})

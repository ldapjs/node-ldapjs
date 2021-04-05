'use strict'

const fs = require('fs')
const path = require('path')
const { test } = require('tap')
const { BerReader, BerWriter } = require('asn1')
const { Attribute, Change } = require('../lib')

test('new no args', function (t) {
  t.ok(new Change())
  t.end()
})

test('new with args', function (t) {
  const change = new Change({
    operation: 'add',
    modification: new Attribute({
      type: 'cn',
      vals: ['foo', 'bar']
    })
  })
  t.ok(change)

  t.equal(change.operation, 'add')
  t.equal(change.modification.type, 'cn')
  t.equal(change.modification.vals.length, 2)
  t.equal(change.modification.vals[0], 'foo')
  t.equal(change.modification.vals[1], 'bar')

  t.end()
})

test('new with args and buffer', function (t) {
  const img = fs.readFileSync(path.join(__dirname, '/imgs/test.jpg'))

  const change = new Change({
    operation: 'add',
    modification: {
      thumbnailPhoto: img
    }
  })

  t.ok(change)

  t.equal(change.operation, 'add')
  t.equal(change.modification.type, 'thumbnailPhoto')
  t.equal(change.modification.vals.length, 1)
  t.equal(change.modification.buffers[0].compare(img), 0)

  t.end()
})

test('validate fields', function (t) {
  const c = new Change()
  t.ok(c)
  t.throws(function () {
    c.operation = 'bogus'
  })
  t.throws(function () {
    c.modification = { too: 'many', fields: 'here' }
  })
  c.modification = {
    foo: ['bar', 'baz']
  }
  t.ok(c.modification)
  t.end()
})

test('GH-31 (multiple attributes per Change)', function (t) {
  t.throws(function () {
    const c = new Change({
      operation: 'replace',
      modification: {
        cn: 'foo',
        sn: 'bar'
      }
    })
    t.notOk(c)
  })
  t.end()
})

test('toBer', function (t) {
  const change = new Change({
    operation: 'Add',
    modification: new Attribute({
      type: 'cn',
      vals: ['foo', 'bar']
    })
  })
  t.ok(change)

  const ber = new BerWriter()
  change.toBer(ber)
  const reader = new BerReader(ber.buffer)
  t.ok(reader.readSequence())
  t.equal(reader.readEnumeration(), 0x00)
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
  ber.writeEnumeration(0x00)
  ber.startSequence()
  ber.writeString('cn')
  ber.startSequence(0x31)
  ber.writeStringArray(['foo', 'bar'])
  ber.endSequence()
  ber.endSequence()
  ber.endSequence()

  const change = new Change()
  t.ok(change)
  t.ok(change.parse(new BerReader(ber.buffer)))

  t.equal(change.operation, 'add')
  t.equal(change.modification.type, 'cn')
  t.equal(change.modification.vals.length, 2)
  t.equal(change.modification.vals[0], 'foo')
  t.equal(change.modification.vals[1], 'bar')

  t.end()
})

test('apply - replace', function (t) {
  let res
  const single = new Change({
    operation: 'replace',
    modification: {
      type: 'cn',
      vals: ['new']
    }
  })
  const twin = new Change({
    operation: 'replace',
    modification: {
      type: 'cn',
      vals: ['new', 'two']
    }
  })
  const empty = new Change({
    operation: 'replace',
    modification: {
      type: 'cn',
      vals: []
    }
  })

  // plain
  res = Change.apply(single, { cn: ['old'] })
  t.same(res.cn, ['new'])

  // multiple
  res = Change.apply(single, { cn: ['old', 'also'] })
  t.same(res.cn, ['new'])

  // empty
  res = Change.apply(empty, { cn: ['existing'] })
  t.equal(res.cn, undefined)
  t.ok(Object.keys(res).indexOf('cn') === -1)

  // absent
  res = Change.apply(single, { dn: ['otherjunk'] })
  t.same(res.cn, ['new'])

  // scalar formatting "success"
  res = Change.apply(single, { cn: 'old' }, true)
  t.equal(res.cn, 'new')

  // scalar formatting "failure"
  res = Change.apply(twin, { cn: 'old' }, true)
  t.same(res.cn, ['new', 'two'])

  t.end()
})

test('apply - add', function (t) {
  let res
  const single = new Change({
    operation: 'add',
    modification: {
      type: 'cn',
      vals: ['new']
    }
  })

  // plain
  res = Change.apply(single, { cn: ['old'] })
  t.same(res.cn, ['old', 'new'])

  // multiple
  res = Change.apply(single, { cn: ['old', 'also'] })
  t.same(res.cn, ['old', 'also', 'new'])

  // absent
  res = Change.apply(single, { dn: ['otherjunk'] })
  t.same(res.cn, ['new'])

  // scalar formatting "success"
  res = Change.apply(single, { }, true)
  t.equal(res.cn, 'new')

  // scalar formatting "failure"
  res = Change.apply(single, { cn: 'old' }, true)
  t.same(res.cn, ['old', 'new'])

  // duplicate add
  res = Change.apply(single, { cn: 'new' })
  t.same(res.cn, ['new'])

  t.end()
})

test('apply - delete', function (t) {
  let res
  const single = new Change({
    operation: 'delete',
    modification: {
      type: 'cn',
      vals: ['old']
    }
  })

  // plain
  res = Change.apply(single, { cn: ['old', 'new'] })
  t.same(res.cn, ['new'])

  // empty
  res = Change.apply(single, { cn: ['old'] })
  t.equal(res.cn, undefined)
  t.ok(Object.keys(res).indexOf('cn') === -1)

  // scalar formatting "success"
  res = Change.apply(single, { cn: ['old', 'one'] }, true)
  t.equal(res.cn, 'one')

  // scalar formatting "failure"
  res = Change.apply(single, { cn: ['old', 'several', 'items'] }, true)
  t.same(res.cn, ['several', 'items'])

  // absent
  res = Change.apply(single, { dn: ['otherjunk'] })
  t.ok(res)
  t.equal(res.cn, undefined)

  t.end()
})

'use strict'

const { test } = require('tap')
const { BerReader, BerWriter } = require('asn1')
const { filters: { SubstringFilter } } = require('../../lib')

test('Construct no args', function (t) {
  const f = new SubstringFilter()
  t.ok(f)
  t.ok(!f.attribute)
  t.ok(!f.value)
  t.end()
})

test('Construct args', function (t) {
  const f = new SubstringFilter({
    attribute: 'foo',
    initial: 'bar',
    any: ['zig', 'zag'],
    final: 'baz'
  })
  t.ok(f)
  t.equal(f.attribute, 'foo')
  t.equal(f.initial, 'bar')
  t.equal(f.any.length, 2)
  t.equal(f.any[0], 'zig')
  t.equal(f.any[1], 'zag')
  t.equal(f.final, 'baz')
  t.equal(f.toString(), '(foo=bar*zig*zag*baz)')
  t.end()
})

test('GH-109 = escape value only in toString()', function (t) {
  const f = new SubstringFilter({
    attribute: 'fo(o',
    initial: 'ba(r)',
    any: ['zi)g', 'z(ag'],
    final: '(baz)'
  })
  t.ok(f)
  t.equal(f.attribute, 'fo(o')
  t.equal(f.initial, 'ba(r)')
  t.equal(f.any.length, 2)
  t.equal(f.any[0], 'zi)g')
  t.equal(f.any[1], 'z(ag')
  t.equal(f.final, '(baz)')
  t.equal(f.toString(), '(fo\\28o=ba\\28r\\29*zi\\29g*z\\28ag*\\28baz\\29)')
  t.end()
})

test('match true', function (t) {
  const f = new SubstringFilter({
    attribute: 'foo',
    initial: 'bar',
    any: ['zig', 'zag'],
    final: 'baz'
  })
  t.ok(f)
  t.ok(f.matches({ foo: 'barmoozigbarzagblahbaz' }))
  t.end()
})

test('match false', function (t) {
  const f = new SubstringFilter({
    attribute: 'foo',
    initial: 'bar',
    foo: ['zig', 'zag'],
    final: 'baz'
  })
  t.ok(f)
  t.ok(!f.matches({ foo: 'bafmoozigbarzagblahbaz' }))
  t.end()
})

test('match any', function (t) {
  const f = new SubstringFilter({
    attribute: 'foo',
    initial: 'bar'
  })
  t.ok(f)
  t.ok(f.matches({ foo: ['beuha', 'barista'] }))
  t.end()
})

test('GH-109 = escape for regex in matches', function (t) {
  const f = new SubstringFilter({
    attribute: 'fo(o',
    initial: 'ba(r)',
    any: ['zi)g', 'z(ag'],
    final: '(baz)'
  })
  t.ok(f)
  t.ok(f.matches({ 'fo(o': ['ba(r)_zi)g-z(ag~(baz)'] }))
  t.end()
})

test('parse ok', function (t) {
  const writer = new BerWriter()
  writer.writeString('foo')
  writer.startSequence()
  writer.writeString('bar', 0x80)
  writer.writeString('bad', 0x81)
  writer.writeString('baz', 0x82)
  writer.endSequence()
  const f = new SubstringFilter()
  t.ok(f)
  t.ok(f.parse(new BerReader(writer.buffer)))
  t.ok(f.matches({ foo: 'bargoobadgoobaz' }))
  t.end()
})

test('parse bad', function (t) {
  const writer = new BerWriter()
  writer.writeString('foo')
  writer.writeInt(20)

  const f = new SubstringFilter()
  t.ok(f)
  try {
    f.parse(new BerReader(writer.buffer))
    t.fail('Should have thrown InvalidAsn1Error')
  } catch (e) {
  }
  t.end()
})

test('GH-109 = to ber uses plain values', function (t) {
  let f = new SubstringFilter({
    attribute: 'fo(o',
    initial: 'ba(r)',
    any: ['zi)g', 'z(ag'],
    final: '(baz)'
  })
  t.ok(f)
  const writer = new BerWriter()
  f.toBer(writer)

  f = new SubstringFilter()
  t.ok(f)

  const reader = new BerReader(writer.buffer)
  reader.readSequence()
  t.ok(f.parse(reader))

  t.equal(f.attribute, 'fo(o')
  t.equal(f.initial, 'ba(r)')
  t.equal(f.any.length, 2)
  t.equal(f.any[0], 'zi)g')
  t.equal(f.any[1], 'z(ag')
  t.equal(f.final, '(baz)')
  t.end()
})

'use strict'

const { BerReader } = require('@ldapjs/asn1')
const { EqualityFilter } = require('@ldapjs/filter')
const OrFilter = require('@ldapjs/filter/lib/filters/or')
const tap = require('tap')
const { parseFilter: parse } = require('../../lib')

tap.test('GH-48 XML Strings in filter', function (t) {
  const str = '(&(CentralUIEnrollments=\\<mydoc\\>*)(objectClass=User))'
  const f = parse(str)
  t.ok(f)
  t.ok(f.filters)
  t.equal(f.filters.length, 2)
  f.filters.forEach(function (filter) {
    t.ok(filter.attribute)
  })
  t.end()
})

tap.test('GH-50 = in filter', function (t) {
  const str = '(uniquemember=uuid=930896af-bf8c-48d4-885c-6573a94b1853, ' +
    'ou=users, o=smartdc)'
  const f = parse(str)
  t.ok(f)
  t.equal(f.attribute, 'uniquemember')
  t.equal(f.value,
    'uuid=930896af-bf8c-48d4-885c-6573a94b1853, ou=users, o=smartdc')
  t.end()
})

tap.test('convert to hex code', function (t) {
  const str = 'foo=bar\\(abcd\\e\\fg\\h\\69\\a'
  const f = parse(str)
  t.ok(f)
  t.equal(f.attribute, 'foo')
  t.equal(f.value, 'bar(abcdefghia')
  t.equal(f.toString(), '(foo=bar\\28abcdefghia)')
  t.end()
})

tap.test('( in filter', function (t) {
  const str = '(foo=bar\\()'
  const f = parse(str)
  t.ok(f)
  t.equal(f.attribute, 'foo')
  t.equal(f.value, 'bar(')
  t.equal(f.toString(), '(foo=bar\\28)')
  t.end()
})

tap.test(') in filter', function (t) {
  const str = '(foo=bar\\))'
  const f = parse(str)
  t.ok(f)
  t.equal(f.attribute, 'foo')
  t.equal(f.value, 'bar)')
  t.equal(f.toString(), '(foo=bar\\29)')
  t.end()
})

tap.test('\\ in filter', function (t) {
  const str = '(foo=bar\\\\)'
  const f = parse(str)
  t.ok(f)
  t.equal(f.attribute, 'foo')
  t.equal(f.value, 'bar\\')
  t.equal(f.toString(), '(foo=bar\\5c)')
  t.end()
})

tap.test('not escaped \\ at end of filter', function (t) {
  const str = 'foo=bar\\'
  const f = parse(str)
  t.ok(f)
  t.equal(f.attribute, 'foo')
  t.equal(f.value, 'bar\\')
  t.equal(f.toString(), '(foo=bar\\5c)')
  t.end()
})

tap.test('* in equality filter', function (t) {
  const str = '(foo=bar\\*)'
  const f = parse(str)
  t.ok(f)
  t.equal(f.attribute, 'foo')
  t.equal(f.value, 'bar*')
  t.equal(f.toString(), '(foo=bar\\2a)')
  t.end()
})

tap.test('* substr filter (prefix)', function (t) {
  const str = '(foo=bar*)'
  const f = parse(str)
  t.ok(f)
  t.equal(f.attribute, 'foo')
  t.equal(f.subInitial, 'bar')
  t.equal(f.toString(), '(foo=bar*)')
  t.end()
})

tap.test('GH-53 NotFilter', function (t) {
  const str = '(&(objectClass=person)(!(objectClass=shadowAccount)))'
  const f = parse(str)
  t.ok(f)
  t.equal(f.type, 'AndFilter')
  t.equal(f.filters.length, 2)
  t.equal(f.filters[0].type, 'EqualityFilter')
  t.equal(f.filters[1].type, 'NotFilter')
  t.equal(f.filters[1].filter.type, 'EqualityFilter')
  t.equal(f.filters[1].filter.attribute, 'objectClass')
  t.equal(f.filters[1].filter.value, 'shadowAccount')
  t.end()
})

tap.test('presence filter', function (t) {
  const f = parse('(foo=*)')
  t.ok(f)
  t.equal(f.type, 'PresenceFilter')
  t.equal(f.attribute, 'foo')
  t.equal(f.toString(), '(foo=*)')
  t.end()
})

tap.test('bogus filter', function (t) {
  t.throws(function () {
    parse('foo>1')
  })
  t.end()
})

tap.test('bogus filter !=', function (t) {
  t.throws(function () {
    parse('foo!=1')
  })
  t.end()
})

tap.test('mismatched parens', function (t) {
  t.throws(function () {
    parse('(&(foo=bar)(!(state=done))')
  })
  t.end()
})

tap.test('parseSet reads OR filter from BER', async t => {
  const { parse } = require('../../lib/filters/index')
  const expected = Buffer.from([
    0xa1, 0x1b,
    0xa3, 0x07, // eq filter
    0x04, 0x02, 0x63, 0x6e, 0x04, 0x01, 0x31, // string, 2 chars (cn), string 1 char (1)
    0xa3, 0x07, // eq filter
    0x04, 0x02, 0x63, 0x6e, 0x04, 0x01, 0x32, // string, 2 chars (cn), string 1 char (2)
    0xa3, 0x07, // eq filter
    0x04, 0x02, 0x63, 0x6e, 0x04, 0x01, 0x33 // string, 2 chars (cn), string 1 char (3)
  ])

  let f = new OrFilter()
  f.addFilter(new EqualityFilter({ attribute: 'cn', value: '1' }))
  f.addFilter(new EqualityFilter({ attribute: 'cn', value: '2' }))
  f.addFilter(new EqualityFilter({ attribute: 'cn', value: '3' }))

  const filterBuffer = f.toBer().buffer
  t.equal(expected.compare(filterBuffer), 0)

  const reader = new BerReader(filterBuffer)
  f = parse(reader)
  t.ok(f)
  t.equal(f.type, 'OrFilter')
  t.equal(f.filters.length, 3)
  for (let i = 1; i <= 3; i += 1) {
    const filter = f.filters[i - 1]
    t.equal(filter.attribute, 'cn')
    t.equal(filter.value, `${i}`)
  }
})

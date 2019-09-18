'use strict'

const { test } = require('tap')
const { parseFilter: parse } = require('../../lib')

test('GH-48 XML Strings in filter', function (t) {
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

test('GH-50 = in filter', function (t) {
  const str = '(uniquemember=uuid=930896af-bf8c-48d4-885c-6573a94b1853, ' +
    'ou=users, o=smartdc)'
  const f = parse(str)
  t.ok(f)
  t.equal(f.attribute, 'uniquemember')
  t.equal(f.value,
    'uuid=930896af-bf8c-48d4-885c-6573a94b1853, ou=users, o=smartdc')
  t.end()
})

test('convert to hex code', function (t) {
  const str = 'foo=bar\\(abcd\\e\\fg\\h\\69\\a'
  const f = parse(str)
  t.ok(f)
  t.equal(f.attribute, 'foo')
  t.equal(f.value, 'bar(abcdefghia')
  t.equal(f.toString(), '(foo=bar\\28abcdefghia)')
  t.end()
})

test('( in filter', function (t) {
  const str = '(foo=bar\\()'
  const f = parse(str)
  t.ok(f)
  t.equal(f.attribute, 'foo')
  t.equal(f.value, 'bar(')
  t.equal(f.toString(), '(foo=bar\\28)')
  t.end()
})

test(') in filter', function (t) {
  const str = '(foo=bar\\))'
  const f = parse(str)
  t.ok(f)
  t.equal(f.attribute, 'foo')
  t.equal(f.value, 'bar)')
  t.equal(f.toString(), '(foo=bar\\29)')
  t.end()
})

test('\\ in filter', function (t) {
  const str = '(foo=bar\\\\)'
  const f = parse(str)
  t.ok(f)
  t.equal(f.attribute, 'foo')
  t.equal(f.value, 'bar\\')
  t.equal(f.toString(), '(foo=bar\\5c)')
  t.end()
})

test('not escaped \\ at end of filter', function (t) {
  const str = 'foo=bar\\'
  const f = parse(str)
  t.ok(f)
  t.equal(f.attribute, 'foo')
  t.equal(f.value, 'bar\\')
  t.equal(f.toString(), '(foo=bar\\5c)')
  t.end()
})

test('* in equality filter', function (t) {
  const str = '(foo=bar\\*)'
  const f = parse(str)
  t.ok(f)
  t.equal(f.attribute, 'foo')
  t.equal(f.value, 'bar*')
  t.equal(f.toString(), '(foo=bar\\2a)')
  t.end()
})

test('* substr filter (prefix)', function (t) {
  const str = '(foo=bar*)'
  const f = parse(str)
  t.ok(f)
  t.equal(f.attribute, 'foo')
  t.equal(f.initial, 'bar')
  t.equal(f.toString(), '(foo=bar*)')
  t.end()
})

test('GH-53 NotFilter', function (t) {
  const str = '(&(objectClass=person)(!(objectClass=shadowAccount)))'
  const f = parse(str)
  t.ok(f)
  t.equal(f.type, 'and')
  t.equal(f.filters.length, 2)
  t.equal(f.filters[0].type, 'equal')
  t.equal(f.filters[1].type, 'not')
  t.equal(f.filters[1].filter.type, 'equal')
  t.equal(f.filters[1].filter.attribute, 'objectClass')
  t.equal(f.filters[1].filter.value, 'shadowAccount')
  t.end()
})

test('presence filter', function (t) {
  const f = parse('(foo=*)')
  t.ok(f)
  t.equal(f.type, 'present')
  t.equal(f.attribute, 'foo')
  t.equal(f.toString(), '(foo=*)')
  t.end()
})

test('bogus filter', function (t) {
  t.throws(function () {
    parse('foo>1')
  })
  t.end()
})

test('bogus filter !=', function (t) {
  t.throws(function () {
    parse('foo!=1')
  })
  t.end()
})

test('mismatched parens', function (t) {
  t.throws(function () {
    parse('(&(foo=bar)(!(state=done))')
  })
  t.end()
})

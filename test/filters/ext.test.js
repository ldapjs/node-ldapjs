'use strict'

const { test } = require('tap')
const { filters: { parseString, ExtensibleFilter } } = require('../../lib')

test('Construct no args', function (t) {
  const f = new ExtensibleFilter()
  t.ok(f)
  t.end()
})

test('Construct args', function (t) {
  const f = new ExtensibleFilter({
    matchType: 'foo',
    value: 'bar'
  })
  t.ok(f)
  t.equal(f.matchType, 'foo')
  t.equal(f.value, 'bar')
  t.equal(f.toString(), '(foo:=bar)')
  t.end()
})

test('parse RFC example 1', function (t) {
  const f = parseString('(cn:caseExactMatch:=Fred Flintstone)')
  t.ok(f)
  t.equal(f.matchType, 'cn')
  t.equal(f.matchingRule, 'caseExactMatch')
  t.equal(f.matchValue, 'Fred Flintstone')
  t.notOk(f.dnAttributes)
  t.end()
})

test('parse RFC example 2', function (t) {
  const f = parseString('(cn:=Betty Rubble)')
  t.ok(f)
  t.equal(f.matchType, 'cn')
  t.equal(f.matchValue, 'Betty Rubble')
  t.notOk(f.dnAttributes)
  t.notOk(f.matchingRule)
  t.end()
})

test('parse RFC example 3', function (t) {
  const f = parseString('(sn:dn:2.4.6.8.10:=Barney Rubble)')
  t.ok(f)
  t.equal(f.matchType, 'sn')
  t.equal(f.matchingRule, '2.4.6.8.10')
  t.equal(f.matchValue, 'Barney Rubble')
  t.ok(f.dnAttributes)
  t.end()
})

test('parse RFC example 3', function (t) {
  const f = parseString('(o:dn:=Ace Industry)')
  t.ok(f)
  t.equal(f.matchType, 'o')
  t.notOk(f.matchingRule)
  t.equal(f.matchValue, 'Ace Industry')
  t.ok(f.dnAttributes)
  t.end()
})

test('parse RFC example 4', function (t) {
  const f = parseString('(:1.2.3:=Wilma Flintstone)')
  t.ok(f)
  t.notOk(f.matchType)
  t.equal(f.matchingRule, '1.2.3')
  t.equal(f.matchValue, 'Wilma Flintstone')
  t.notOk(f.dnAttributes)
  t.end()
})

test('parse RFC example 5', function (t) {
  const f = parseString('(:DN:2.4.6.8.10:=Dino)')
  t.ok(f)
  t.notOk(f.matchType)
  t.equal(f.matchingRule, '2.4.6.8.10')
  t.equal(f.matchValue, 'Dino')
  t.ok(f.dnAttributes)
  t.end()
})

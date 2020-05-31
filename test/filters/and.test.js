'use strict'

const { test } = require('tap')
const { filters: { EqualityFilter, AndFilter } } = require('../../lib')

test('Construct no args', function (t) {
  t.ok(new AndFilter())
  t.end()
})

test('Construct args', function (t) {
  const f = new AndFilter()
  f.addFilter(new EqualityFilter({
    attribute: 'foo',
    value: 'bar'
  }))
  f.addFilter(new EqualityFilter({
    attribute: 'zig',
    value: 'zag'
  }))
  t.ok(f)
  t.equal(f.toString(), '(&(foo=bar)(zig=zag))')
  t.end()
})

test('match true', function (t) {
  const f = new AndFilter()
  f.addFilter(new EqualityFilter({
    attribute: 'foo',
    value: 'bar'
  }))
  f.addFilter(new EqualityFilter({
    attribute: 'zig',
    value: 'zag'
  }))
  t.ok(f)
  t.ok(f.matches({ foo: 'bar', zig: 'zag' }))
  t.end()
})

test('match false', function (t) {
  const f = new AndFilter()
  f.addFilter(new EqualityFilter({
    attribute: 'foo',
    value: 'bar'
  }))
  f.addFilter(new EqualityFilter({
    attribute: 'zig',
    value: 'zag'
  }))
  t.ok(f)
  t.ok(!f.matches({ foo: 'bar', zig: 'zonk' }))
  t.end()
})

'use strict'

const { test } = require('tap')
const { filters: { EqualityFilter, NotFilter } } = require('../../lib')

test('Construct no args', function (t) {
  t.ok(new NotFilter())
  t.end()
})

test('Construct args', function (t) {
  const f = new NotFilter({
    filter: new EqualityFilter({
      attribute: 'foo',
      value: 'bar'
    })
  })
  t.ok(f)
  t.equal(f.toString(), '(!(foo=bar))')
  t.end()
})

test('match true', function (t) {
  const f = new NotFilter({
    filter: new EqualityFilter({
      attribute: 'foo',
      value: 'bar'
    })
  })
  t.ok(f)
  t.ok(f.matches({ foo: 'baz' }))
  t.end()
})

test('match false', function (t) {
  const f = new NotFilter({
    filter: new EqualityFilter({
      attribute: 'foo',
      value: 'bar'
    })
  })
  t.ok(f)
  t.ok(!f.matches({ foo: 'bar' }))
  t.end()
})

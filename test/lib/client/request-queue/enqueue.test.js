'use strict'

const { test } = require('tap')
const enqueue = require('../../../../lib/client/request-queue/enqueue')

test('rejects new requests if size is exceeded', async t => {
  const q = { _queue: { length: 5 }, size: 5 }
  const result = enqueue.call(q, 'foo', 'bar', {}, {})
  t.notOk(result)
})

test('rejects new requests if queue is frozen', async t => {
  const q = { _queue: { length: 0 }, size: 5, _frozen: true }
  const result = enqueue.call(q, 'foo', 'bar', {}, {})
  t.notOk(result)
})

test('adds a request and returns if no timeout', async t => {
  const q = {
    _queue: {
      length: 0,
      add (obj) {
        t.same(obj, {
          message: 'foo',
          expect: 'bar',
          emitter: 'baz',
          cb: 'bif'
        })
      }
    },
    _frozen: false,
    timeout: 0
  }
  const result = enqueue.call(q, 'foo', 'bar', 'baz', 'bif')
  t.ok(result)
})

test('adds a request and returns timer not set', async t => {
  const q = {
    _queue: {
      length: 0,
      add (obj) {
        t.same(obj, {
          message: 'foo',
          expect: 'bar',
          emitter: 'baz',
          cb: 'bif'
        })
      }
    },
    _frozen: false,
    timeout: 100,
    _timer: null
  }
  const result = enqueue.call(q, 'foo', 'bar', 'baz', 'bif')
  t.ok(result)
})

test('adds a request, returns true, and clears queue', t => {
  // Must not be an async test due to an internal `setTimeout`
  t.plan(4)
  const q = {
    _queue: {
      length: 0,
      add (obj) {
        t.same(obj, {
          message: 'foo',
          expect: 'bar',
          emitter: 'baz',
          cb: 'bif'
        })
      }
    },
    _frozen: false,
    timeout: 5,
    _timer: 123,
    freeze () { t.pass() },
    purge () { t.pass() }
  }
  const result = enqueue.call(q, 'foo', 'bar', 'baz', 'bif')
  t.ok(result)
})

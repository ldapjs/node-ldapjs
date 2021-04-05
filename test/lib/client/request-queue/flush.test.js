'use strict'

const { test } = require('tap')
const flush = require('../../../../lib/client/request-queue/flush')

test('clears timer', async t => {
  t.plan(2)
  const q = {
    _timer: 123,
    _queue: {
      values () {
        return []
      },
      clear () {
        t.pass()
      }
    }
  }
  flush.call(q)
  t.equal(q._timer, null)
})

test('invokes callback with parameters', async t => {
  t.plan(6)
  const req = {
    message: 'foo',
    expect: 'bar',
    emitter: 'baz',
    cb: theCB
  }
  const q = {
    _timer: 123,
    _queue: {
      values () {
        return [req]
      },
      clear () {
        t.pass()
      }
    }
  }
  flush.call(q, (message, expect, emitter, cb) => {
    t.equal(message, 'foo')
    t.equal(expect, 'bar')
    t.equal(emitter, 'baz')
    t.equal(cb, theCB)
  })
  t.equal(q._timer, null)

  function theCB () {}
})

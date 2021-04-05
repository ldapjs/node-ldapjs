'use strict'

const { test } = require('tap')
const purge = require('../../../../lib/client/request-queue/purge')

test('flushes the queue with timeout errors', async t => {
  t.plan(3)
  const q = {
    flush (func) {
      func('a', 'b', 'c', (err) => {
        t.ok(err)
        t.equal(err.name, 'TimeoutError')
        t.equal(err.message, 'request queue timeout')
      })
    }
  }
  purge.call(q)
})

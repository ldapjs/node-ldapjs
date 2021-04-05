'use strict'

const { test } = require('tap')
const { MAX_MSGID } = require('../../../../lib/client/constants')
const purgeAbandoned = require('../../../../lib/client/message-tracker/purge-abandoned')

test('clears queue if only one message present', async t => {
  t.plan(3)
  const abandoned = new Map()
  abandoned.set(1, { age: 2, cb })

  purgeAbandoned(2, abandoned)
  t.equal(abandoned.size, 0)

  function cb (err) {
    t.equal(err.name, 'AbandonedError')
    t.equal(err.message, 'client request abandoned')
  }
})

test('clears queue if multiple messages present', async t => {
  t.plan(5)
  const abandoned = new Map()
  abandoned.set(1, { age: 2, cb })
  abandoned.set(2, { age: 3, cb })

  purgeAbandoned(4, abandoned)
  t.equal(abandoned.size, 0)

  function cb (err) {
    t.equal(err.name, 'AbandonedError')
    t.equal(err.message, 'client request abandoned')
  }
})

test('message id has wrappred around', async t => {
  t.plan(3)
  const abandoned = new Map()
  abandoned.set(MAX_MSGID - 1, { age: MAX_MSGID, cb })

  // The "abandon" message was sent with an id of "MAX_MSGID". So the message
  // that is triggering the purge was the "first" message in the new sequence
  // of message identifiers.
  purgeAbandoned(1, abandoned)
  t.equal(abandoned.size, 0)

  function cb (err) {
    t.equal(err.name, 'AbandonedError')
    t.equal(err.message, 'client request abandoned')
  }
})

test('does not clear if window not met', async t => {
  t.plan(1)
  const abandoned = new Map()
  abandoned.set(1, { age: 2, cb })

  purgeAbandoned(1, abandoned)
  t.equal(abandoned.size, 1)

  function cb () {
    t.fail('should not be invoked')
  }
})

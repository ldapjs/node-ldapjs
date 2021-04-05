'use strict'

const { test } = require('tap')
const { MAX_MSGID } = require('../../../../lib/client/constants')
const idGeneratorFactory = require('../../../../lib/client/message-tracker/id-generator')

test('starts at 0', async t => {
  const nextID = idGeneratorFactory()
  const currentID = nextID()
  t.equal(currentID, 1)
})

test('handles wrapping around', async t => {
  const nextID = idGeneratorFactory(MAX_MSGID - 2)

  let currentID = nextID()
  t.equal(currentID, MAX_MSGID - 1)

  currentID = nextID()
  t.equal(currentID, 1)
})

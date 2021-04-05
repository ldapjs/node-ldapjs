'use strict'

const { test } = require('tap')
const { MAX_MSGID } = require('../../../../lib/client/constants')
const geWindow = require('../../../../lib/client/message-tracker/ge-window')

test('comp > (ref in upper window) => true', async t => {
  const ref = Math.floor(MAX_MSGID / 2) + 10
  const comp = ref + 10
  const result = geWindow(ref, comp)
  t.equal(result, true)
})

test('comp < (ref in upper window) => false', async t => {
  const ref = Math.floor(MAX_MSGID / 2) + 10
  const comp = ref - 5
  const result = geWindow(ref, comp)
  t.equal(result, false)
})

test('comp > (ref in lower window) => true', async t => {
  const ref = Math.floor(MAX_MSGID / 2) - 10
  const comp = ref + 20
  const result = geWindow(ref, comp)
  t.equal(result, true)
})

test('comp < (ref in lower window) => false', async t => {
  const ref = Math.floor(MAX_MSGID / 2) - 10
  const comp = ref - 5
  const result = geWindow(ref, comp)
  t.equal(result, false)
})

test('(max === MAX_MSGID) && (comp > ref) => true', async t => {
  const ref = MAX_MSGID - Math.floor(MAX_MSGID / 2)
  const comp = ref + 1
  const result = geWindow(ref, comp)
  t.equal(result, true)
})

test('(max === MAX_MSGID) && (comp < ref) => false', async t => {
  const ref = MAX_MSGID - Math.floor(MAX_MSGID / 2)
  const comp = ref - 1
  const result = geWindow(ref, comp)
  t.equal(result, false)
})

'use strict'

const { test } = require('tap')
const CorkedEmitter = require('../lib/corked_emitter')

function gatherEventSequence (expectedNumber) {
  const gatheredEvents = []
  let callback
  const finished = new Promise(function (resolve) {
    callback = function (...args) {
      gatheredEvents.push(...args)
      if (gatheredEvents.length >= expectedNumber) {
        // Prevent result mutation after our promise is resolved:
        resolve(gatheredEvents.slice())
      }
    }
  })
  return {
    finished,
    callback
  }
}

test('normal emit flow', function (t) {
  const emitter = new CorkedEmitter()
  const expectedSequence = [
    ['searchEntry', { data: 'a' }],
    ['searchEntry', { data: 'b' }],
    ['end']
  ]
  const gatherer = gatherEventSequence(3)
  emitter.on('searchEntry', function (...args) {
    gatherer.callback(['searchEntry', ...args])
  })
  emitter.on('end', function (...args) {
    gatherer.callback(['end', ...args])
  })
  emitter.emit('searchEntry', { data: 'a' })
  emitter.emit('searchEntry', { data: 'b' })
  emitter.emit('end')
  gatherer.finished.then(function (gatheredEvents) {
    expectedSequence.forEach(function (expectedEvent, i) {
      t.equal(JSON.stringify(expectedEvent), JSON.stringify(gatheredEvents[i]))
    })
    t.end()
  })
})

test('reversed listener registration', function (t) {
  const emitter = new CorkedEmitter()
  const expectedSequence = [
    ['searchEntry', { data: 'a' }],
    ['searchEntry', { data: 'b' }],
    ['end']
  ]
  const gatherer = gatherEventSequence(3)
  // This time, we swap the event listener registrations.
  // The order of emits should remain unchanged.
  emitter.on('end', function (...args) {
    gatherer.callback(['end', ...args])
  })
  emitter.on('searchEntry', function (...args) {
    gatherer.callback(['searchEntry', ...args])
  })
  emitter.emit('searchEntry', { data: 'a' })
  emitter.emit('searchEntry', { data: 'b' })
  emitter.emit('end')
  gatherer.finished.then(function (gatheredEvents) {
    expectedSequence.forEach(function (expectedEvent, i) {
      t.equal(JSON.stringify(expectedEvent), JSON.stringify(gatheredEvents[i]))
    })
    t.end()
  })
})

test('delayed listener registration', function (t) {
  const emitter = new CorkedEmitter()
  const expectedSequence = [
    ['searchEntry', { data: 'a' }],
    ['searchEntry', { data: 'b' }],
    ['end']
  ]
  const gatherer = gatherEventSequence(3)
  emitter.emit('searchEntry', { data: 'a' })
  emitter.emit('searchEntry', { data: 'b' })
  emitter.emit('end')
  // The listeners only appear after a brief delay - this simulates
  //  the situation described in https://github.com/ldapjs/node-ldapjs/issues/602
  //  and in https://github.com/ifroz/node-ldapjs/commit/5239f6c68827f2c25b4589089c199d15bb882412
  setTimeout(function () {
    emitter.on('end', function (...args) {
      gatherer.callback(['end', ...args])
    })
    emitter.on('searchEntry', function (...args) {
      gatherer.callback(['searchEntry', ...args])
    })
  }, 50)
  gatherer.finished.then(function (gatheredEvents) {
    expectedSequence.forEach(function (expectedEvent, i) {
      t.equal(JSON.stringify(expectedEvent), JSON.stringify(gatheredEvents[i]))
    })
    t.end()
  })
})

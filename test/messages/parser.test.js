'use strict'

const { test } = require('tap')
const { Parser } = require('../../lib')

test('wrong protocol error', function (t) {
  const p = new Parser()

  p.once('error', function (err) {
    t.ok(err)
    t.end()
  })

  // Send some bogus data to incur an error
  p.write(Buffer.from([16, 1, 4]))
})

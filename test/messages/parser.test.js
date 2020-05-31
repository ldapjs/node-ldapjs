'use strict'

const { test } = require('tap')
const { Parser, LDAPMessage, LDAP_REQ_EXTENSION } = require('../../lib')

test('wrong protocol error', function (t) {
  const p = new Parser()

  p.once('error', function (err) {
    t.ok(err)
    t.end()
  })

  // Send some bogus data to incur an error
  p.write(Buffer.from([16, 1, 4]))
})

test('bad protocol op', function (t) {
  const p = new Parser()
  const message = new LDAPMessage({
    protocolOp: 254 // bogus (at least today)
  })
  p.once('error', function (err) {
    t.ok(err)
    t.ok(/not supported$/.test(err.message))
    t.end()
  })
  p.write(message.toBer())
})

test('bad message structure', function (t) {
  const p = new Parser()

  // message with bogus structure
  const message = new LDAPMessage({
    protocolOp: LDAP_REQ_EXTENSION
  })
  message._toBer = function (writer) {
    writer.writeBuffer(Buffer.from([16, 1, 4]), 80)
    return writer
  }

  p.once('error', function (err) {
    t.ok(err)
    t.end()
  })

  p.write(message.toBer())
})

'use strict'

const tap = require('tap')
const ldapjs = require('../../lib')

const SCHEME = process.env.SCHEME || 'ldap'
const HOST = process.env.HOST || '127.0.0.1'
const PORT = process.env.PORT || 389

tap.test('connects to a server', t => {
  t.plan(2)

  const client = ldapjs.createClient({ url: `${SCHEME}://${HOST}:${PORT}` })
  client.bind('cn=Philip J. Fry,ou=people,dc=planetexpress,dc=com', 'fry', (err) => {
    t.error(err)
    t.pass()
    client.unbind()
  })
})

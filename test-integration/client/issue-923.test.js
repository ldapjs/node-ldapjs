'use strict'

const tap = require('tap')
const ldapjs = require('../../lib')
const { DN } = require('@ldapjs/dn')
const Change = require('@ldapjs/change')

const SCHEME = process.env.SCHEME || 'ldap'
const HOST = process.env.HOST || '127.0.0.1'
const PORT = process.env.PORT || 389
const baseURL = `${SCHEME}://${HOST}:${PORT}`

const client = ldapjs.createClient({ url: baseURL })

tap.teardown(() => {
  client.unbind()
})

tap.test('modifies entry specified by dn string', t => {
  t.plan(4)

  client.bind('cn=admin,dc=planetexpress,dc=com', 'GoodNewsEveryone', (err) => {
    t.error(err, 'bind error')
  })

  const dn = 'cn=large10,ou=large_ou,dc=planetexpress,dc=com'
  const change = new Change({
    operation: 'replace',
    modification: {
      type: 'givenName',
      values: ['test']
    }
  })

  client.modify(dn, change, (err) => {
    t.error(err, 'modify error')
    validateChange({ t, expected: 'test', client })
  })
})

tap.test('modifies entry specified by dn object', t => {
  t.plan(4)

  client.bind('cn=admin,dc=planetexpress,dc=com', 'GoodNewsEveryone', (err) => {
    t.error(err, 'bind error')
  })

  const dn = DN.fromString('cn=large10,ou=large_ou,dc=planetexpress,dc=com')
  const change = new Change({
    operation: 'replace',
    modification: {
      type: 'givenName',
      values: ['test2']
    }
  })

  client.modify(dn, change, (err) => {
    t.error(err, 'modify error')
    validateChange({ t, expected: 'test2', client })
  })
})

function validateChange ({ t, expected, client }) {
  const searchBase = 'ou=large_ou,dc=planetexpress,dc=com'
  const searchOpts = {
    filter: '(cn=large10)',
    scope: 'subtree',
    attributes: ['givenName'],
    sizeLimit: 10,
    timeLimit: 0
  }

  client.search(searchBase, searchOpts, (err, res) => {
    t.error(err, 'search error')

    res.on('searchEntry', entry => {
      t.equal(
        entry.attributes.filter(a => a.type === 'givenName').pop().values.pop(),
        expected
      )
    })

    res.on('error', err => {
      t.error(err, 'search entry error')
    })

    res.on('end', () => {
      t.end()
    })
  })
}

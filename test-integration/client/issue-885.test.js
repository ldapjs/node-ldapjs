'use strict'

const tap = require('tap')
const ldapjs = require('../../lib')
const parseDN = ldapjs.parseDN

const SCHEME = process.env.SCHEME || 'ldap'
const HOST = process.env.HOST || '127.0.0.1'
const PORT = process.env.PORT || 389
const baseURL = `${SCHEME}://${HOST}:${PORT}`

const client = ldapjs.createClient({ url: baseURL })

const searchOpts = {
  filter: '(&(objectClass=person))',
  scope: 'sub',
  paged: true,
  sizeLimit: 0,
  attributes: ['cn', 'employeeID']
}

const baseDN = parseDN('ou=large_ou,dc=planetexpress,dc=com')

tap.test('paged search option returns pages', t => {
  t.plan(4)

  client.bind('cn=admin,dc=planetexpress,dc=com', 'GoodNewsEveryone', (err) => {
    t.error(err, 'bind error')
  })

  client.search(baseDN.toString(), searchOpts, (err, res) => {
    t.error(err, 'search error')

    let pages = 0
    const results = []
    res.on('searchEntry', (entry) => {
      results.push(entry)
    })

    res.on('page', () => {
      pages += 1
    })

    res.on('error', (err) => {
      t.error(err, 'search entry error')
    })

    res.on('end', () => {
      t.equal(results.length, 2000)
      t.equal(pages, 20)

      client.unbind(t.end)
    })
  })
})

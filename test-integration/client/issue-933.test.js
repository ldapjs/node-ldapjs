'use strict'

const tap = require('tap')
const ldapjs = require('../../lib')
const parseDN = ldapjs.parseDN

const SCHEME = process.env.SCHEME || 'ldap'
const HOST = process.env.HOST || '127.0.0.1'
const PORT = process.env.PORT || 389
const baseURL = `${SCHEME}://${HOST}:${PORT}`

const client = ldapjs.createClient({ url: baseURL })

const opts = {
  filter: '(&(objectClass=person))',
  scope: 'sub',
  paged: true,
  sizeLimit: 100,
  attributes: ['cn', 'employeeID']
}

const baseDN = parseDN('ou=Norge Gjøvik,dc=planetexpress,dc=com')

tap.test('can search OUs with Norwegian characters', (t) => {
  client.bind(
    'cn=admin,dc=planetexpress,dc=com',
    'GoodNewsEveryone',
    (err) => {
      t.error(err, 'bind error')
    }
  )

  client.search(baseDN.toString(), opts, (err, res) => {
    t.error(err, 'search error')
    res.on('searchEntry', (entry) => {
      t.match(entry.pojo, {
        type: 'SearchResultEntry',
        objectName:
               'cn=jdoe,ou=Norge Gj\\c3\\b8vik,dc=planetexpress,dc=com',
        attributes: [
          {
            type: 'cn',
            values: ['John', 'jdoe']
          }
        ]
      })
    })
    res.on('error', (err) => {
      t.error(err, 'search entry error')
    })
    res.on('end', () => {
      client.unbind(t.end)
    })
  })
})

'use strict'

const tap = require('tap')
const ldapjs = require('../../lib')

const SCHEME = process.env.SCHEME || 'ldap'
const HOST = process.env.HOST || '127.0.0.1'
const PORT = process.env.PORT || 389
const baseURL = `${SCHEME}://${HOST}:${PORT}`

const client = ldapjs.createClient({ url: baseURL })

tap.test('adds entries with Korean characters', t => {
  t.plan(4)

  client.bind('cn=admin,dc=planetexpress,dc=com', 'GoodNewsEveryone', (err) => {
    t.error(err, 'bind error')
  })

  const nm = '홍길동'
  const dn = `cn=${nm},ou=people,dc=planetexpress,dc=com`
  const entry = {
    objectclass: 'person',
    sn: 'korean test'
  }

  client.add(dn, entry, err => {
    t.error(err, 'add entry error')

    const searchOpts = {
      filter: '(sn=korean test)',
      scope: 'subtree',
      attributes: ['cn', 'sn'],
      sizeLimit: 10,
      timeLimit: 0
    }
    client.search('ou=people,dc=planetexpress,dc=com', searchOpts, (err, res) => {
      t.error(err, 'search error')

      res.on('searchEntry', (entry) => {
        t.equal(
          entry.attributes.filter(a => a.type === 'cn').pop().values.pop(),
          nm
        )
      })

      res.on('error', (err) => {
        t.error(err, 'search entry error')
      })

      res.on('end', () => {
        client.unbind(t.end)
      })
    })
  })
})

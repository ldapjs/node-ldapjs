'use strict'

const tap = require('tap')
const ldapjs = require('../../lib')
const parseDN = ldapjs.parseDN

const SCHEME = process.env.SCHEME || 'ldap'
const HOST = process.env.HOST || '127.0.0.1'
const PORT = process.env.PORT || 389
const baseURL = `${SCHEME}://${HOST}:${PORT}`

const client = ldapjs.createClient({ url: baseURL })

tap.before(() => {
  return new Promise((resolve, reject) => {
    client.bind('cn=admin,dc=planetexpress,dc=com', 'GoodNewsEveryone', (err) => {
      if (err) {
        return reject(err)
      }
      resolve()
    })
  })
})

tap.teardown(() => {
  client.unbind()
})

tap.test('can search OUs with Japanese characters', t => {
  t.plan(2)

  const opts = {
    filter: '(&(objectClass=person))',
    scope: 'sub',
    paged: true,
    sizeLimit: 100,
    attributes: ['cn', 'employeeID']
  }

  const baseDN = parseDN('ou=テスト,dc=planetexpress,dc=com')

  client.search(baseDN.toString(), opts, (err, res) => {
    t.error(err, 'search error')
    res.on('searchEntry', (entry) => {
      t.match(entry.pojo, {
        type: 'SearchResultEntry',
        objectName: 'cn=jdoe,ou=\\e3\\83\\86\\e3\\82\\b9\\e3\\83\\88,dc=planetexpress,dc=com',
        attributes: [{
          type: 'cn',
          values: ['John', 'jdoe']
        }]
      })
    })
    res.on('error', (err) => {
      t.error(err, 'search entry error')
    })
    res.on('end', () => {
      t.end()
    })
  })
})

tap.test('can search with non-ascii chars in filter', t => {
  t.plan(3)

  const opts = {
    filter: '(&(sn=Rodríguez))',
    scope: 'sub',
    attributes: ['dn', 'sn', 'cn'],
    type: 'user'
  }

  let searchEntryCount = 0
  client.search('dc=planetexpress,dc=com', opts, (err, res) => {
    t.error(err, 'search error')
    res.on('searchEntry', (entry) => {
      searchEntryCount += 1
      t.match(entry.pojo, {
        type: 'SearchResultEntry',
        objectName: 'cn=Bender Bending Rodr\\c3\\adguez,ou=people,dc=planetexpress,dc=com',
        attributes: [{
          type: 'cn',
          values: ['Bender Bending Rodríguez']
        }]
      })
    })
    res.on('error', (err) => {
      t.error(err, 'search entry error')
    })
    res.on('end', () => {
      t.equal(searchEntryCount, 1, 'should have found 1 entry')
      t.end()
    })
  })
})

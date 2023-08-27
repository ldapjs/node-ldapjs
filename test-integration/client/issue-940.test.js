'use strict'

const tap = require('tap')
const ldapjs = require('../../lib')
const Change = require('@ldapjs/change')

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

tap.test('can modify entries with non-ascii chars in RDN', t => {
  t.plan(6)

  const dn = 'cn=Mendonça,ou=people,dc=planetexpress,dc=com'
  const entry = {
    objectclass: 'person',
    sn: 'change me'
  }

  client.add(dn, entry, error => {
    t.error(error, 'add should not error')
    doSearch('change me', doModify)
  })

  function doModify () {
    const change = new Change({
      operation: 'replace',
      modification: {
        type: 'sn',
        values: ['changed']
      }
    })

    client.modify(dn, change, (error) => {
      t.error(error, 'modify should not error')
      doSearch('changed', t.end.bind(t))
    })
  }

  function doSearch (expected, callback) {
    const searchOpts = {
      filter: '(&(objectclass=person)(cn=Mendonça))',
      scope: 'subtree',
      attributes: ['sn']
    }
    client.search('ou=people,dc=planetexpress,dc=com', searchOpts, (error, res) => {
      t.error(error, 'search should not error')

      res.on('searchEntry', entry => {
        const found = entry.attributes.filter(a => a.type === 'sn').pop().values.pop()
        t.equal(found, expected, `expected '${expected}' and got '${found}'`)
      })

      res.on('error', error => {
        t.error(error, 'search result processing should not error')
      })

      res.on('end', () => {
        callback()
      })
    })
  }
})

'use strict'

const tap = require('tap')
const ldapjs = require('../../lib')

const SCHEME = process.env.SCHEME || 'ldap'
const HOST = process.env.HOST || '127.0.0.1'
const PORT = process.env.PORT || 389

const baseURL = `${SCHEME}://${HOST}:${PORT}`

tap.test('modifyDN with long name (issue #480)', t => {
  const longStr = 'a292979f2c86d513d48bbb9786b564b3c5228146e5ba46f404724e322544a7304a2b1049168803a5485e2d57a544c6a0d860af91330acb77e5907a9e601ad1227e80e0dc50abe963b47a004f2c90f570450d0e920d15436fdc771e3bdac0487a9735473ed3a79361d1778d7e53a7fb0e5f01f97a75ef05837d1d5496fc86968ff47fcb64'
  const targetDN = 'cn=Turanga Leela,ou=people,dc=planetexpress,dc=com'
  const client = ldapjs.createClient({ url: baseURL })
  client.bind('cn=admin,dc=planetexpress,dc=com', 'GoodNewsEveryone', bindHandler)

  function bindHandler (err) {
    t.error(err)
    client.modifyDN(
      targetDN,
      `cn=${longStr},ou=people,dc=planetexpress,dc=com`,
      modifyHandler
    )
  }

  function modifyHandler (err, res) {
    t.error(err)
    t.ok(res)
    t.equal(res.status, 0)

    client.modifyDN(
      `cn=${longStr},ou=people,dc=planetexpress,dc=com`,
      targetDN,
      (err) => {
        t.error(err)
        client.unbind(t.end)
      }
    )
  }
})

tap.test('whois works correctly (issue #370)', t => {
  const client = ldapjs.createClient({ url: baseURL })
  client.bind('cn=Philip J. Fry,ou=people,dc=planetexpress,dc=com', 'fry', (err) => {
    t.error(err)

    client.exop('1.3.6.1.4.1.4203.1.11.3', (err, value, res) => {
      t.error(err)
      t.ok(value)
      t.equal(value, 'dn:cn=Philip J. Fry,ou=people,dc=planetexpress,dc=com')
      t.ok(res)
      t.equal(res.status, 0)

      client.unbind(t.end)
    })
  })
})

tap.test('can access large groups (issue #582)', t => {
  const client = ldapjs.createClient({ url: baseURL })
  client.bind('cn=admin,dc=planetexpress,dc=com ', 'GoodNewsEveryone', (err) => {
    t.error(err)
    const searchOpts = {
      scope: 'sub',
      filter: '(&(objectClass=group)(cn=large_group))'
    }
    client.search('ou=large_ou,dc=planetexpress,dc=com', searchOpts, (err, response) => {
      t.error(err)

      const results = []
      response.on('searchEntry', (entry) => {
        results.push(entry)
      })
      response.on('error', t.error)
      response.on('end', (result) => {
        t.equal(result.status, 0)
        t.equal(results.length === 1, true)
        t.ok(results[0].attributes)

        const memberAttr = results[0].attributes.find(a => a.type === 'member')
        t.ok(memberAttr)
        t.ok(memberAttr.values)
        t.type(memberAttr.values, Array)
        t.equal(memberAttr.values.length, 2000)

        client.unbind(t.end)
      })
    })
  })
})

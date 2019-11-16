'use strict'

const tap = require('tap')
const ldapjs = require('../../lib')

const SCHEME = process.env.SCHEME || 'ldap'
const HOST = process.env.HOST || '127.0.0.1'
const PORT = process.env.PORT || 389

const baseURL = `${SCHEME}://${HOST}:${PORT}`

tap.test('connects to a server', t => {
  t.plan(2)

  const client = ldapjs.createClient({ url: baseURL })
  client.bind('cn=Philip J. Fry,ou=people,dc=planetexpress,dc=com', 'fry', (err) => {
    t.error(err)
    t.pass()
    client.unbind()
  })
})

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
      (err, res) => {
        t.error(err)
        client.unbind(t.end)
      }
    )
  }
})

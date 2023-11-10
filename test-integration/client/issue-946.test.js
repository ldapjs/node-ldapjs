'use strict'

const tap = require('tap')
const ldapjs = require('../../lib')

const SCHEME = process.env.SCHEME || 'ldap'
const HOST = process.env.HOST || '127.0.0.1'
const PORT = process.env.PORT || 389
const baseURL = `${SCHEME}://${HOST}:${PORT}`

tap.test('can use password policy response', t => {
  const client = ldapjs.createClient({ url: baseURL })
  const targetDN = 'cn=Bender Bending Rodríguez,ou=people,dc=planetexpress,dc=com'

  client.bind('cn=admin,dc=planetexpress,dc=com', 'GoodNewsEveryone', (err, res) => {
    t.error(err)
    t.ok(res)
    t.equal(res.status, 0)

    const newPassword = 'bender2'
    changePassword(client, newPassword, () => {
      client.unbind()
      bindNewClient(newPassword, { error: 2 }, (client) => {
        const newPassword = 'bender'
        changePassword(client, newPassword, () => {
          client.unbind()
          bindNewClient(newPassword, { timeBeforeExpiration: 1000 }, (client) => {
            client.unbind(t.end)
          })
        })
      })
    })
  })

  function bindNewClient (pwd, expected, callback) {
    const client = ldapjs.createClient({ url: baseURL })
    const control = new ldapjs.PasswordPolicyControl()

    client.bind(targetDN, pwd, control, (err, res) => {
      t.error(err)
      t.ok(res)
      t.equal(res.status, 0)

      let error = null
      let timeBeforeExpiration = null
      let graceAuthNsRemaining = null

      res.controls.forEach(control => {
        if (control.type === ldapjs.PasswordPolicyControl.OID) {
          error = control.value.error ?? error
          timeBeforeExpiration = control.value.timeBeforeExpiration ?? timeBeforeExpiration
          graceAuthNsRemaining = control.value.graceAuthNsRemaining ?? graceAuthNsRemaining
        }
      })

      if (expected.error !== undefined) {
        t.equal(error, expected.error)
      }
      if (expected.timeBeforeExpiration !== undefined) {
        t.equal(timeBeforeExpiration, expected.timeBeforeExpiration)
      }
      if (expected.graceAuthNsRemaining !== undefined) {
        t.equal(graceAuthNsRemaining, expected.graceAuthNsRemaining)
      }

      callback(client)
    })
  }

  function changePassword (client, newPwd, callback) {
    const change = new ldapjs.Change({
      operation: 'replace',
      modification: new ldapjs.Attribute({
        type: 'userPassword',
        values: newPwd
      })
    })

    client.modify(targetDN, change, (err, res) => {
      t.error(err)
      t.ok(res)
      t.equal(res.status, 0)

      callback()
    })
  }
})

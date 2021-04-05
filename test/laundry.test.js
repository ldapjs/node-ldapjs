'use strict'

const tap = require('tap')
const { getSock, uuid } = require('./utils')
const ldap = require('../lib')

function search (t, options, callback) {
  t.context.client.search(t.context.suffix, options, function (err, res) {
    t.error(err)
    t.ok(res)
    let found = false
    res.on('searchEntry', function (entry) {
      t.ok(entry)
      found = true
    })
    res.on('end', function () {
      t.ok(found)
      if (callback) return callback()
      return t.end()
    })
  })
}

tap.beforeEach((t) => {
  return new Promise((resolve, reject) => {
    const suffix = `dc=${uuid()}`
    const server = ldap.createServer()

    t.context.server = server
    t.context.socketPath = getSock()
    t.context.suffix = suffix

    server.bind('cn=root', function (req, res, next) {
      res.end()
      return next()
    })

    server.search(suffix, function (req, res) {
      const entry = {
        dn: 'cn=foo, ' + suffix,
        attributes: {
          objectclass: ['person', 'top'],
          cn: 'Pogo Stick',
          sn: 'Stick',
          givenname: 'ogo',
          mail: uuid() + '@pogostick.org'
        }
      }

      if (req.filter.matches(entry.attributes)) { res.send(entry) }

      res.end()
    })

    server.listen(t.context.socketPath, function () {
      t.context.client = ldap.createClient({
        socketPath: t.context.socketPath
      })

      t.context.client.on('connectError', (err) => {
        t.context.server.close(() => reject(err))
      })
      t.context.client.on('connect', (socket) => {
        t.context.socket = socket
        resolve()
      })
    })
  })
})

tap.afterEach((t) => {
  return new Promise((resolve, reject) => {
    if (!t.context.client) return resolve()
    t.context.client.unbind(() => {
      t.context.server.close((err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  })
})

tap.test('Evolution search filter (GH-3)', function (t) {
  // This is what Evolution sends, when searching for a contact 'ogo'. Wow.
  const filter =
    '(|(cn=ogo*)(givenname=ogo*)(sn=ogo*)(mail=ogo*)(member=ogo*)' +
    '(primaryphone=ogo*)(telephonenumber=ogo*)(homephone=ogo*)(mobile=ogo*)' +
    '(carphone=ogo*)(facsimiletelephonenumber=ogo*)' +
    '(homefacsimiletelephonenumber=ogo*)(otherphone=ogo*)' +
    '(otherfacsimiletelephonenumber=ogo*)(internationalisdnnumber=ogo*)' +
    '(pager=ogo*)(radio=ogo*)(telex=ogo*)(assistantphone=ogo*)' +
    '(companyphone=ogo*)(callbackphone=ogo*)(tty=ogo*)(o=ogo*)(ou=ogo*)' +
    '(roomnumber=ogo*)(title=ogo*)(businessrole=ogo*)(managername=ogo*)' +
    '(assistantname=ogo*)(postaladdress=ogo*)(l=ogo*)(st=ogo*)' +
    '(postofficebox=ogo*)(postalcode=ogo*)(c=ogo*)(homepostaladdress=ogo*)' +
    '(mozillahomelocalityname=ogo*)(mozillahomestate=ogo*)' +
    '(mozillahomepostalcode=ogo*)(mozillahomecountryname=ogo*)' +
    '(otherpostaladdress=ogo*)(jpegphoto=ogo*)(usercertificate=ogo*)' +
    '(labeleduri=ogo*)(displayname=ogo*)(spousename=ogo*)(note=ogo*)' +
    '(anniversary=ogo*)(birthdate=ogo*)(mailer=ogo*)(fileas=ogo*)' +
    '(category=ogo*)(calcaluri=ogo*)(calfburl=ogo*)(icscalendar=ogo*))'

  return search(t, filter)
})

tap.test('GH-49 Client errors on bad attributes', function (t) {
  const searchOpts = {
    filter: 'cn=*ogo*',
    scope: 'one',
    attributes: 'dn'
  }
  return search(t, searchOpts)
})

tap.test('GH-55 Client emits connect multiple times', function (t) {
  const c = ldap.createClient({
    socketPath: t.context.socketPath
  })

  let count = 0
  c.on('connect', function (socket) {
    t.ok(socket)
    count++
    c.bind('cn=root', 'secret', function (err) {
      t.ifError(err)
      c.unbind(function () {
        t.equal(count, 1)
        t.end()
      })
    })
  })
})

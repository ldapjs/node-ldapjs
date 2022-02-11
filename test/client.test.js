'use strict'

const util = require('util')
const assert = require('assert')
const tap = require('tap')
const vasync = require('vasync')
const getPort = require('get-port')
const { getSock, uuid } = require('./utils')
const ldap = require('../lib')
const { Attribute, Change } = ldap

const SUFFIX = 'dc=test'
const LDAP_CONNECT_TIMEOUT = process.env.LDAP_CONNECT_TIMEOUT || 0
const BIND_DN = 'cn=root'
const BIND_PW = 'secret'

tap.beforeEach((t) => {
  return new Promise(resolve => {
    t.context.socketPath = getSock()
    t.context.server = ldap.createServer()

    const server = t.context.server
    server.bind(BIND_DN, function (req, res, next) {
      if (req.credentials !== BIND_PW) { return next(new ldap.InvalidCredentialsError('Invalid password')) }

      res.end()
      return next()
    })

    server.add(SUFFIX, function (req, res, next) {
      res.end()
      return next()
    })

    server.compare(SUFFIX, function (req, res, next) {
      res.end(req.value === 'test')
      return next()
    })

    server.del(SUFFIX, function (req, res, next) {
      res.end()
      return next()
    })

    // LDAP whoami
    server.exop('1.3.6.1.4.1.4203.1.11.3', function (req, res, next) {
      res.value = 'u:xxyyz@EXAMPLE.NET'
      res.end()
      return next()
    })

    server.modify(SUFFIX, function (req, res, next) {
      res.end()
      return next()
    })

    server.modifyDN(SUFFIX, function (req, res, next) {
      res.end()
      return next()
    })

    server.modifyDN('cn=issue-480', function (req, res, next) {
      assert(req.newRdn.toString().length > 132)
      res.end()
      return next()
    })

    server.search('dc=slow', function (req, res, next) {
      res.send({
        dn: 'dc=slow',
        attributes: {
          you: 'wish',
          this: 'was',
          faster: '.'
        }
      })
      setTimeout(function () {
        res.end()
        next()
      }, 250)
    })

    server.search('dc=timeout', function () {
      // Cause the client to timeout by not sending a response.
    })

    server.search(SUFFIX, function (req, res, next) {
      if (req.dn.equals('cn=ref,' + SUFFIX)) {
        res.send(res.createSearchReference('ldap://localhost'))
      } else if (req.dn.equals('cn=bin,' + SUFFIX)) {
        res.send(res.createSearchEntry({
          objectName: req.dn,
          attributes: {
            'foo;binary': 'wr0gKyDCvCA9IMK+',
            gb18030: Buffer.from([0xB5, 0xE7, 0xCA, 0xD3, 0xBB, 0xFA]),
            objectclass: 'binary'
          }
        }))
      } else {
        const e = res.createSearchEntry({
          objectName: req.dn,
          attributes: {
            cn: ['unit', 'test'],
            SN: 'testy'
          }
        })
        res.send(e)
        res.send(e)
      }

      res.end()
      return next()
    })

    server.search('cn=sizelimit', function (req, res, next) {
      const sizeLimit = 200
      for (let i = 0; i < 1000; i++) {
        if (req.sizeLimit > 0 && i >= req.sizeLimit) {
          break
        } else if (i > sizeLimit) {
          res.end(ldap.LDAP_SIZE_LIMIT_EXCEEDED)
          return next()
        }
        res.send({
          dn: util.format('o=%d, cn=sizelimit', i),
          attributes: {
            o: [i],
            objectclass: ['pagedResult']
          }
        })
      }
      res.end()
      return next()
    })

    server.search('cn=paged', function (req, res, next) {
      const min = 0
      const max = 1000

      function sendResults (start, end) {
        start = (start < min) ? min : start
        end = (end > max || end < min) ? max : end
        let i
        for (i = start; i < end; i++) {
          res.send({
            dn: util.format('o=%d, cn=paged', i),
            attributes: {
              o: [i],
              objectclass: ['pagedResult']
            }
          })
        }
        return i
      }

      let cookie = null
      let pageSize = 0
      req.controls.forEach(function (control) {
        if (control.type === ldap.PagedResultsControl.OID) {
          pageSize = control.value.size
          cookie = control.value.cookie
        }
      })

      if (cookie && Buffer.isBuffer(cookie)) {
        // Do simple paging
        let first = min
        if (cookie.length !== 0) {
          first = parseInt(cookie.toString(), 10)
        }
        const last = sendResults(first, first + pageSize)

        let resultCookie
        if (last < max) {
          resultCookie = Buffer.from(last.toString())
        } else {
          resultCookie = Buffer.from('')
        }
        res.controls.push(new ldap.PagedResultsControl({
          value: {
            size: pageSize, // correctness not required here
            cookie: resultCookie
          }
        }))
        res.end()
        next()
      } else {
        // don't allow non-paged searches for this test endpoint
        next(new ldap.UnwillingToPerformError())
      }
    })
    server.search('cn=sssvlv', function (req, res, next) {
      const min = 0
      const max = 100
      const results = []
      let o = 'aa'
      for (let i = min; i < max; i++) {
        results.push({
          dn: util.format('o=%s, cn=sssvlv', o),
          attributes: {
            o: [o],
            objectclass: ['sssvlvResult']
          }
        })
        o = ((parseInt(o, 36) + 1).toString(36)).replace(/0/g, 'a')
      }
      function sendResults (start, end, sortBy, sortDesc) {
        start = (start < min) ? min : start
        end = (end > max || end < min) ? max : end
        const sorted = results.sort((a, b) => {
          if (a.attributes[sortBy][0] < b.attributes[sortBy][0]) {
            return sortDesc ? 1 : -1
          } else if (a.attributes[sortBy][0] > b.attributes[sortBy][0]) {
            return sortDesc ? -1 : 1
          }
          return 0
        })
        for (let i = start; i < end; i++) {
          res.send(sorted[i])
        }
      }
      let sortBy = null
      let sortDesc = null
      let afterCount = null
      let targetOffset = null
      req.controls.forEach(function (control) {
        if (control.type === ldap.ServerSideSortingRequestControl.OID) {
          sortBy = control.value[0].attributeType
          sortDesc = control.value[0].reverseOrder
        }
        if (control.type === ldap.VirtualListViewRequestControl.OID) {
          afterCount = control.value.afterCount
          targetOffset = control.value.targetOffset
        }
      })
      if (sortBy) {
        if (afterCount && targetOffset) {
          sendResults(targetOffset - 1, (targetOffset + afterCount), sortBy, sortDesc)
        } else {
          sendResults(min, max, sortBy, sortDesc)
        }
        res.end()
        next()
      } else {
        next(new ldap.UnwillingToPerformError())
      }
    })

    server.search('cn=pagederr', function (req, res, next) {
      let cookie = null
      req.controls.forEach(function (control) {
        if (control.type === ldap.PagedResultsControl.OID) {
          cookie = control.value.cookie
        }
      })
      if (cookie && Buffer.isBuffer(cookie) && cookie.length === 0) {
        // send first "page"
        res.send({
          dn: util.format('o=result, cn=pagederr'),
          attributes: {
            o: 'result',
            objectclass: ['pagedResult']
          }
        })
        res.controls.push(new ldap.PagedResultsControl({
          value: {
            size: 2,
            cookie: Buffer.from('a')
          }
        }))
        res.end()
        return next()
      } else {
        // send error instead of second page
        res.end(ldap.LDAP_SIZE_LIMIT_EXCEEDED)
        return next()
      }
    })

    server.search('dc=empty', function (req, res, next) {
      res.send({
        dn: 'dc=empty',
        attributes: {
          member: [],
          'member;range=0-1': ['cn=user1, dc=empty', 'cn=user2, dc=empty']
        }
      })
      res.end()
      return next()
    })

    server.search('cn=busy', function (req, res, next) {
      next(new ldap.BusyError('too much to do'))
    })

    server.search('', function (req, res, next) {
      if (req.dn.toString() === '') {
        res.send({
          dn: '',
          attributes: {
            objectclass: ['RootDSE', 'top']
          }
        })
        res.end()
      } else {
        // Turn away any other requests (since '' is the fallthrough route)
        res.errorMessage = 'No tree found for: ' + req.dn.toString()
        res.end(ldap.LDAP_NO_SUCH_OBJECT)
      }
      return next()
    })

    server.unbind(function (req, res, next) {
      res.end()
      return next()
    })

    server.listen(t.context.socketPath, function () {
      const client = ldap.createClient({
        connectTimeout: parseInt(LDAP_CONNECT_TIMEOUT, 10),
        socketPath: t.context.socketPath
      })
      t.context.client = client
      client.on('connect', () => resolve())
    })
  })
})

tap.afterEach((t) => {
  return new Promise(resolve => {
    t.context.client.unbind((err) => {
      t.error(err)
      t.context.server.close(() => resolve())
    })
  })
})

tap.test('createClient', t => {
  t.test('requires an options object', async t => {
    const match = /options.+required/
    t.throws(() => ldap.createClient(), match)
    t.throws(() => ldap.createClient([]), match)
    t.throws(() => ldap.createClient(''), match)
    t.throws(() => ldap.createClient(42), match)
  })

  t.test('url must be a string or array', async t => {
    const match = /options\.url \(string\|array\) required/
    t.throws(() => ldap.createClient({ url: {} }), match)
    t.throws(() => ldap.createClient({ url: 42 }), match)
  })

  t.test('socketPath must be a string', async t => {
    const match = /options\.socketPath must be a string/
    t.throws(() => ldap.createClient({ socketPath: {} }), match)
    t.throws(() => ldap.createClient({ socketPath: [] }), match)
    t.throws(() => ldap.createClient({ socketPath: 42 }), match)
  })

  t.test('cannot supply both url and socketPath', async t => {
    t.throws(
      () => ldap.createClient({ url: 'foo', socketPath: 'bar' }),
      /options\.url \^ options\.socketPath \(String\) required/
    )
  })

  t.test('must supply at least url or socketPath', async t => {
    t.throws(
      () => ldap.createClient({}),
      /options\.url \^ options\.socketPath \(String\) required/
    )
  })

  t.test('exception from bad createClient parameter (issue #418)', t => {
    try {
      // This port number is totally invalid. It will cause the URL parser
      // to throw an exception that should be caught.
      ldap.createClient({ url: 'ldap://127.0.0.1:13891389' })
    } catch (error) {
      t.ok(error)
      t.end()
    }
  })

  t.test('url array is correctly assigned', async t => {
    getPort().then(function (unusedPortNumber) {
      const client = ldap.createClient({
        url: [
          `ldap://127.0.0.1:${unusedPortNumber}`,
          `ldap://127.0.0.2:${unusedPortNumber}`
        ],
        connectTimeout: 1
      })
      client.on('connectTimeout', () => {})
      client.on('connectError', () => {})
      client.on('connectRefused', () => {})

      t.equal(client.urls.length, 2)
    })
  })

  // TODO: this test is really flaky. It would be better if we could validate
  // the options _withouth_ having to connect to a server.
  // t.test('attaches a child function to logger', async t => {
  //   /* eslint-disable-next-line */
  //   let client
  //   const logger = Object.create(require('abstract-logging'))
  //   const socketPath = getSock()
  //   const server = ldap.createServer()
  //   server.listen(socketPath, () => {})
  //   t.teardown(() => {
  //     client.unbind(() => server.close())
  //   })

  //   client = ldap.createClient({ socketPath, log: logger })
  //   t.ok(logger.child)
  //   t.ok(typeof client.log.child === 'function')
  // })

  t.end()
})

tap.test('simple bind failure', function (t) {
  t.context.client.bind(BIND_DN, uuid(), function (err, res) {
    t.ok(err)
    t.notOk(res)

    t.ok(err instanceof ldap.InvalidCredentialsError)
    t.ok(err instanceof Error)
    t.ok(err.dn)
    t.ok(err.message)
    t.ok(err.stack)

    t.end()
  })
})

tap.test('simple bind success', function (t) {
  t.context.client.bind(BIND_DN, BIND_PW, function (err, res) {
    t.error(err)
    t.ok(res)
    t.equal(res.status, 0)
    t.end()
  })
})

tap.test('simple anonymous bind (empty credentials)', function (t) {
  t.context.client.bind('', '', function (err, res) {
    t.error(err)
    t.ok(res)
    t.equal(res.status, 0)
    t.end()
  })
})

tap.test('auto-bind bad credentials', function (t) {
  const clt = ldap.createClient({
    socketPath: t.context.socketPath,
    bindDN: BIND_DN,
    bindCredentials: 'totallybogus'
  })
  clt.once('error', function (err) {
    t.equal(err.code, ldap.LDAP_INVALID_CREDENTIALS)
    t.ok(clt._socket.destroyed, 'expect socket to be destroyed')
    clt.destroy()
    t.end()
  })
})

tap.test('auto-bind success', function (t) {
  const clt = ldap.createClient({
    socketPath: t.context.socketPath,
    bindDN: BIND_DN,
    bindCredentials: BIND_PW
  })
  clt.once('connect', function () {
    t.ok(clt)
    clt.destroy()
    t.end()
  })
})

tap.test('add success', function (t) {
  const attrs = [
    new Attribute({
      type: 'cn',
      vals: ['test']
    })
  ]
  t.context.client.add('cn=add, ' + SUFFIX, attrs, function (err, res) {
    t.error(err)
    t.ok(res)
    t.equal(res.status, 0)
    t.end()
  })
})

tap.test('add success with object', function (t) {
  const entry = {
    cn: ['unit', 'add'],
    sn: 'test'
  }
  t.context.client.add('cn=add, ' + SUFFIX, entry, function (err, res) {
    t.error(err)
    t.ok(res)
    t.equal(res.status, 0)
    t.end()
  })
})

tap.test('add buffer', function (t) {
  const { BerReader } = require('asn1')
  const dn = `cn=add, ${SUFFIX}`
  const attribute = 'thumbnailPhoto'
  const binary = 0xa5
  const entry = {
    [attribute]: Buffer.from([binary])
  }
  const write = t.context.client._socket.write
  t.context.client._socket.write = (data, encoding, cb) => {
    const reader = new BerReader(data)
    t.equal(data.byteLength, 49)
    t.ok(reader.readSequence())
    t.equal(reader.readInt(), 0x1)
    t.equal(reader.readSequence(), 0x68)
    t.equal(reader.readString(), dn)
    t.ok(reader.readSequence())
    t.ok(reader.readSequence())
    t.equal(reader.readString(), attribute)
    t.equal(reader.readSequence(), 0x31)
    t.equal(reader.readByte(), 0x4)
    t.equal(reader.readByte(), 1)
    t.equal(reader.readByte(), binary)
    t.context.client._socket.write = write
    t.context.client._socket.write(data, encoding, cb)
  }
  t.context.client.add(dn, entry, function (err, res) {
    t.error(err)
    t.ok(res)
    t.equal(res.status, 0)
    t.end()
  })
})

tap.test('compare success', function (t) {
  t.context.client.compare('cn=compare, ' + SUFFIX, 'cn', 'test', function (err, matched, res) {
    t.error(err)
    t.ok(matched)
    t.ok(res)
    t.end()
  })
})

tap.test('compare false', function (t) {
  t.context.client.compare('cn=compare, ' + SUFFIX, 'cn', 'foo', function (err, matched, res) {
    t.error(err)
    t.notOk(matched)
    t.ok(res)
    t.end()
  })
})

tap.test('compare bad suffix', function (t) {
  t.context.client.compare('cn=' + uuid(), 'cn', 'foo', function (err, matched, res) {
    t.ok(err)
    t.ok(err instanceof ldap.NoSuchObjectError)
    t.notOk(matched)
    t.notOk(res)
    t.end()
  })
})

tap.test('delete success', function (t) {
  t.context.client.del('cn=delete, ' + SUFFIX, function (err, res) {
    t.error(err)
    t.ok(res)
    t.end()
  })
})

tap.test('delete with control (GH-212)', function (t) {
  const control = new ldap.Control({
    type: '1.2.3.4',
    criticality: false
  })
  t.context.client.del('cn=delete, ' + SUFFIX, control, function (err, res) {
    t.error(err)
    t.ok(res)
    t.end()
  })
})

tap.test('exop success', function (t) {
  t.context.client.exop('1.3.6.1.4.1.4203.1.11.3', function (err, value, res) {
    t.error(err)
    t.ok(value)
    t.ok(res)
    t.equal(value, 'u:xxyyz@EXAMPLE.NET')
    t.end()
  })
})

tap.test('exop invalid', function (t) {
  t.context.client.exop('1.2.3.4', function (err, res) {
    t.ok(err)
    t.ok(err instanceof ldap.ProtocolError)
    t.notOk(res)
    t.end()
  })
})

tap.test('bogus exop (GH-17)', function (t) {
  t.context.client.exop('cn=root', function (err) {
    t.ok(err)
    t.end()
  })
})

tap.test('modify success', function (t) {
  const change = new Change({
    type: 'Replace',
    modification: new Attribute({
      type: 'cn',
      vals: ['test']
    })
  })
  t.context.client.modify('cn=modify, ' + SUFFIX, change, function (err, res) {
    t.error(err)
    t.ok(res)
    t.equal(res.status, 0)
    t.end()
  })
})

tap.test('modify change plain object success', function (t) {
  const change = new Change({
    type: 'Replace',
    modification: {
      cn: 'test'
    }
  })
  t.context.client.modify('cn=modify, ' + SUFFIX, change, function (err, res) {
    t.error(err)
    t.ok(res)
    t.equal(res.status, 0)
    t.end()
  })
})

// https://github.com/ldapjs/node-ldapjs/pull/435
tap.test('can delete attributes', function (t) {
  const change = new Change({
    type: 'Delete',
    modification: { cn: null }
  })
  t.context.client.modify('cn=modify,' + SUFFIX, change, function (err, res) {
    t.error(err)
    t.ok(res)
    t.equal(res.status, 0)
    t.end()
  })
})

tap.test('modify array success', function (t) {
  const changes = [
    new Change({
      operation: 'Replace',
      modification: new Attribute({
        type: 'cn',
        vals: ['test']
      })
    }),
    new Change({
      operation: 'Delete',
      modification: new Attribute({
        type: 'sn'
      })
    })
  ]
  t.context.client.modify('cn=modify, ' + SUFFIX, changes, function (err, res) {
    t.error(err)
    t.ok(res)
    t.equal(res.status, 0)
    t.end()
  })
})

tap.test('modify change plain object success (GH-31)', function (t) {
  const change = {
    type: 'replace',
    modification: {
      cn: 'test',
      sn: 'bar'
    }
  }
  t.context.client.modify('cn=modify, ' + SUFFIX, change, function (err, res) {
    t.error(err)
    t.ok(res)
    t.equal(res.status, 0)
    t.end()
  })
})

tap.test('modify DN new RDN only', function (t) {
  t.context.client.modifyDN('cn=old, ' + SUFFIX, 'cn=new', function (err, res) {
    t.error(err)
    t.ok(res)
    t.equal(res.status, 0)
    t.end()
  })
})

tap.test('modify DN new superior', function (t) {
  t.context.client.modifyDN('cn=old, ' + SUFFIX, 'cn=new, dc=foo', function (err, res) {
    t.error(err)
    t.ok(res)
    t.equal(res.status, 0)
    t.end()
  })
})

tap.test('modify DN excessive length (GH-480)', function (t) {
  t.context.client.modifyDN('cn=issue-480', 'cn=a292979f2c86d513d48bbb9786b564b3c5228146e5ba46f404724e322544a7304a2b1049168803a5485e2d57a544c6a0d860af91330acb77e5907a9e601ad1227e80e0dc50abe963b47a004f2c90f570450d0e920d15436fdc771e3bdac0487a9735473ed3a79361d1778d7e53a7fb0e5f01f97a75ef05837d1d5496fc86968ff47fcb64', function (err, res) {
    t.error(err)
    t.ok(res)
    t.equal(res.status, 0)
    t.end()
  })
})

tap.test('modify DN excessive superior length', function (t) {
  const { BerReader, BerWriter } = require('asn1')
  const ModifyDNRequest = require('../lib/messages/moddn_request')
  const ber = new BerWriter()
  const entry = 'cn=Test     User,ou=A Long OU                  ,ou=Another Long OU                ,ou=Another Long OU              ,dc=acompany,DC=io'
  const newSuperior = 'ou=A New Long OU              , ou=Another New Long OU                                   , ou=An OU               , dc=acompany, dc=io'
  const newRdn = entry.replace(/(.*?),.*/, '$1')
  const deleteOldRdn = true
  const req = new ModifyDNRequest({
    entry: entry,
    deleteOldRdn: deleteOldRdn,
    controls: []
  })
  req.newRdn = newRdn
  req.newSuperior = newSuperior
  req._toBer(ber)
  const reader = new BerReader(ber.buffer)
  t.equal(reader.readString(), entry)
  t.equal(reader.readString(), newRdn)
  t.equal(reader.readBoolean(), deleteOldRdn)
  t.equal(reader.readByte(), 0x80)
  reader.readLength()
  t.equal(reader._len, newSuperior.length)
  reader._buf[--reader._offset] = 0x4
  t.equal(reader.readString(), newSuperior)
  t.end()
})

tap.test('search basic', function (t) {
  t.context.client.search('cn=test, ' + SUFFIX, '(objectclass=*)', function (err, res) {
    t.error(err)
    t.ok(res)
    let gotEntry = 0
    res.on('searchEntry', function (entry) {
      t.ok(entry)
      t.ok(entry instanceof ldap.SearchEntry)
      t.equal(entry.dn.toString(), 'cn=test,' + SUFFIX)
      t.ok(entry.attributes)
      t.ok(entry.attributes.length)
      t.equal(entry.attributes[0].type, 'cn')
      t.equal(entry.attributes[1].type, 'SN')
      t.ok(entry.object)
      gotEntry++
    })
    res.on('error', function (err) {
      t.fail(err)
    })
    res.on('end', function (res) {
      t.ok(res)
      t.ok(res instanceof ldap.SearchResponse)
      t.equal(res.status, 0)
      t.equal(gotEntry, 2)
      t.end()
    })
  })
})

tap.test('GH-602 search basic with delayed event listener binding', function (t) {
  t.context.client.search('cn=test, ' + SUFFIX, '(objectclass=*)', function (err, res) {
    t.error(err)
    setTimeout(() => {
      let gotEntry = 0
      res.on('searchEntry', function () {
        gotEntry++
      })
      res.on('error', function (err) {
        t.fail(err)
      })
      res.on('end', function () {
        t.equal(gotEntry, 2)
        t.end()
      })
    }, 100)
  })
})

tap.test('search sizeLimit', function (t) {
  t.test('over limit', function (t2) {
    t.context.client.search('cn=sizelimit', {}, function (err, res) {
      t2.error(err)
      res.on('error', function (error) {
        t2.equal(error.name, 'SizeLimitExceededError')
        t2.end()
      })
    })
  })

  t.test('under limit', function (t2) {
    const limit = 100
    t.context.client.search('cn=sizelimit', { sizeLimit: limit }, function (err, res) {
      t2.error(err)
      let count = 0
      res.on('searchEntry', function () {
        count++
      })
      res.on('end', function () {
        t2.pass()
        t2.equal(count, limit)
        t2.end()
      })
      res.on('error', t2.error.bind(t))
    })
  })

  t.end()
})

tap.test('search paged', { timeout: 10000 }, function (t) {
  t.test('paged - no pauses', function (t2) {
    let countEntries = 0
    let countPages = 0
    let currentSearchRequest = null
    t.context.client.search('cn=paged', { paged: { pageSize: 100 } }, function (err, res) {
      t2.error(err)
      res.on('searchEntry', entryListener)
      res.on('searchRequest', (searchRequest) => {
        t2.ok(searchRequest instanceof ldap.SearchRequest)
        if (currentSearchRequest === null) {
          t2.equal(countPages, 0)
        }
        currentSearchRequest = searchRequest
      })
      res.on('page', pageListener)
      res.on('error', (err) => t2.error(err))
      res.on('end', function (result) {
        t2.equal(countEntries, 1000)
        t2.equal(countPages, 10)
        t2.equal(result.messageID, currentSearchRequest.messageID)
        t2.end()
      })

      t2.teardown(() => {
        res.removeListener('searchEntry', entryListener)
        res.removeListener('page', pageListener)
      })

      function entryListener () {
        countEntries += 1
      }

      function pageListener (result) {
        countPages += 1
        if (countPages < 10) {
          t2.equal(result.messageID, currentSearchRequest.messageID)
        }
      }
    })
  })

  t.test('paged - pauses', function (t2) {
    let countPages = 0
    t.context.client.search('cn=paged', {
      paged: {
        pageSize: 100,
        pagePause: true
      }
    }, function (err, res) {
      t2.error(err)
      res.on('page', pageListener)
      res.on('error', (err) => t2.error(err))
      res.on('end', function () {
        t2.equal(countPages, 9)
        t2.end()
      })

      function pageListener (result, cb) {
        countPages++
        // cancel after 9 to verify callback usage
        if (countPages === 9) {
          // another page should never be encountered
          res.removeListener('page', pageListener)
            .on('page', t2.fail.bind(null, 'unexpected page'))
          return cb(new Error())
        }
        return cb()
      }
    })
  })

  t.test('paged - no support (err handled)', function (t2) {
    t.context.client.search(SUFFIX, {
      paged: { pageSize: 100 }
    }, function (err, res) {
      t2.error(err)
      res.on('pageError', t2.ok.bind(t2))
      res.on('end', function () {
        t2.pass()
        t2.end()
      })
    })
  })

  t.test('paged - no support (err not handled)', function (t2) {
    t.context.client.search(SUFFIX, {
      paged: { pageSize: 100 }
    }, function (err, res) {
      t2.error(err)
      res.on('end', t2.fail.bind(t2))
      res.on('error', function (error) {
        t2.ok(error)
        t2.end()
      })
    })
  })

  t.test('paged - redundant control', function (t2) {
    try {
      t.context.client.search(SUFFIX, {
        paged: { pageSize: 100 }
      }, new ldap.PagedResultsControl(),
      function (err) {
        t.error(err)
        t2.fail()
      })
    } catch (e) {
      t2.ok(e)
      t2.end()
    }
  })

  t.test('paged - handle later error', function (t2) {
    let countEntries = 0
    let countPages = 0
    t.context.client.search('cn=pagederr', {
      paged: { pageSize: 1 }
    }, function (err, res) {
      t2.error(err)
      res.on('searchEntry', function () {
        t2.ok(++countEntries)
      })
      res.on('page', function () {
        t2.ok(++countPages)
      })
      res.on('error', function (error) {
        t2.ok(error)
        t2.equal(countEntries, 1)
        t2.equal(countPages, 1)
        t2.end()
      })
      res.on('end', function () {
        t2.fail('should not be reached')
      })
    })
  })

  tap.test('paged - search with delayed event listener binding', function (t) {
    t.context.client.search('cn=paged', { filter: '(objectclass=*)', paged: true }, function (err, res) {
      t.error(err)
      setTimeout(() => {
        let gotEntry = 0
        res.on('searchEntry', function () {
          gotEntry++
        })
        res.on('error', function (err) {
          t.fail(err)
        })
        res.on('end', function () {
          t.equal(gotEntry, 1000)
          t.end()
        })
      }, 100)
    })
  })

  t.end()
})

tap.test('search - sssvlv', { timeout: 10000 }, function (t) {
  t.test('ssv - asc', function (t2) {
    let preventry = null
    const sssrcontrol = new ldap.ServerSideSortingRequestControl(
      {
        value: {
          attributeType: 'o',
          orderingRule: 'caseIgnoreOrderingMatch',
          reverseOrder: false
        }
      }
    )
    t.context.client.search('cn=sssvlv', {}, sssrcontrol, function (err, res) {
      t2.error(err)
      res.on('searchEntry', function (entry) {
        t2.ok(entry)
        t2.ok(entry instanceof ldap.SearchEntry)
        t2.ok(entry.attributes)
        t2.ok(entry.attributes.length)
        if (preventry != null) {
          t2.ok(entry.attributes[0]._vals[0] >= preventry.attributes[0]._vals[0])
        }
        preventry = entry
      })
      res.on('error', (err) => t2.error(err))
      res.on('end', function () {
        t2.end()
      })
    })
  })
  t.test('ssv - desc', function (t2) {
    let preventry = null
    const sssrcontrol = new ldap.ServerSideSortingRequestControl(
      {
        value: {
          attributeType: 'o',
          orderingRule: 'caseIgnoreOrderingMatch',
          reverseOrder: true
        }
      }
    )
    t.context.client.search('cn=sssvlv', {}, sssrcontrol, function (err, res) {
      t2.error(err)
      res.on('searchEntry', function (entry) {
        t2.ok(entry)
        t2.ok(entry instanceof ldap.SearchEntry)
        t2.ok(entry.attributes)
        t2.ok(entry.attributes.length)
        if (preventry != null) {
          t2.ok(entry.attributes[0]._vals[0] <= preventry.attributes[0]._vals[0])
        }
        preventry = entry
      })
      res.on('error', (err) => t2.error(err))
      res.on('end', function () {
        t2.end()
      })
    })
  })

  t.test('vlv - first page', function (t2) {
    const sssrcontrol = new ldap.ServerSideSortingRequestControl(
      {
        value: {
          attributeType: 'o',
          orderingRule: 'caseIgnoreOrderingMatch',
          reverseOrder: false
        }
      }
    )
    const vlvrcontrol = new ldap.VirtualListViewRequestControl(
      {
        value: {
          beforeCount: 0,
          afterCount: 9,
          targetOffset: 1,
          contentCount: 0
        }
      }
    )
    let count = 0
    let preventry = null
    t.context.client.search('cn=sssvlv', {}, [sssrcontrol, vlvrcontrol], function (err, res) {
      t2.error(err)
      res.on('searchEntry', function (entry) {
        t2.ok(entry)
        t2.ok(entry instanceof ldap.SearchEntry)
        t2.ok(entry.attributes)
        t2.ok(entry.attributes.length)
        if (preventry != null) {
          t2.ok(entry.attributes[0]._vals[0] >= preventry.attributes[0]._vals[0])
        }
        preventry = entry
        count++
      })
      res.on('error', (err) => t2.error(err))
      res.on('end', function () {
        t2.equal(count, 10)
        t2.end()
      })
    })
  })
  t.test('vlv - last page', function (t2) {
    const sssrcontrol = new ldap.ServerSideSortingRequestControl(
      {
        value: {
          attributeType: 'o',
          orderingRule: 'caseIgnoreOrderingMatch',
          reverseOrder: false
        }
      }
    )
    const vlvrcontrol = new ldap.VirtualListViewRequestControl(
      {
        value: {
          beforeCount: 0,
          afterCount: 9,
          targetOffset: 91,
          contentCount: 0
        }
      }
    )
    let count = 0
    let preventry = null
    t.context.client.search('cn=sssvlv', {}, [sssrcontrol, vlvrcontrol], function (err, res) {
      t2.error(err)
      res.on('searchEntry', function (entry) {
        t2.ok(entry)
        t2.ok(entry instanceof ldap.SearchEntry)
        t2.ok(entry.attributes)
        t2.ok(entry.attributes.length)
        if (preventry != null) {
          t2.ok(entry.attributes[0]._vals[0] >= preventry.attributes[0]._vals[0])
        }
        preventry = entry
        count++
      })
      res.on('error', (err) => t2.error(err))
      res.on('end', function () {
        t2.equal(count, 10)
        t2.end()
      })
    })
  })
  t.end()
})

tap.test('search referral', function (t) {
  t.context.client.search('cn=ref, ' + SUFFIX, '(objectclass=*)', function (err, res) {
    t.error(err)
    t.ok(res)
    let gotEntry = 0
    let gotReferral = false
    res.on('searchEntry', function () {
      gotEntry++
    })
    res.on('searchReference', function (referral) {
      gotReferral = true
      t.ok(referral)
      t.ok(referral instanceof ldap.SearchReference)
      t.ok(referral.uris)
      t.ok(referral.uris.length)
    })
    res.on('error', function (err) {
      t.fail(err)
    })
    res.on('end', function (res) {
      t.ok(res)
      t.ok(res instanceof ldap.SearchResponse)
      t.equal(res.status, 0)
      t.equal(gotEntry, 0)
      t.ok(gotReferral)
      t.end()
    })
  })
})

tap.test('search rootDSE', function (t) {
  t.context.client.search('', '(objectclass=*)', function (err, res) {
    t.error(err)
    t.ok(res)
    res.on('searchEntry', function (entry) {
      t.ok(entry)
      t.equal(entry.dn.toString(), '')
      t.ok(entry.attributes)
      t.ok(entry.object)
    })
    res.on('error', function (err) {
      t.fail(err)
    })
    res.on('end', function (res) {
      t.ok(res)
      t.ok(res instanceof ldap.SearchResponse)
      t.equal(res.status, 0)
      t.end()
    })
  })
})

tap.test('search empty attribute', function (t) {
  t.context.client.search('dc=empty', '(objectclass=*)', function (err, res) {
    t.error(err)
    t.ok(res)
    let gotEntry = 0
    res.on('searchEntry', function (entry) {
      const obj = entry.toObject()
      t.equal('dc=empty', obj.dn)
      t.ok(obj.member)
      t.equal(obj.member.length, 0)
      t.ok(obj['member;range=0-1'])
      t.ok(obj['member;range=0-1'].length)
      gotEntry++
    })
    res.on('error', function (err) {
      t.fail(err)
    })
    res.on('end', function (res) {
      t.ok(res)
      t.ok(res instanceof ldap.SearchResponse)
      t.equal(res.status, 0)
      t.equal(gotEntry, 1)
      t.end()
    })
  })
})

tap.test('GH-21 binary attributes', function (t) {
  t.context.client.search('cn=bin, ' + SUFFIX, '(objectclass=*)', function (err, res) {
    t.error(err)
    t.ok(res)
    let gotEntry = 0
    const expect = Buffer.from('\u00bd + \u00bc = \u00be', 'utf8')
    const expect2 = Buffer.from([0xB5, 0xE7, 0xCA, 0xD3, 0xBB, 0xFA])
    res.on('searchEntry', function (entry) {
      t.ok(entry)
      t.ok(entry instanceof ldap.SearchEntry)
      t.equal(entry.dn.toString(), 'cn=bin,' + SUFFIX)
      t.ok(entry.attributes)
      t.ok(entry.attributes.length)
      t.equal(entry.attributes[0].type, 'foo;binary')
      t.equal(entry.attributes[0].vals[0], expect.toString('base64'))
      t.equal(entry.attributes[0].buffers[0].toString('base64'),
        expect.toString('base64'))

      t.ok(entry.attributes[1].type, 'gb18030')
      t.equal(entry.attributes[1].buffers.length, 1)
      t.equal(expect2.length, entry.attributes[1].buffers[0].length)
      for (let i = 0; i < expect2.length; i++) { t.equal(expect2[i], entry.attributes[1].buffers[0][i]) }

      t.ok(entry.object)
      gotEntry++
    })
    res.on('error', function (err) {
      t.fail(err)
    })
    res.on('end', function (res) {
      t.ok(res)
      t.ok(res instanceof ldap.SearchResponse)
      t.equal(res.status, 0)
      t.equal(gotEntry, 1)
      t.end()
    })
  })
})

tap.test('GH-23 case insensitive attribute filtering', function (t) {
  const opts = {
    filter: '(objectclass=*)',
    attributes: ['Cn']
  }
  t.context.client.search('cn=test, ' + SUFFIX, opts, function (err, res) {
    t.error(err)
    t.ok(res)
    let gotEntry = 0
    res.on('searchEntry', function (entry) {
      t.ok(entry)
      t.ok(entry instanceof ldap.SearchEntry)
      t.equal(entry.dn.toString(), 'cn=test,' + SUFFIX)
      t.ok(entry.attributes)
      t.ok(entry.attributes.length)
      t.equal(entry.attributes[0].type, 'cn')
      t.ok(entry.object)
      gotEntry++
    })
    res.on('error', function (err) {
      t.fail(err)
    })
    res.on('end', function (res) {
      t.ok(res)
      t.ok(res instanceof ldap.SearchResponse)
      t.equal(res.status, 0)
      t.equal(gotEntry, 2)
      t.end()
    })
  })
})

tap.test('GH-24 attribute selection of *', function (t) {
  const opts = {
    filter: '(objectclass=*)',
    attributes: ['*']
  }
  t.context.client.search('cn=test, ' + SUFFIX, opts, function (err, res) {
    t.error(err)
    t.ok(res)
    let gotEntry = 0
    res.on('searchEntry', function (entry) {
      t.ok(entry)
      t.ok(entry instanceof ldap.SearchEntry)
      t.equal(entry.dn.toString(), 'cn=test,' + SUFFIX)
      t.ok(entry.attributes)
      t.ok(entry.attributes.length)
      t.equal(entry.attributes[0].type, 'cn')
      t.equal(entry.attributes[1].type, 'SN')
      t.ok(entry.object)
      gotEntry++
    })
    res.on('error', function (err) {
      t.fail(err)
    })
    res.on('end', function (res) {
      t.ok(res)
      t.ok(res instanceof ldap.SearchResponse)
      t.equal(res.status, 0)
      t.equal(gotEntry, 2)
      t.end()
    })
  })
})

tap.test('idle timeout', function (t) {
  t.context.client.idleTimeout = 250
  function premature () {
    t.error(true)
  }
  t.context.client.on('idle', premature)
  t.context.client.search('dc=slow', 'objectclass=*', function (err, res) {
    t.error(err)
    res.on('searchEntry', function (res) {
      t.ok(res)
    })
    res.on('error', function (err) {
      t.error(err)
    })
    res.on('end', function () {
      const late = setTimeout(function () {
        t.fail('too late')
      }, 500)
      // It's ok to go idle now
      t.context.client.removeListener('idle', premature)
      t.context.client.on('idle', function () {
        clearTimeout(late)
        t.context.client.removeAllListeners('idle')
        t.context.client.idleTimeout = 0
        t.end()
      })
    })
  })
})

tap.test('setup action', function (t) {
  const setupClient = ldap.createClient({
    connectTimeout: parseInt(LDAP_CONNECT_TIMEOUT, 10),
    socketPath: t.context.socketPath
  })
  setupClient.on('setup', function (clt, cb) {
    clt.bind(BIND_DN, BIND_PW, function (err) {
      t.error(err)
      cb(err)
    })
  })
  setupClient.search(SUFFIX, { scope: 'base' }, function (err, res) {
    t.error(err)
    t.ok(res)
    res.on('end', function () {
      setupClient.destroy()
      t.end()
    })
  })
})

tap.test('setup reconnect', function (t) {
  const rClient = ldap.createClient({
    connectTimeout: parseInt(LDAP_CONNECT_TIMEOUT, 10),
    socketPath: t.context.socketPath,
    reconnect: true
  })
  rClient.on('setup', function (clt, cb) {
    clt.bind(BIND_DN, BIND_PW, function (err) {
      t.error(err)
      cb(err)
    })
  })

  function doSearch (_, cb) {
    rClient.search(SUFFIX, { scope: 'base' }, function (err, res) {
      t.error(err)
      res.on('end', function () {
        cb()
      })
    })
  }

  vasync.pipeline({
    funcs: [
      doSearch,
      function cleanDisconnect (_, cb) {
        t.ok(rClient.connected)
        rClient.once('close', function (err) {
          t.error(err)
          t.equal(rClient.connected, false)
          cb()
        })
        rClient.unbind()
      },
      doSearch,
      function simulateError (_, cb) {
        const msg = 'fake socket error'
        rClient.once('error', function (err) {
          t.equal(err.message, msg)
          t.ok(err)
        })
        rClient.once('close', function () {
          // can't test had_err because the socket error is being faked
          cb()
        })
        rClient._socket.emit('error', new Error(msg))
      },
      doSearch
    ]
  }, function (err) {
    t.error(err)
    rClient.destroy()
    t.end()
  })
})

tap.test('setup abort', function (t) {
  const setupClient = ldap.createClient({
    connectTimeout: parseInt(LDAP_CONNECT_TIMEOUT, 10),
    socketPath: t.context.socketPath,
    reconnect: true
  })
  const message = "It's a trap!"
  setupClient.on('setup', function (clt, cb) {
    // simulate failure
    t.ok(clt)
    cb(new Error(message))
  })
  setupClient.on('setupError', function (err) {
    t.ok(true)
    t.equal(err.message, message)
    setupClient.destroy()
    t.end()
  })
})

tap.test('abort reconnect', function (t) {
  const abortClient = ldap.createClient({
    connectTimeout: parseInt(LDAP_CONNECT_TIMEOUT, 10),
    socketPath: 'an invalid path',
    reconnect: true
  })
  let retryCount = 0
  abortClient.on('connectError', function () {
    ++retryCount
  })
  abortClient.once('connectError', function () {
    t.ok(true)
    abortClient.once('destroy', function () {
      t.ok(retryCount < 3)
      t.end()
    })
    abortClient.destroy()
  })
})

tap.test('reconnect max retries', function (t) {
  const RETRIES = 5
  const rClient = ldap.createClient({
    connectTimeout: 100,
    socketPath: 'an invalid path',
    reconnect: {
      failAfter: RETRIES,
      // Keep the test duration low
      initialDelay: 10,
      maxDelay: 100
    }
  })
  let count = 0
  rClient.on('connectError', function () {
    count++
  })
  rClient.on('error', function (err) {
    t.ok(err)
    t.equal(count, RETRIES)
    rClient.destroy()
    t.end()
  })
})

tap.test('reconnect on server close', function (t) {
  const clt = ldap.createClient({
    socketPath: t.context.socketPath,
    reconnect: true
  })
  clt.on('setup', function (sclt, cb) {
    sclt.bind(BIND_DN, BIND_PW, function (err) {
      t.error(err)
      cb(err)
    })
  })
  clt.once('connect', function () {
    t.ok(clt._socket)
    clt.once('connect', function () {
      t.ok(true, 'successful reconnect')
      clt.destroy()
      t.end()
    })

    // Simulate server-side close
    clt._socket.destroy()
  })
})

tap.test('no auto-reconnect on unbind', function (t) {
  const clt = ldap.createClient({
    socketPath: t.context.socketPath,
    reconnect: true
  })
  clt.on('setup', function (sclt, cb) {
    sclt.bind(BIND_DN, BIND_PW, function (err) {
      t.error(err)
      cb(err)
    })
  })
  clt.once('connect', function () {
    clt.once('connect', function () {
      t.error(new Error('client should not reconnect'))
    })
    clt.once('close', function () {
      t.ok(true, 'initial close')
      setImmediate(function () {
        t.ok(!clt.connected, 'should not be connected')
        t.ok(!clt.connecting, 'should not be connecting')
        clt.destroy()
        t.end()
      })
    })

    clt.unbind()
  })
})

tap.test('abandon (GH-27)', function (t) {
  // FIXME: test abandoning a real request
  t.context.client.abandon(401876543, function (err) {
    t.error(err)
    t.end()
  })
})

tap.test('search timeout (GH-51)', function (t) {
  t.context.client.timeout = 250
  t.context.client.search('dc=timeout', 'objectclass=*', function (err, res) {
    t.error(err)
    res.on('error', function () {
      t.end()
    })
  })
})

tap.test('resultError handling', function (t) {
  const client = t.context.client
  vasync.pipeline({ funcs: [errSearch, cleanSearch] }, function (err) {
    t.error(err)
    client.removeListener('resultError', error1)
    client.removeListener('resultError', error2)
    t.end()
  })

  function errSearch (_, cb) {
    client.once('resultError', error1)
    client.search('cn=busy', {}, function (err, res) {
      t.error(err)
      res.once('error', function (error) {
        t.equal(error.name, 'BusyError')
        cb()
      })
    })
  }

  function cleanSearch (_, cb) {
    client.on('resultError', error2)
    client.search(SUFFIX, {}, function (err, res) {
      t.error(err)
      res.once('end', function () {
        t.pass()
        cb()
      })
    })
  }

  function error1 (error) {
    t.equal(error.name, 'BusyError')
  }

  function error2 () {
    t.fail('should not get error')
  }
})

tap.test('connection refused', function (t) {
  getPort().then(function (unusedPortNumber) {
    const client = ldap.createClient({
      url: `ldap://0.0.0.0:${unusedPortNumber}`
    })

    client.on('connectRefused', () => {})

    client.bind('cn=root', 'secret', function (err, res) {
      t.ok(err)
      t.type(err, Error)
      t.equal(err.code, 'ECONNREFUSED')
      t.notOk(res)
      t.end()
    })
  })
})

tap.test('connection timeout', function (t) {
  getPort().then(function (unusedPortNumber) {
    const client = ldap.createClient({
      url: `ldap://example.org:${unusedPortNumber}`,
      connectTimeout: 1,
      timeout: 1
    })

    client.on('connectTimeout', () => {})

    let done = false

    setTimeout(function () {
      if (!done) {
        throw new Error('LDAPJS waited for the server for too long')
      }
    }, 2000)

    client.bind('cn=root', 'secret', function (err, res) {
      t.ok(err)
      t.type(err, Error)
      t.equal(err.message, 'connection timeout')
      done = true
      t.notOk(res)
      t.end()
    })
  })
})

tap.only('emitError', function (t) {
  t.test('connectTimeout', function (t) {
    getPort().then(function (unusedPortNumber) {
      const client = ldap.createClient({
        url: `ldap://example.org:${unusedPortNumber}`,
        connectTimeout: 1,
        timeout: 1
      })

      const timeout = setTimeout(function () {
        throw new Error('LDAPJS waited for the server for too long')
      }, 2000)

      client.on('error', (err) => {
        t.fail(err)
      })
      client.on('connectTimeout', (err) => {
        t.ok(err)
        t.type(err, Error)
        t.equal(err.message, 'connection timeout')
        clearTimeout(timeout)
        t.end()
      })

      client.bind('cn=root', 'secret', () => {})
    })
  })

  t.test('connectTimeout to error', function (t) {
    getPort().then(function (unusedPortNumber) {
      const client = ldap.createClient({
        url: `ldap://example.org:${unusedPortNumber}`,
        connectTimeout: 1,
        timeout: 1
      })

      const timeout = setTimeout(function () {
        throw new Error('LDAPJS waited for the server for too long')
      }, 2000)

      client.on('error', (err) => {
        t.ok(err)
        t.type(err, Error)
        t.equal(err.message, 'connectTimeout: connection timeout')
        clearTimeout(timeout)
        t.end()
      })

      client.bind('cn=root', 'secret', () => {})
    })
  })

  t.test('connectRefused', function (t) {
    getPort().then(function (unusedPortNumber) {
      const client = ldap.createClient({
        url: `ldap://0.0.0.0:${unusedPortNumber}`
      })

      client.on('error', (err) => {
        t.fail(err)
      })
      client.on('connectRefused', (err) => {
        t.ok(err)
        t.type(err, Error)
        t.equal(err.message, `connect ECONNREFUSED 0.0.0.0:${unusedPortNumber}`)
        t.equal(err.code, 'ECONNREFUSED')
        t.end()
      })

      client.bind('cn=root', 'secret', () => {})
    })
  })

  t.test('connectRefused to error', function (t) {
    getPort().then(function (unusedPortNumber) {
      const client = ldap.createClient({
        url: `ldap://0.0.0.0:${unusedPortNumber}`
      })

      client.on('error', (err) => {
        t.ok(err)
        t.type(err, Error)
        t.equal(err.message, `connectRefused: connect ECONNREFUSED 0.0.0.0:${unusedPortNumber}`)
        t.equal(err.code, 'ECONNREFUSED')
        t.end()
      })

      client.bind('cn=root', 'secret', () => {})
    })
  })

  t.end()
})

tap.test('socket destroy', function (t) {
  const clt = ldap.createClient({
    socketPath: t.context.socketPath,
    bindDN: BIND_DN,
    bindCredentials: BIND_PW
  })

  clt.once('connect', function () {
    t.ok(clt)
    clt._socket.once('close', function () {
      t.ok(!clt.connected)
      t.end()
    })
    clt.destroy()
  })

  clt.once('destroy', function () {
    t.ok(clt.destroyed)
  })
})

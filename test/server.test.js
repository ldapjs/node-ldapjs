'use strict'

const net = require('net')
const tap = require('tap')
const vasync = require('vasync')
const vm = require('node:vm')
const { getSock } = require('./utils')
const ldap = require('../lib')

const SERVER_PORT = process.env.SERVER_PORT || 1389
const SUFFIX = 'dc=test'

tap.beforeEach(function (t) {
  // We do not need a `.afterEach` to clean up the sock files because that
  // is done when the server is destroyed.
  t.context.sock = getSock()
})

tap.test('basic create', function (t) {
  const server = ldap.createServer()
  t.ok(server)
  t.end()
})

tap.test('connection count', function (t) {
  const server = ldap.createServer()
  t.ok(server)
  server.listen(0, '127.0.0.1', function () {
    t.ok(true, 'server listening on ' + server.url)

    server.getConnections(function (err, count) {
      t.error(err)
      t.equal(count, 0)

      const client = ldap.createClient({ url: server.url })
      client.on('connect', function () {
        t.ok(true, 'client connected')
        server.getConnections(function (err, count) {
          t.error(err)
          t.equal(count, 1)
          client.unbind()
          server.close(() => t.end())
        })
      })
    })
  })
})

tap.test('properties', function (t) {
  const server = ldap.createServer()
  t.equal(server.name, 'LDAPServer')

  // TODO: better test
  server.maxConnections = 10
  t.equal(server.maxConnections, 10)

  t.equal(server.url, null, 'url empty before bind')
  // listen on a random port so we have a url
  server.listen(0, '127.0.0.1', function () {
    t.ok(server.url)

    server.close(() => t.end())
  })
})

tap.test('IPv6 URL is formatted correctly', function (t) {
  const server = ldap.createServer()
  t.equal(server.url, null, 'url empty before bind')
  server.listen(0, '::1', function () {
    t.ok(server.url)
    t.equal(server.url, 'ldap://[::1]:' + server.port)

    server.close(() => t.end())
  })
})

tap.test('listen on unix/named socket', function (t) {
  const server = ldap.createServer()
  server.listen(t.context.sock, function () {
    t.ok(server.url)
    t.equal(server.url.split(':')[0], 'ldapi')
    server.close(() => t.end())
  })
})

tap.test('listen on static port', function (t) {
  const server = ldap.createServer()
  server.listen(SERVER_PORT, '127.0.0.1', function () {
    const addr = server.address()
    t.equal(addr.port, parseInt(SERVER_PORT, 10))
    t.equal(server.url, `ldap://127.0.0.1:${SERVER_PORT}`)
    server.close(() => t.end())
  })
})

tap.test('listen on ephemeral port', function (t) {
  const server = ldap.createServer()
  server.listen(0, '127.0.0.1', function () {
    const addr = server.address()
    t.ok(addr.port > 0)
    t.ok(addr.port < 65535)
    server.close(() => t.end())
  })
})

tap.test('route order', function (t) {
  function generateHandler (response) {
    const func = function handler (req, res, next) {
      res.send({
        dn: response,
        attributes: { }
      })
      res.end()
      return next()
    }
    return func
  }

  const server = ldap.createServer()
  const sock = t.context.sock
  const dnShort = SUFFIX
  const dnMed = 'dc=sub,' + SUFFIX
  const dnLong = 'dc=long,dc=sub,' + SUFFIX

  // Mount routes out of order
  server.search(dnMed, generateHandler(dnMed))
  server.search(dnShort, generateHandler(dnShort))
  server.search(dnLong, generateHandler(dnLong))
  server.listen(sock, function () {
    t.ok(true, 'server listen')
    const client = ldap.createClient({ socketPath: sock })
    client.on('connect', () => {
      vasync.forEachParallel({
        func: runSearch,
        inputs: [dnShort, dnMed, dnLong]
      }, function (err) {
        t.error(err)
        client.unbind()
        server.close(() => t.end())
      })
    })

    function runSearch (value, cb) {
      client.search(value, '(objectclass=*)', function (err, res) {
        t.error(err)
        t.ok(res)
        res.on('searchEntry', function (entry) {
          t.equal(entry.dn.toString(), value)
        })
        res.on('end', function () {
          cb()
        })
      })
    }
  })
})

tap.test('route absent', function (t) {
  const server = ldap.createServer()
  const DN_ROUTE = 'dc=base'
  const DN_MISSING = 'dc=absent'

  server.bind(DN_ROUTE, function (req, res, next) {
    res.end()
    return next()
  })

  server.listen(t.context.sock, function () {
    t.ok(true, 'server startup')
    vasync.parallel({
      funcs: [
        function presentBind (cb) {
          const clt = ldap.createClient({ socketPath: t.context.sock })
          clt.bind(DN_ROUTE, '', function (err) {
            t.notOk(err)
            clt.unbind()
            cb()
          })
        },
        function absentBind (cb) {
          const clt = ldap.createClient({ socketPath: t.context.sock })
          clt.bind(DN_MISSING, '', function (err) {
            t.ok(err)
            t.equal(err.code, ldap.LDAP_NO_SUCH_OBJECT)
            clt.unbind()
            cb()
          })
        }
      ]
    }, function (err) {
      t.notOk(err)
      server.close(() => t.end())
    })
  })
})

tap.test('route unbind', function (t) {
  const server = ldap.createServer()

  server.unbind(function (req, res, next) {
    t.ok(true, 'server unbind successful')
    res.end()
    return next()
  })

  server.listen(t.context.sock, function () {
    t.ok(true, 'server startup')
    const client = ldap.createClient({ socketPath: t.context.sock })
    client.bind('', '', function (err) {
      t.error(err, 'client bind error')
      client.unbind(function (err) {
        t.error(err, 'client unbind error')
        server.close(() => t.end())
      })
    })
  })
})

tap.test('bind/unbind identity anonymous', function (t) {
  const server = ldap.createServer({
    connectionRouter: function (c) {
      server.newConnection(c)
      server.emit('testconnection', c)
    }
  })

  server.unbind(function (req, res, next) {
    t.ok(true, 'server unbind successful')
    res.end()
    return next()
  })

  server.bind('', function (req, res, next) {
    t.ok(true, 'server bind successful')
    res.end()
    return next()
  })

  const anonDN = ldap.parseDN('cn=anonymous')

  server.listen(t.context.sock, function () {
    t.ok(true, 'server startup')

    const client = ldap.createClient({ socketPath: t.context.sock })
    server.once('testconnection', (c) => {
      t.ok(anonDN.equals(c.ldap.bindDN), 'pre bind dn is correct')
      client.bind('', '', function (err) {
        t.error(err, 'client anon bind error')
        t.ok(anonDN.equals(c.ldap.bindDN), 'anon bind dn is correct')
        client.unbind(function (err) {
          t.error(err, 'client anon unbind error')
          t.ok(anonDN.equals(c.ldap.bindDN), 'anon unbind dn is correct')
          server.close(() => t.end())
        })
      })
    })
  })
})

tap.test('bind/unbind identity user', function (t) {
  const server = ldap.createServer({
    connectionRouter: function (c) {
      server.newConnection(c)
      server.emit('testconnection', c)
    }
  })

  server.unbind(function (req, res, next) {
    t.ok(true, 'server unbind successful')
    res.end()
    return next()
  })

  server.bind('', function (req, res, next) {
    t.ok(true, 'server bind successful')
    res.end()
    return next()
  })

  const anonDN = ldap.parseDN('cn=anonymous')
  const testDN = ldap.parseDN('cn=anotheruser')

  server.listen(t.context.sock, function () {
    t.ok(true, 'server startup')

    const client = ldap.createClient({ socketPath: t.context.sock })
    server.once('testconnection', (c) => {
      t.ok(anonDN.equals(c.ldap.bindDN), 'pre bind dn is correct')
      client.bind(testDN.toString(), 'somesecret', function (err) {
        t.error(err, 'user bind error')
        t.ok(testDN.equals(c.ldap.bindDN), 'user bind dn is correct')
        // check rebinds too
        client.bind('', '', function (err) {
          t.error(err, 'client anon bind error')
          t.ok(anonDN.equals(c.ldap.bindDN), 'anon bind dn is correct')
          // user rebind
          client.bind(testDN.toString(), 'somesecret', function (err) {
            t.error(err, 'user bind error')
            t.ok(testDN.equals(c.ldap.bindDN), 'user rebind dn is correct')
            client.unbind(function (err) {
              t.error(err, 'user unbind error')
              t.ok(anonDN.equals(c.ldap.bindDN), 'user unbind dn is correct')
              server.close(() => t.end())
            })
          })
        })
      })
    })
  })
})

tap.test('strict routing', function (t) {
  const testDN = 'cn=valid'
  let clt
  let server
  const sock = t.context.sock
  vasync.pipeline({
    funcs: [
      function setup (_, cb) {
        server = ldap.createServer({})
        // invalid DNs would go to default handler
        server.search('', function (req, res, next) {
          t.ok(req.dn)
          t.equal(typeof (req.dn), 'object')
          t.equal(req.dn.toString(), testDN)
          res.end()
          next()
        })
        server.listen(sock, function () {
          t.ok(true, 'server startup')
          clt = ldap.createClient({
            socketPath: sock
          })
          cb()
        })
      },
      function testGood (_, cb) {
        clt.search(testDN, { scope: 'base' }, function (err, res) {
          t.error(err)
          res.once('error', function (err2) {
            t.error(err2)
            cb(err2)
          })
          res.once('end', function (result) {
            t.ok(result, 'accepted invalid dn')
            cb()
          })
        })
      }
    ]
  }, function (err) {
    t.error(err)
    if (clt) {
      clt.destroy()
    }
    server.close(() => t.end())
  })
})

tap.test('close accept a callback', function (t) {
  const server = ldap.createServer()
  // callback is called when the server is closed
  server.listen(0, function (err) {
    t.error(err)
    server.close(function (err) {
      t.error(err)
      t.end()
    })
  })
})

tap.test('close without error calls callback', function (t) {
  const server = ldap.createServer()
  // when the server is closed without error, the callback parameter is undefined
  server.listen(1389, '127.0.0.1', function (err) {
    t.error(err)
    server.close(function (err) {
      t.error(err)
      t.end()
    })
  })
})

tap.test('close passes error to callback', function (t) {
  const server = ldap.createServer()
  // when the server is closed with an error, the error is the first parameter of the callback
  server.close(function (err) {
    t.ok(err)
    t.end()
  })
})

tap.test('multithreading support via external server', function (t) {
  const serverOptions = { }
  const server = ldap.createServer(serverOptions)
  const fauxServer = net.createServer(serverOptions, (connection) => {
    server.newConnection(connection)
  })
  fauxServer.log = serverOptions.log
  fauxServer.ldap = {
    config: serverOptions
  }
  t.ok(server)
  fauxServer.listen(5555, '127.0.0.1', function () {
    t.ok(true, 'server listening on ' + server.url)

    t.ok(fauxServer)
    const client = ldap.createClient({ url: 'ldap://127.0.0.1:5555' })
    client.on('connect', function () {
      t.ok(client)
      client.unbind()
      fauxServer.close(() => t.end())
    })
  })
})

tap.test('multithreading support via hook', function (t) {
  const serverOptions = {
    connectionRouter: (connection) => {
      server.newConnection(connection)
    }
  }
  const server = ldap.createServer(serverOptions)
  const fauxServer = ldap.createServer(serverOptions)
  t.ok(server)
  fauxServer.listen(0, '127.0.0.1', function () {
    t.ok(true, 'server listening on ' + server.url)

    t.ok(fauxServer)
    const client = ldap.createClient({ url: fauxServer.url })
    client.on('connect', function () {
      t.ok(client)
      client.unbind()
      fauxServer.close(() => t.end())
    })
  })
})

tap.test('cross-realm type checks', function (t) {
  const server = ldap.createServer()
  const ctx = vm.createContext({})
  vm.runInContext(
    'globalThis.search=function(){};\n' +
    'globalThis.searches=[function(){}];'
    , ctx)
  server.search('', ctx.search)
  server.search('', ctx.searches)
  t.ok(server)
  t.end()
})

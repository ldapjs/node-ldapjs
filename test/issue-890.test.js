'use strict'

const tap = require('tap')
const ldapjs = require('../')
const { SearchResultEntry, SearchRequest } = require('@ldapjs/messages')
const server = ldapjs.createServer()
const BIND_DN = 'cn=root'
const BIND_PW = 'secret'
const SUFFIX = ''

const directory = {
  'dc=example,dc=com': {
    objectclass: 'example',
    dc: 'example',
    cn: 'example'
  }
}

server.bind(SUFFIX, (res, done) => {
  res.end()
  return done()
})

server.search(SUFFIX, (req, res, done) => {
  const dn = req.dn.toString().toLowerCase()

  if (Object.hasOwn(directory, dn) === false) {
    return done(Error('not in directory'))
  }

  switch (req.scope) {
    case SearchRequest.SCOPE_BASE:
    case SearchRequest.SCOPE_SUBTREE: {
      res.send(new SearchResultEntry({ objectName: `dc=${req.scopeName}` }))
      break
    }
  }
  res.end()
  done()
})

tap.beforeEach(t => {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (err) => {
      if (err) return reject(err)
      t.context.url = server.url
      t.context.client = ldapjs.createClient({ url: [server.url], timeout: 5, connectTimeout: 0, idleTimeout: 0 })
      t.context.searchOpts = {
        filter: '(&(objectClass=*))',
        scope: 'sub',
        attributes: ['dn', 'cn']
      }

      resolve()
    })
  })
})

tap.afterEach(t => {
  return new Promise((resolve, reject) => {
    t.context.client.destroy()
    server.close((err) => {
      if (err) return reject(err)
      resolve()
    })
  })
})

tap.test('handle null messages', { timeout: 50000 }, t => {
  const { client } = t.context
  client.bind(BIND_DN, BIND_PW, function (err) {
    t.match(err.lde_message, 'request timeout (client interrupt)')
    t.end()
  })
})

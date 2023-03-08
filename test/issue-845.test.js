'use strict'

const tap = require('tap')
const { SearchResultEntry, SearchRequest } = require('@ldapjs/messages')
const ldapjs = require('../')

const server = ldapjs.createServer()

const SUFFIX = ''
const directory = {
  'dc=example,dc=com': {
    objectclass: 'example',
    dc: 'example',
    cn: 'example'
  }
}

server.bind(SUFFIX, (req, res, done) => {
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

      t.context.client = ldapjs.createClient({ url: [server.url] })
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

tap.test('rejects if search not in directory', t => {
  const { client, searchOpts } = t.context

  client.search('dc=nope', searchOpts, (err, res) => {
    t.error(err)
    res.on('error', err => {
      // TODO: plain error messages should not be lost
      // This should be fixed in a revamp of the server code.
      // ~ jsumners 2023-03-08
      t.equal(err.lde_message, 'Operations Error')
      t.end()
    })
  })
})

tap.test('base scope matches', t => {
  const { client, searchOpts } = t.context
  searchOpts.scope = 'base'

  client.search('dc=example,dc=com', searchOpts, (err, res) => {
    t.error(err)
    res.on('error', (err) => {
      t.error(err)
      t.end()
    })
    res.on('searchEntry', entry => {
      t.equal(entry.objectName.toString(), 'dc=base')
      t.end()
    })
  })
})

tap.test('sub scope matches', t => {
  const { client, searchOpts } = t.context

  client.search('dc=example,dc=com', searchOpts, (err, res) => {
    t.error(err)
    res.on('error', (err) => {
      t.error(err)
      t.end()
    })
    res.on('searchEntry', entry => {
      t.equal(entry.objectName.toString(), 'dc=subtree')
      t.end()
    })
  })
})

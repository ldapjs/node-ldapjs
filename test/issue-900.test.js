'use strict'

const tap = require('tap')
const ldapjs = require('../')

const server = ldapjs.createServer()

const SUFFIX = ''
const directory = {
  'dc=example,dc=com': {
    objectclass: 'example',
    dc: 'example',
    cn: 'example'
  },
  'cn=foo,dc=example,dc=com': {
    objectclass: 'example',
    dn: 'cn=foo,dc=example,dc=com',
    cn: 'foo',
    lowercase: 'r-1',
    UPPERCASE: 'r-2',
    miXed: 'r-3'
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

  res.send({
    dn,
    attributes: directory[dn]
  })

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
        scope: 'sub'
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

tap.test('returns lowercase attribute', t => {
  const { client, searchOpts } = t.context

  client.search('cn=foo,dc=example,dc=com', {
    ...searchOpts,
    attributes: ['lowercase']
  }, (err, res) => {
    t.error(err)
    res.on('searchEntry', e => {
      t.equal(e.pojo.attributes.length, 1)
      t.match(e.pojo.attributes[0],
        {
          type: 'lowercase',
          values: ['r-1']
        }
      )

      t.end()
    })
  })

  tap.test('returns UPPERCASE attribute', t => {
    const { client, searchOpts } = t.context

    client.search('cn=foo,dc=example,dc=com', {
      ...searchOpts,
      attributes: ['UPPERCASE']
    }, (err, res) => {
      t.error(err)
      res.on('searchEntry', e => {
        t.equal(e.pojo.attributes.length, 1)
        t.match(e.pojo.attributes[0],
          {
            type: 'UPPERCASE',
            values: ['r-2']
          }
        )

        t.end()
      })
    })
  })

  tap.test('returns miXed attribute', t => {
    const { client, searchOpts } = t.context

    client.search('cn=foo,dc=example,dc=com', {
      ...searchOpts,
      attributes: ['miXed']
    }, (err, res) => {
      t.error(err)
      res.on('searchEntry', e => {
        t.equal(e.pojo.attributes.length, 1)
        t.match(e.pojo.attributes[0],
          {
            type: 'miXed',
            values: ['r-3']
          }
        )

        t.end()
      })
    })
  })

  tap.test('uses insensitive attribute matching', t => {
    const { client, searchOpts } = t.context

    client.search('cn=foo,dc=example,dc=com', {
      ...searchOpts,
      attributes: ['uppercase', 'mixed']
    }, (err, res) => {
      t.error(err)
      res.on('searchEntry', e => {
        t.equal(e.pojo.attributes.length, 2)
        t.match(e.pojo.attributes.find(a => a.type === 'UPPERCASE'),
          {
            type: 'UPPERCASE',
            values: ['r-2']
          }
        )
        t.match(e.pojo.attributes.find(a => a.type === 'miXed'),
          {
            type: 'miXed',
            values: ['r-3']
          }
        )

        t.end()
      })
    })
  })
})

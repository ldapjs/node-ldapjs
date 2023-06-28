'use strict'

const tap = require('tap')
const { SearchResultEntry, SearchRequest } = require('@ldapjs/messages')
const ldapjs = require('../lib')
const process = require('process');
const server = ldapjs.createServer()

const SUFFIX = ''
const directory = {
  'dc=example,dc=com': {
    objectclass: 'example',
    dc: 'example',
    cn: 'example'
  }
}

// process.prependListener('uncaughtException', handleException);

// function handleException(err){
//   console.error(err);
// }

process.on('SIGINT', () => {
  console.log('SKIP');
});

server.bind(SUFFIX, (req, res, done) => {
  res.end()
  return done()
})

server.search(SUFFIX, (req, res, done) => {
  // const dn = req.dn.toString().toLowerCase()

  // if (Object.hasOwn(directory, dn) === false) {
  //   return done(Error('not in directory'))
  // }

  // switch (req.scope) {
  //   case SearchRequest.SCOPE_BASE:
  //   case SearchRequest.SCOPE_SUBTREE: {
  //     res.send(new SearchResultEntry({ objectName: `dc=${req.scopeName}` }))
  //     break
  //   }
  // }

  // res.end()
  // done()
})

tap.beforeEach(t => {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (err) => {
      if (err) return reject(err)
      t.context.url = server.url

      // t.context.client = ldapjs.createClient({ url: [server.url],timeout:5 })
      // t.context.searchOpts = {
      //   filter: '(&(objectClass=*))',
      //   scope: 'subtree',
      //   attributes: ['dn', 'cn']
      // }

      resolve()
    })
  })
})

tap.afterEach(t => {
  // return new Promise((resolve, reject) => {
  //   t.context.client.destroy()
  //   server.close((err) => {
  //     if (err) return reject(err)
  //     resolve()
  //   })
  // })
})


tap.test('tracker.fetch ', t => {
  const { client, searchOpts } = t.context
  // client.bind('test', 'test', (err) => {
  //   t.equal(err.lde_message, 'request timeout (client interrupt)');
  //   client.unbind();
  // });
})





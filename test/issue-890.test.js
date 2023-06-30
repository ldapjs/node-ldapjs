'use strict'

// This test is complicated. It must simulate a server sending an unsolicited,
// or a mismatched, message in order to force the client's internal message
// tracker to try and find a corresponding sent message that does not exist.
// In order to do that, we need to set a high test timeout and wait for the
// error message to be logged.

const tap = require('tap')
const ldapjs = require('../')
const { SearchResultEntry } = require('@ldapjs/messages')
const server = ldapjs.createServer()
const SUFFIX = ''

tap.timeout = 10000

server.bind(SUFFIX, (res, done) => {
  res.end()
  return done()
})

server.search(SUFFIX, (req, res, done) => {
  const result = new SearchResultEntry({
    objectName: `dc=${req.scopeName}`
  })

  // Respond to the search request with a matched response.
  res.send(result)
  res.end()

  // After a short delay, send ANOTHER response to the client that will not
  // be matched by the client's internal tracker.
  setTimeout(
    () => {
      res.send(result)
      res.end()
      done()
    },
    100
  )
})

tap.beforeEach(t => {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (err) => {
      if (err) return reject(err)

      t.context.logMessages = []
      t.context.logger = {
        child () { return this },
        debug () {},
        error (...args) {
          t.context.logMessages.push(args)
        },
        trace () {}
      }

      t.context.url = server.url
      t.context.client = ldapjs.createClient({
        url: [server.url],
        timeout: 5,
        log: t.context.logger
      })

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

tap.test('handle null messages', t => {
  const { client, logMessages } = t.context

  // There's no way to get an error from the client when it has received an
  // unmatched response from the server. So we need to poll our logger instance
  // and detect when the corresponding error message has been logged.
  const timer = setInterval(
    () => {
      if (logMessages.length > 0) {
        t.equal(
          logMessages.some(msg => msg[1] === 'unmatched server message received'),
          true
        )
        clearInterval(timer)
        t.end()
      }
    },
    100
  )

  client.search('dc=test', (error) => {
    t.error(error)
  })
})

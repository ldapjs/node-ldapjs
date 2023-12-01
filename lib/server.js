// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert')
const EventEmitter = require('events').EventEmitter
const net = require('net')
const tls = require('tls')
const util = require('util')

// var asn1 = require('@ldapjs/asn1')
const VError = require('verror').VError

const { DN, RDN } = require('@ldapjs/dn')
const errors = require('./errors')
const Protocol = require('@ldapjs/protocol')

const messages = require('@ldapjs/messages')

const Parser = require('./messages').Parser
const LdapResult = messages.LdapResult
const AbandonResponse = messages.AbandonResponse
const AddResponse = messages.AddResponse
const BindResponse = messages.BindResponse
const CompareResponse = messages.CompareResponse
const DeleteResponse = messages.DeleteResponse
const ExtendedResponse = messages.ExtensionResponse
const ModifyResponse = messages.ModifyResponse
const ModifyDnResponse = messages.ModifyDnResponse
const SearchRequest = messages.SearchRequest
const SearchResponse = require('./messages/search_response')

/// --- Globals

// var Ber = asn1.Ber
// var BerReader = asn1.BerReader
// const DN = dn.DN

// var sprintf = util.format

/// --- Helpers

function mergeFunctionArgs (argv, start, end) {
  assert.ok(argv)

  if (!start) { start = 0 }
  if (!end) { end = argv.length }

  const handlers = []

  for (let i = start; i < end; i++) {
    if (Array.isArray(argv[i])) {
      const arr = argv[i]
      for (let j = 0; j < arr.length; j++) {
        if (typeof arr[j] !== 'function') {
          throw new TypeError('Invalid argument type: ' + typeof (arr[j]))
        }
        handlers.push(arr[j])
      }
    } else if (typeof argv[i] === 'function') {
      handlers.push(argv[i])
    } else {
      throw new TypeError('Invalid argument type: ' + typeof (argv[i]))
    }
  }

  return handlers
}

function getResponse (req) {
  assert.ok(req)

  let Response

  switch (req.protocolOp) {
    case Protocol.operations.LDAP_REQ_BIND:
      Response = BindResponse
      break
    case Protocol.operations.LDAP_REQ_ABANDON:
      Response = AbandonResponse
      break
    case Protocol.operations.LDAP_REQ_ADD:
      Response = AddResponse
      break
    case Protocol.operations.LDAP_REQ_COMPARE:
      Response = CompareResponse
      break
    case Protocol.operations.LDAP_REQ_DELETE:
      Response = DeleteResponse
      break
    case Protocol.operations.LDAP_REQ_EXTENSION:
      Response = ExtendedResponse
      break
    case Protocol.operations.LDAP_REQ_MODIFY:
      Response = ModifyResponse
      break
    case Protocol.operations.LDAP_REQ_MODRDN:
      Response = ModifyDnResponse
      break
    case Protocol.operations.LDAP_REQ_SEARCH:
      Response = SearchResponse
      break
    case Protocol.operations.LDAP_REQ_UNBIND:
      // TODO: when the server receives an unbind request this made up response object was returned.
      // Instead, we need to just terminate the connection. ~ jsumners
      Response = class extends LdapResult {
        status = 0
        end () {
          req.connection.end()
        }
      }
      break
    default:
      return null
  }
  assert.ok(Response)

  const res = new Response({
    messageId: req.messageId,
    attributes: ((req instanceof SearchRequest) ? req.attributes : undefined)
  })
  res.log = req.log
  res.connection = req.connection
  res.logId = req.logId

  if (typeof res.end !== 'function') {
    // This is a hack to re-add the original tight coupling of the message
    // objects and the server connection.
    // TODO: remove this during server refactoring ~ jsumners 2023-02-16
    switch (res.protocolOp) {
      case 0: {
        res.end = abandonResponseEnd
        break
      }

      case Protocol.operations.LDAP_RES_COMPARE: {
        res.end = compareResponseEnd
        break
      }

      default: {
        res.end = defaultResponseEnd
        break
      }
    }
  }

  return res
}

/**
 * Response connection end handler for most responses.
 *
 * @param {number} status
 */
function defaultResponseEnd (status) {
  if (typeof status === 'number') { this.status = status }

  const ber = this.toBer()
  this.log.debug('%s: sending: %j', this.connection.ldap.id, this.pojo)

  try {
    this.connection.write(ber.buffer)
  } catch (error) {
    this.log.warn(
      error,
      '%s failure to write message %j',
      this.connection.ldap.id,
      this.pojo
    )
  }
}

/**
 * Response connection end handler for ABANDON responses.
 */
function abandonResponseEnd () {}

/**
 * Response connection end handler for COMPARE responses.
 *
 * @param {number | boolean} status
 */
function compareResponseEnd (status) {
  let result = 0x06
  if (typeof status === 'boolean') {
    if (status === false) {
      result = 0x05
    }
  } else {
    result = status
  }
  return defaultResponseEnd.call(this, result)
}

function defaultHandler (req, res, next) {
  assert.ok(req)
  assert.ok(res)
  assert.ok(next)

  res.matchedDN = req.dn.toString()
  res.errorMessage = 'Server method not implemented'
  res.end(errors.LDAP_OTHER)
  return next()
}

function defaultNoOpHandler (req, res, next) {
  assert.ok(req)
  assert.ok(res)
  assert.ok(next)

  res.end()
  return next()
}

function noSuffixHandler (req, res, next) {
  assert.ok(req)
  assert.ok(res)
  assert.ok(next)

  res.errorMessage = 'No tree found for: ' + req.dn.toString()
  res.end(errors.LDAP_NO_SUCH_OBJECT)
  return next()
}

function noExOpHandler (req, res, next) {
  assert.ok(req)
  assert.ok(res)
  assert.ok(next)

  res.errorMessage = req.requestName + ' not supported'
  res.end(errors.LDAP_PROTOCOL_ERROR)
  return next()
}

/// --- API

/**
 * Constructs a new server that you can call .listen() on, in the various
 * forms node supports.  You need to first assign some handlers to the various
 * LDAP operations however.
 *
 * The options object currently only takes a certificate/private key, and a
 * bunyan logger handle.
 *
 * This object exposes the following events:
 *  - 'error'
 *  - 'close'
 *
 * @param {Object} options (optional) parameterization object.
 * @throws {TypeError} on bad input.
 */
function Server (options) {
  if (options) {
    if (typeof (options) !== 'object') { throw new TypeError('options (object) required') }
    if (typeof (options.log) !== 'object') { throw new TypeError('options.log must be an object') }

    if (options.certificate || options.key) {
      if (!(options.certificate && options.key) ||
          (typeof (options.certificate) !== 'string' &&
          !Buffer.isBuffer(options.certificate)) ||
          (typeof (options.key) !== 'string' &&
          !Buffer.isBuffer(options.key))) {
        throw new TypeError('options.certificate and options.key ' +
                            '(string or buffer) are both required for TLS')
      }
    }
  } else {
    options = {}
  }
  const self = this

  EventEmitter.call(this, options)

  this._chain = []
  this.log = options.log
  const log = this.log

  function setupConnection (c) {
    assert.ok(c)

    if (c.type === 'unix') {
      c.remoteAddress = self.server.path
      c.remotePort = c.fd
    } else if (c.socket) {
      // TLS
      c.remoteAddress = c.socket.remoteAddress
      c.remotePort = c.socket.remotePort
    }

    const rdn = new RDN({ cn: 'anonymous' })

    c.ldap = {
      id: c.remoteAddress + ':' + c.remotePort,
      config: options,
      _bindDN: new DN({ rdns: [rdn] })
    }
    c.addListener('timeout', function () {
      log.trace('%s timed out', c.ldap.id)
      c.destroy()
    })
    c.addListener('end', function () {
      log.trace('%s shutdown', c.ldap.id)
    })
    c.addListener('error', function (err) {
      log.warn('%s unexpected connection error', c.ldap.id, err)
      self.emit('clientError', err)
      c.destroy()
    })
    c.addListener('close', function (closeError) {
      log.trace('%s close; had_err=%j', c.ldap.id, closeError)
      c.end()
    })

    c.ldap.__defineGetter__('bindDN', function () {
      return c.ldap._bindDN
    })
    c.ldap.__defineSetter__('bindDN', function (val) {
      if (Object.prototype.toString.call(val) !== '[object LdapDn]') {
        throw new TypeError('DN required')
      }

      c.ldap._bindDN = val
      return val
    })
    return c
  }

  self.newConnection = function (conn) {
    // TODO: make `newConnection` available on the `Server` prototype
    // https://github.com/ldapjs/node-ldapjs/pull/727/files#r636572294
    setupConnection(conn)
    log.trace('new connection from %s', conn.ldap.id)

    conn.parser = new Parser({
      log: options.log
    })
    conn.parser.on('message', function (req) {
      // TODO: this is mutating the `@ldapjs/message` objects.
      // We should avoid doing that. ~ jsumners 2023-02-16
      req.connection = conn
      req.logId = conn.ldap.id + '::' + req.messageId
      req.startTime = new Date().getTime()

      log.debug('%s: message received: req=%j', conn.ldap.id, req.pojo)

      const res = getResponse(req)
      if (!res) {
        log.warn('Unimplemented server method: %s', req.type)
        conn.destroy()
        return false
      }

      // parse string DNs for routing/etc
      try {
        switch (req.protocolOp) {
          case Protocol.operations.LDAP_REQ_BIND: {
            req.name = DN.fromString(req.name)
            break
          }

          case Protocol.operations.LDAP_REQ_ADD:
          case Protocol.operations.LDAP_REQ_COMPARE:
          case Protocol.operations.LDAP_REQ_DELETE: {
            if (typeof req.entry === 'string') {
              req.entry = DN.fromString(req.entry)
            } else if (Object.prototype.toString.call(req.entry) !== '[object LdapDn]') {
              throw Error('invalid entry object for operation')
            }
            break
          }

          case Protocol.operations.LDAP_REQ_MODIFY: {
            req.object = DN.fromString(req.object)
            break
          }

          case Protocol.operations.LDAP_REQ_MODRDN: {
            if (typeof req.entry === 'string') {
              req.entry = DN.fromString(req.entry)
            } else if (Object.prototype.toString.call(req.entry) !== '[object LdapDn]') {
              throw Error('invalid entry object for operation')
            }
            // TODO: handle newRdn/Superior
            break
          }

          case Protocol.operations.LDAP_REQ_SEARCH: {
            break
          }

          default: {
            break
          }
        }
      } catch (e) {
        return res.end(errors.LDAP_INVALID_DN_SYNTAX)
      }

      res.connection = conn
      res.logId = req.logId
      res.requestDN = req.dn

      const chain = self._getHandlerChain(req, res)

      let i = 0
      return (function messageIIFE (err) {
        function sendError (sendErr) {
          res.status = sendErr.code || errors.LDAP_OPERATIONS_ERROR
          res.matchedDN = req.suffix ? req.suffix.toString() : ''
          res.errorMessage = sendErr.message || ''
          return res.end()
        }

        function after () {
          if (!self._postChain || !self._postChain.length) { return }

          function next () {} // stub out next for the post chain

          self._postChain.forEach(function (cb) {
            cb.call(self, req, res, next)
          })
        }

        if (err) {
          log.trace('%s sending error: %s', req.logId, err.stack || err)
          self.emit('clientError', err)
          sendError(err)
          return after()
        }

        try {
          const next = messageIIFE
          if (chain.handlers[i]) { return chain.handlers[i++].call(chain.backend, req, res, next) }

          if (req.protocolOp === Protocol.operations.LDAP_REQ_BIND && res.status === 0) {
            // 0 length == anonymous bind
            if (req.dn.length === 0 && req.credentials === '') {
              conn.ldap.bindDN = new DN({ rdns: [new RDN({ cn: 'anonymous' })] })
            } else {
              conn.ldap.bindDN = DN.fromString(req.dn)
            }
          }

          // unbind clear bindDN for safety
          // conn should terminate on unbind (RFC4511 4.3)
          if (req.protocolOp === Protocol.operations.LDAP_REQ_UNBIND && res.status === 0) {
            conn.ldap.bindDN = new DN({ rdns: [new RDN({ cn: 'anonymous' })] })
          }

          return after()
        } catch (e) {
          if (!e.stack) { e.stack = e.toString() }
          log.error('%s uncaught exception: %s', req.logId, e.stack)
          return sendError(new errors.OperationsError(e.message))
        }
      }())
    })

    conn.parser.on('error', function (err, message) {
      self.emit('error', new VError(err, 'Parser error for %s', conn.ldap.id))

      if (!message) { return conn.destroy() }

      const res = getResponse(message)
      if (!res) { return conn.destroy() }

      res.status = 0x02 // protocol error
      res.errorMessage = err.toString()
      return conn.end(res.toBer())
    })

    conn.on('data', function (data) {
      log.trace('data on %s: %s', conn.ldap.id, util.inspect(data))

      conn.parser.write(data)
    })
  } // end newConnection

  this.routes = {}
  if ((options.cert || options.certificate) && options.key) {
    options.cert = options.cert || options.certificate
    this.server = tls.createServer(options, options.connectionRouter ? options.connectionRouter : self.newConnection)
  } else {
    this.server = net.createServer(options.connectionRouter ? options.connectionRouter : self.newConnection)
  }
  this.server.log = options.log
  this.server.ldap = {
    config: options
  }
  this.server.on('close', function () {
    self.emit('close')
  })
  this.server.on('error', function (err) {
    self.emit('error', err)
  })
}
util.inherits(Server, EventEmitter)
Object.defineProperties(Server.prototype, {
  maxConnections: {
    get: function getMaxConnections () {
      return this.server.maxConnections
    },
    set: function setMaxConnections (val) {
      this.server.maxConnections = val
    },
    configurable: false
  },
  connections: {
    get: function getConnections () {
      return this.server.connections
    },
    configurable: false
  },
  name: {
    get: function getName () {
      return 'LDAPServer'
    },
    configurable: false
  },
  url: {
    get: function getURL () {
      let str
      const addr = this.server.address()
      if (!addr) {
        return null
      }
      if (!addr.family) {
        str = 'ldapi://'
        str += this.host.replace(/\//g, '%2f')
        return str
      }
      if (this.server instanceof tls.Server) {
        str = 'ldaps://'
      } else {
        str = 'ldap://'
      }

      let host = this.host
      // Node 18 switched family from returning a string to returning a number
      // https://nodejs.org/api/net.html#serveraddress
      if (addr.family === 'IPv6' || addr.family === 6) {
        host = '[' + this.host + ']'
      }

      str += host + ':' + this.port
      return str
    },
    configurable: false
  }
})
module.exports = Server

/**
 * Adds a handler (chain) for the LDAP add method.
 *
 * Note that this is of the form f(name, [function]) where the second...N
 * arguments can all either be functions or arrays of functions.
 *
 * @param {String} name the DN to mount this handler chain at.
 * @return {Server} this so you can chain calls.
 * @throws {TypeError} on bad input
 */
Server.prototype.add = function (name) {
  const args = Array.prototype.slice.call(arguments, 1)
  return this._mount(Protocol.operations.LDAP_REQ_ADD, name, args)
}

/**
 * Adds a handler (chain) for the LDAP bind method.
 *
 * Note that this is of the form f(name, [function]) where the second...N
 * arguments can all either be functions or arrays of functions.
 *
 * @param {String} name the DN to mount this handler chain at.
 * @return {Server} this so you can chain calls.
 * @throws {TypeError} on bad input
 */
Server.prototype.bind = function (name) {
  const args = Array.prototype.slice.call(arguments, 1)
  return this._mount(Protocol.operations.LDAP_REQ_BIND, name, args)
}

/**
 * Adds a handler (chain) for the LDAP compare method.
 *
 * Note that this is of the form f(name, [function]) where the second...N
 * arguments can all either be functions or arrays of functions.
 *
 * @param {String} name the DN to mount this handler chain at.
 * @return {Server} this so you can chain calls.
 * @throws {TypeError} on bad input
 */
Server.prototype.compare = function (name) {
  const args = Array.prototype.slice.call(arguments, 1)
  return this._mount(Protocol.operations.LDAP_REQ_COMPARE, name, args)
}

/**
 * Adds a handler (chain) for the LDAP delete method.
 *
 * Note that this is of the form f(name, [function]) where the second...N
 * arguments can all either be functions or arrays of functions.
 *
 * @param {String} name the DN to mount this handler chain at.
 * @return {Server} this so you can chain calls.
 * @throws {TypeError} on bad input
 */
Server.prototype.del = function (name) {
  const args = Array.prototype.slice.call(arguments, 1)
  return this._mount(Protocol.operations.LDAP_REQ_DELETE, name, args)
}

/**
 * Adds a handler (chain) for the LDAP exop method.
 *
 * Note that this is of the form f(name, [function]) where the second...N
 * arguments can all either be functions or arrays of functions.
 *
 * @param {String} name OID to assign this handler chain to.
 * @return {Server} this so you can chain calls.
 * @throws {TypeError} on bad input.
 */
Server.prototype.exop = function (name) {
  const args = Array.prototype.slice.call(arguments, 1)
  return this._mount(Protocol.operations.LDAP_REQ_EXTENSION, name, args, true)
}

/**
 * Adds a handler (chain) for the LDAP modify method.
 *
 * Note that this is of the form f(name, [function]) where the second...N
 * arguments can all either be functions or arrays of functions.
 *
 * @param {String} name the DN to mount this handler chain at.
 * @return {Server} this so you can chain calls.
 * @throws {TypeError} on bad input
 */
Server.prototype.modify = function (name) {
  const args = Array.prototype.slice.call(arguments, 1)
  return this._mount(Protocol.operations.LDAP_REQ_MODIFY, name, args)
}

/**
 * Adds a handler (chain) for the LDAP modifyDN method.
 *
 * Note that this is of the form f(name, [function]) where the second...N
 * arguments can all either be functions or arrays of functions.
 *
 * @param {String} name the DN to mount this handler chain at.
 * @return {Server} this so you can chain calls.
 * @throws {TypeError} on bad input
 */
Server.prototype.modifyDN = function (name) {
  const args = Array.prototype.slice.call(arguments, 1)
  return this._mount(Protocol.operations.LDAP_REQ_MODRDN, name, args)
}

/**
 * Adds a handler (chain) for the LDAP search method.
 *
 * Note that this is of the form f(name, [function]) where the second...N
 * arguments can all either be functions or arrays of functions.
 *
 * @param {String} name the DN to mount this handler chain at.
 * @return {Server} this so you can chain calls.
 * @throws {TypeError} on bad input
 */
Server.prototype.search = function (name) {
  const args = Array.prototype.slice.call(arguments, 1)
  return this._mount(Protocol.operations.LDAP_REQ_SEARCH, name, args)
}

/**
 * Adds a handler (chain) for the LDAP unbind method.
 *
 * This method is different than the others and takes no mount point, as unbind
 * is a connection-wide operation, not constrianed to part of the DIT.
 *
 * @return {Server} this so you can chain calls.
 * @throws {TypeError} on bad input
 */
Server.prototype.unbind = function () {
  const args = Array.prototype.slice.call(arguments, 0)
  return this._mount(Protocol.operations.LDAP_REQ_UNBIND, 'unbind', args, true)
}

Server.prototype.use = function use () {
  const args = Array.prototype.slice.call(arguments)
  const chain = mergeFunctionArgs(args, 0, args.length)
  const self = this
  chain.forEach(function (c) {
    self._chain.push(c)
  })
}

Server.prototype.after = function () {
  if (!this._postChain) { this._postChain = [] }

  const self = this
  mergeFunctionArgs(arguments).forEach(function (h) {
    self._postChain.push(h)
  })
}

// All these just re-expose the requisite net.Server APIs
Server.prototype.listen = function (port, host, callback) {
  if (typeof (port) !== 'number' && typeof (port) !== 'string') { throw new TypeError('port (number or path) required') }

  if (typeof (host) === 'function') {
    callback = host
    host = '127.0.0.1'
  }
  if (typeof (port) === 'string' && /^[0-9]+$/.test(port)) {
    // Disambiguate between string ports and file paths
    port = parseInt(port, 10)
  }
  const self = this

  function cbListen () {
    if (typeof (port) === 'number') {
      self.host = self.address().address
      self.port = self.address().port
    } else {
      self.host = port
      self.port = self.server.fd
    }

    if (typeof (callback) === 'function') { callback() }
  }

  if (typeof (port) === 'number') {
    return this.server.listen(port, host, cbListen)
  } else {
    return this.server.listen(port, cbListen)
  }
}
Server.prototype.listenFD = function (fd) {
  this.host = 'unix-domain-socket'
  this.port = fd
  return this.server.listenFD(fd)
}
Server.prototype.close = function (callback) {
  return this.server.close(callback)
}
Server.prototype.address = function () {
  return this.server.address()
}

Server.prototype.getConnections = function (callback) {
  return this.server.getConnections(callback)
}

Server.prototype._getRoute = function (_dn, backend) {
  if (!backend) { backend = this }

  let name
  if (Object.prototype.toString.call(_dn) === '[object LdapDn]') {
    name = _dn.toString()
  } else {
    name = _dn
  }

  if (!this.routes[name]) {
    this.routes[name] = {}
    this.routes[name].backend = backend
    this.routes[name].dn = _dn
    // Force regeneration of the route key cache on next request
    this._routeKeyCache = null
  }

  return this.routes[name]
}

Server.prototype._sortedRouteKeys = function _sortedRouteKeys () {
  // The filtered/sorted route keys are cached to prevent needlessly
  // regenerating the list for every incoming request.
  if (!this._routeKeyCache) {
    const self = this
    const reversedRDNsToKeys = {}
    // Generate mapping of reversedRDNs(DN) -> routeKey
    Object.keys(this.routes).forEach(function (key) {
      const _dn = self.routes[key].dn
      // Ignore non-DN routes such as exop or unbind
      if (Object.prototype.toString.call(_dn) === '[object LdapDn]') {
        const reversed = _dn.clone()
        reversed.reverse()
        reversedRDNsToKeys[reversed.toString()] = key
      }
    })
    const output = []
    // Reverse-sort on reversedRDS(DN) in order to output routeKey list.
    // This will place more specific DNs in front of their parents:
    // 1. dc=test, dc=domain, dc=sub
    // 2. dc=test, dc=domain
    // 3. dc=other, dc=foobar
    Object.keys(reversedRDNsToKeys).sort().reverse().forEach(function (_dn) {
      output.push(reversedRDNsToKeys[_dn])
    })
    this._routeKeyCache = output
  }
  return this._routeKeyCache
}

Server.prototype._getHandlerChain = function _getHandlerChain (req) {
  assert.ok(req)

  const self = this
  const routes = this.routes
  let route

  // check anonymous bind
  if (req.protocolOp === Protocol.operations.LDAP_REQ_BIND &&
      req.dn.toString() === '' &&
      req.credentials === '') {
    return {
      backend: self,
      handlers: [defaultNoOpHandler]
    }
  }

  const op = '0x' + req.protocolOp.toString(16)

  // Special cases are exops, unbinds and abandons. Handle those first.
  if (req.protocolOp === Protocol.operations.LDAP_REQ_EXTENSION) {
    route = routes[req.requestName]
    if (route) {
      return {
        backend: route.backend,
        handlers: (route[op] ? route[op] : [noExOpHandler])
      }
    } else {
      return {
        backend: self,
        handlers: [noExOpHandler]
      }
    }
  } else if (req.protocolOp === Protocol.operations.LDAP_REQ_UNBIND) {
    route = routes.unbind
    if (route) {
      return {
        backend: route.backend,
        handlers: route[op]
      }
    } else {
      return {
        backend: self,
        handlers: [defaultNoOpHandler]
      }
    }
  } else if (req.protocolOp === Protocol.operations.LDAP_REQ_ABANDON) {
    return {
      backend: self,
      handlers: [defaultNoOpHandler]
    }
  }

  // Otherwise, match via DN rules
  const keys = this._sortedRouteKeys()
  let fallbackHandler = [noSuffixHandler]
  // invalid DNs in non-strict mode are routed to the default handler
  const testDN = (typeof (req.dn) === 'string') ? DN.fromString(req.dn) : req.dn
  assert.ok(testDN)

  for (let i = 0; i < keys.length; i++) {
    const suffix = keys[i]
    route = routes[suffix]
    assert.ok(route.dn)
    // Match a valid route or the route wildcard ('')
    if (route.dn.equals(testDN) || route.dn.parentOf(testDN) || suffix === '') {
      if (route[op]) {
        // We should be good to go.
        req.suffix = route.dn
        return {
          backend: route.backend,
          handlers: route[op]
        }
      } else {
        if (suffix === '') {
          break
        } else {
          // We found a valid suffix but not a valid operation.
          // There might be a more generic suffix with a legitimate operation.
          fallbackHandler = [defaultHandler]
        }
      }
    }
  }
  return {
    backend: self,
    handlers: fallbackHandler
  }
}

Server.prototype._mount = function (op, name, argv, notDN) {
  assert.ok(op)
  assert.ok(name !== undefined)
  assert.ok(argv)

  if (typeof (name) !== 'string') { throw new TypeError('name (string) required') }
  if (!argv.length) { throw new Error('at least one handler required') }

  let backend = this
  let index = 0

  if (typeof (argv[0]) === 'object' && !Array.isArray(argv[0])) {
    backend = argv[0]
    index = 1
  }
  const route = this._getRoute(notDN ? name : DN.fromString(name), backend)

  const chain = this._chain.slice()
  argv.slice(index).forEach(function (a) {
    chain.push(a)
  })
  route['0x' + op.toString(16)] = mergeFunctionArgs(chain)

  return this
}

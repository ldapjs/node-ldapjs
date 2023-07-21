'use strict'

const requestQueueFactory = require('./request-queue')
const messageTrackerFactory = require('./message-tracker')
const { MAX_MSGID } = require('./constants')

const EventEmitter = require('events').EventEmitter
const net = require('net')
const tls = require('tls')
const util = require('util')

const once = require('once')
const backoff = require('backoff')
const vasync = require('vasync')
const assert = require('assert-plus')
const VError = require('verror').VError

const Attribute = require('@ldapjs/attribute')
const Change = require('@ldapjs/change')
const Control = require('../controls/index').Control
const { Control: LdapControl } = require('@ldapjs/controls')
const SearchPager = require('./search_pager')
const Protocol = require('@ldapjs/protocol')
const { DN } = require('@ldapjs/dn')
const errors = require('../errors')
const filters = require('@ldapjs/filter')
const Parser = require('../messages/parser')
const url = require('../url')
const CorkedEmitter = require('../corked_emitter')

/// --- Globals

const messages = require('@ldapjs/messages')
const {
  AbandonRequest,
  AddRequest,
  BindRequest,
  CompareRequest,
  DeleteRequest,
  ExtensionRequest: ExtendedRequest,
  ModifyRequest,
  ModifyDnRequest: ModifyDNRequest,
  SearchRequest,
  UnbindRequest,
  LdapResult: LDAPResult,
  SearchResultEntry: SearchEntry,
  SearchResultReference: SearchReference
} = messages

const PresenceFilter = filters.PresenceFilter

const ConnectionError = errors.ConnectionError

const CMP_EXPECT = [errors.LDAP_COMPARE_TRUE, errors.LDAP_COMPARE_FALSE]

// node 0.6 got rid of FDs, so make up a client id for logging
let CLIENT_ID = 0

/// --- Internal Helpers

function nextClientId () {
  if (++CLIENT_ID === MAX_MSGID) { return 1 }

  return CLIENT_ID
}

function validateControls (controls) {
  if (Array.isArray(controls)) {
    controls.forEach(function (c) {
      if (!(c instanceof Control) && !(c instanceof LdapControl)) { throw new TypeError('controls must be [Control]') }
    })
  } else if (controls instanceof Control || controls instanceof LdapControl) {
    controls = [controls]
  } else {
    throw new TypeError('controls must be [Control]')
  }

  return controls
}

function ensureDN (input) {
  if (DN.isDn(input)) {
    return input
  } else if (typeof (input) === 'string') {
    return DN.fromString(input)
  } else {
    throw new Error('invalid DN')
  }
}

/// --- API

/**
 * Constructs a new client.
 *
 * The options object is required, and must contain either a URL (string) or
 * a socketPath (string); the socketPath is only if you want to talk to an LDAP
 * server over a Unix Domain Socket.  Additionally, you can pass in a bunyan
 * option that is the result of `new Logger()`, presumably after you've
 * configured it.
 *
 * @param {Object} options must have either url or socketPath.
 * @throws {TypeError} on bad input.
 */
function Client (options) {
  assert.ok(options)

  EventEmitter.call(this, options)

  const self = this
  this.urls = options.url ? [].concat(options.url).map(url.parse) : []
  this._nextServer = 0
  // updated in connectSocket() after each connect
  this.host = undefined
  this.port = undefined
  this.secure = undefined
  this.url = undefined
  this.tlsOptions = options.tlsOptions
  this.socketPath = options.socketPath || false

  this.log = options.log.child({ clazz: 'Client' }, true)

  this.timeout = parseInt((options.timeout || 0), 10)
  this.connectTimeout = parseInt((options.connectTimeout || 0), 10)
  this.idleTimeout = parseInt((options.idleTimeout || 0), 10)
  if (options.reconnect) {
    // Fall back to defaults if options.reconnect === true
    const rOpts = (typeof (options.reconnect) === 'object')
      ? options.reconnect
      : {}
    this.reconnect = {
      initialDelay: parseInt(rOpts.initialDelay || 100, 10),
      maxDelay: parseInt(rOpts.maxDelay || 10000, 10),
      failAfter: parseInt(rOpts.failAfter, 10) || Infinity
    }
  }

  this.queue = requestQueueFactory({
    size: parseInt((options.queueSize || 0), 10),
    timeout: parseInt((options.queueTimeout || 0), 10)
  })
  if (options.queueDisable) {
    this.queue.freeze()
  }

  // Implicitly configure setup action to bind the client if bindDN and
  // bindCredentials are passed in.  This will more closely mimic PooledClient
  // auto-login behavior.
  if (options.bindDN !== undefined &&
      options.bindCredentials !== undefined) {
    this.on('setup', function (clt, cb) {
      clt.bind(options.bindDN, options.bindCredentials, function (err) {
        if (err) {
          if (self._socket) {
            self._socket.destroy()
          }
          self.emit('error', err)
        }
        cb(err)
      })
    })
  }

  this._socket = null
  this.connected = false
  this.connect()
}
util.inherits(Client, EventEmitter)
module.exports = Client

/**
 * Sends an abandon request to the LDAP server.
 *
 * The callback will be invoked as soon as the data is flushed out to the
 * network, as there is never a response from abandon.
 *
 * @param {Number} messageId the messageId to abandon.
 * @param {Control} controls (optional) either a Control or [Control].
 * @param {Function} callback of the form f(err).
 * @throws {TypeError} on invalid input.
 */
Client.prototype.abandon = function abandon (messageId, controls, callback) {
  assert.number(messageId, 'messageId')
  if (typeof (controls) === 'function') {
    callback = controls
    controls = []
  } else {
    controls = validateControls(controls)
  }
  assert.func(callback, 'callback')

  const req = new AbandonRequest({
    abandonId: messageId,
    controls
  })

  return this._send(req, 'abandon', null, callback)
}

/**
 * Adds an entry to the LDAP server.
 *
 * Entry can be either [Attribute] or a plain JS object where the
 * values are either a plain value or an array of values.  Any value (that's
 * not an array) will get converted to a string, so keep that in mind.
 *
 * @param {String} name the DN of the entry to add.
 * @param {Object} entry an array of Attributes to be added or a JS object.
 * @param {Control} controls (optional) either a Control or [Control].
 * @param {Function} callback of the form f(err, res).
 * @throws {TypeError} on invalid input.
 */
Client.prototype.add = function add (name, entry, controls, callback) {
  assert.ok(name !== undefined, 'name')
  assert.object(entry, 'entry')
  if (typeof (controls) === 'function') {
    callback = controls
    controls = []
  } else {
    controls = validateControls(controls)
  }
  assert.func(callback, 'callback')

  if (Array.isArray(entry)) {
    entry.forEach(function (a) {
      if (!Attribute.isAttribute(a)) { throw new TypeError('entry must be an Array of Attributes') }
    })
  } else {
    const save = entry

    entry = []
    Object.keys(save).forEach(function (k) {
      const attr = new Attribute({ type: k })
      if (Array.isArray(save[k])) {
        save[k].forEach(function (v) {
          attr.addValue(v.toString())
        })
      } else if (Buffer.isBuffer(save[k])) {
        attr.addValue(save[k])
      } else {
        attr.addValue(save[k].toString())
      }
      entry.push(attr)
    })
  }

  const req = new AddRequest({
    entry: ensureDN(name),
    attributes: entry,
    controls
  })

  return this._send(req, [errors.LDAP_SUCCESS], null, callback)
}

/**
 * Performs a simple authentication against the server.
 *
 * @param {String} name the DN to bind as.
 * @param {String} credentials the userPassword associated with name.
 * @param {Control} controls (optional) either a Control or [Control].
 * @param {Function} callback of the form f(err, res).
 * @throws {TypeError} on invalid input.
 */
Client.prototype.bind = function bind (name,
  credentials,
  controls,
  callback,
  _bypass) {
  if (
    typeof (name) !== 'string' &&
    Object.prototype.toString.call(name) !== '[object LdapDn]'
  ) {
    throw new TypeError('name (string) required')
  }
  assert.optionalString(credentials, 'credentials')
  if (typeof (controls) === 'function') {
    callback = controls
    controls = []
  } else {
    controls = validateControls(controls)
  }
  assert.func(callback, 'callback')

  const req = new BindRequest({
    name: name || '',
    authentication: 'Simple',
    credentials: credentials || '',
    controls
  })

  // Connection errors will be reported to the bind callback too (useful when the LDAP server is not available)
  const self = this
  function callbackWrapper (err, ret) {
    self.removeListener('connectError', callbackWrapper)
    callback(err, ret)
  }
  this.addListener('connectError', callbackWrapper)

  return this._send(req, [errors.LDAP_SUCCESS], null, callbackWrapper, _bypass)
}

/**
 * Compares an attribute/value pair with an entry on the LDAP server.
 *
 * @param {String} name the DN of the entry to compare attributes with.
 * @param {String} attr name of an attribute to check.
 * @param {String} value value of an attribute to check.
 * @param {Control} controls (optional) either a Control or [Control].
 * @param {Function} callback of the form f(err, boolean, res).
 * @throws {TypeError} on invalid input.
 */
Client.prototype.compare = function compare (name,
  attr,
  value,
  controls,
  callback) {
  assert.ok(name !== undefined, 'name')
  assert.string(attr, 'attr')
  assert.string(value, 'value')
  if (typeof (controls) === 'function') {
    callback = controls
    controls = []
  } else {
    controls = validateControls(controls)
  }
  assert.func(callback, 'callback')

  const req = new CompareRequest({
    entry: ensureDN(name),
    attribute: attr,
    value,
    controls
  })

  return this._send(req, CMP_EXPECT, null, function (err, res) {
    if (err) { return callback(err) }

    return callback(null, (res.status === errors.LDAP_COMPARE_TRUE), res)
  })
}

/**
 * Deletes an entry from the LDAP server.
 *
 * @param {String} name the DN of the entry to delete.
 * @param {Control} controls (optional) either a Control or [Control].
 * @param {Function} callback of the form f(err, res).
 * @throws {TypeError} on invalid input.
 */
Client.prototype.del = function del (name, controls, callback) {
  assert.ok(name !== undefined, 'name')
  if (typeof (controls) === 'function') {
    callback = controls
    controls = []
  } else {
    controls = validateControls(controls)
  }
  assert.func(callback, 'callback')

  const req = new DeleteRequest({
    entry: ensureDN(name),
    controls
  })

  return this._send(req, [errors.LDAP_SUCCESS], null, callback)
}

/**
 * Performs an extended operation on the LDAP server.
 *
 * Pretty much none of the LDAP extended operations return an OID
 * (responseName), so I just don't bother giving it back in the callback.
 * It's on the third param in `res` if you need it.
 *
 * @param {String} name the OID of the extended operation to perform.
 * @param {String} value value to pass in for this operation.
 * @param {Control} controls (optional) either a Control or [Control].
 * @param {Function} callback of the form f(err, value, res).
 * @throws {TypeError} on invalid input.
 */
Client.prototype.exop = function exop (name, value, controls, callback) {
  assert.string(name, 'name')
  if (typeof (value) === 'function') {
    callback = value
    controls = []
    value = undefined
  }
  if (typeof (controls) === 'function') {
    callback = controls
    controls = []
  } else {
    controls = validateControls(controls)
  }
  assert.func(callback, 'callback')

  const req = new ExtendedRequest({
    requestName: name,
    requestValue: value,
    controls
  })

  return this._send(req, [errors.LDAP_SUCCESS], null, function (err, res) {
    if (err) { return callback(err) }

    return callback(null, res.responseValue || '', res)
  })
}

/**
 * Performs an LDAP modify against the server.
 *
 * @param {String} name the DN of the entry to modify.
 * @param {Change} change update to perform (can be [Change]).
 * @param {Control} controls (optional) either a Control or [Control].
 * @param {Function} callback of the form f(err, res).
 * @throws {TypeError} on invalid input.
 */
Client.prototype.modify = function modify (name, change, controls, callback) {
  assert.ok(name !== undefined, 'name')
  assert.object(change, 'change')

  const changes = []

  function changeFromObject (obj) {
    if (!obj.operation && !obj.type) { throw new Error('change.operation required') }
    if (typeof (obj.modification) !== 'object') { throw new Error('change.modification (object) required') }

    if (Object.keys(obj.modification).length === 2 &&
        typeof (obj.modification.type) === 'string' &&
        Array.isArray(obj.modification.vals)) {
      // Use modification directly if it's already normalized:
      changes.push(new Change({
        operation: obj.operation || obj.type,
        modification: obj.modification
      }))
    } else {
      // Normalize the modification object
      Object.keys(obj.modification).forEach(function (k) {
        const mod = {}
        mod[k] = obj.modification[k]
        changes.push(new Change({
          operation: obj.operation || obj.type,
          modification: mod
        }))
      })
    }
  }

  if (Change.isChange(change)) {
    changes.push(change)
  } else if (Array.isArray(change)) {
    change.forEach(function (c) {
      if (Change.isChange(c)) {
        changes.push(c)
      } else {
        changeFromObject(c)
      }
    })
  } else {
    changeFromObject(change)
  }

  if (typeof (controls) === 'function') {
    callback = controls
    controls = []
  } else {
    controls = validateControls(controls)
  }
  assert.func(callback, 'callback')

  const req = new ModifyRequest({
    object: ensureDN(name),
    changes,
    controls
  })

  return this._send(req, [errors.LDAP_SUCCESS], null, callback)
}

/**
 * Performs an LDAP modifyDN against the server.
 *
 * This does not allow you to keep the old DN, as while the LDAP protocol
 * has a facility for that, it's stupid. Just Search/Add.
 *
 * This will automatically deal with "new superior" logic.
 *
 * @param {String} name the DN of the entry to modify.
 * @param {String} newName the new DN to move this entry to.
 * @param {Control} controls (optional) either a Control or [Control].
 * @param {Function} callback of the form f(err, res).
 * @throws {TypeError} on invalid input.
 */
Client.prototype.modifyDN = function modifyDN (name,
  newName,
  controls,
  callback) {
  assert.ok(name !== undefined, 'name')
  assert.string(newName, 'newName')
  if (typeof (controls) === 'function') {
    callback = controls
    controls = []
  } else {
    controls = validateControls(controls)
  }
  assert.func(callback)

  const newDN = DN.fromString(newName)

  const req = new ModifyDNRequest({
    entry: DN.fromString(name),
    deleteOldRdn: true,
    controls
  })

  if (newDN.length !== 1) {
    req.newRdn = DN.fromString(newDN.shift().toString())
    req.newSuperior = newDN
  } else {
    req.newRdn = newDN
  }

  return this._send(req, [errors.LDAP_SUCCESS], null, callback)
}

/**
 * Performs an LDAP search against the server.
 *
 * Note that the defaults for options are a 'base' search, if that's what
 * you want you can just pass in a string for options and it will be treated
 * as the search filter.  Also, you can either pass in programatic Filter
 * objects or a filter string as the filter option.
 *
 * Note that this method is 'special' in that the callback 'res' param will
 * have two important events on it, namely 'entry' and 'end' that you can hook
 * to.  The former will emit a SearchEntry object for each record that comes
 * back, and the latter will emit a normal LDAPResult object.
 *
 * @param {String} base the DN in the tree to start searching at.
 * @param {Object} options parameters:
 *                           - {String} scope default of 'base'.
 *                           - {String} filter default of '(objectclass=*)'.
 *                           - {Array} attributes [string] to return.
 *                           - {Boolean} attrsOnly whether to return values.
 * @param {Control} controls (optional) either a Control or [Control].
 * @param {Function} callback of the form f(err, res).
 * @throws {TypeError} on invalid input.
 */
Client.prototype.search = function search (base,
  options,
  controls,
  callback,
  _bypass) {
  assert.ok(base !== undefined, 'search base')
  if (Array.isArray(options) || (options instanceof Control)) {
    controls = options
    options = {}
  } else if (typeof (options) === 'function') {
    callback = options
    controls = []
    options = {
      filter: new PresenceFilter({ attribute: 'objectclass' })
    }
  } else if (typeof (options) === 'string') {
    options = { filter: filters.parseString(options) }
  } else if (typeof (options) !== 'object') {
    throw new TypeError('options (object) required')
  }
  if (typeof (options.filter) === 'string') {
    options.filter = filters.parseString(options.filter)
  } else if (!options.filter) {
    options.filter = new PresenceFilter({ attribute: 'objectclass' })
  } else if (Object.prototype.toString.call(options.filter) !== '[object FilterString]') {
    throw new TypeError('options.filter (Filter) required')
  }
  if (typeof (controls) === 'function') {
    callback = controls
    controls = []
  } else {
    controls = validateControls(controls)
  }
  assert.func(callback, 'callback')

  if (options.attributes) {
    if (!Array.isArray(options.attributes)) {
      if (typeof (options.attributes) === 'string') {
        options.attributes = [options.attributes]
      } else {
        throw new TypeError('options.attributes must be an Array of Strings')
      }
    }
  }

  const self = this
  const baseDN = ensureDN(base)

  function sendRequest (ctrls, emitter, cb) {
    const req = new SearchRequest({
      baseObject: baseDN,
      scope: options.scope || 'base',
      filter: options.filter,
      derefAliases: options.derefAliases || Protocol.search.NEVER_DEREF_ALIASES,
      sizeLimit: options.sizeLimit || 0,
      timeLimit: options.timeLimit || 10,
      typesOnly: options.typesOnly || false,
      attributes: options.attributes || [],
      controls: ctrls
    })

    return self._send(req,
      [errors.LDAP_SUCCESS],
      emitter,
      cb,
      _bypass)
  }

  if (options.paged) {
    // Perform automated search paging
    const pageOpts = typeof (options.paged) === 'object' ? options.paged : {}
    let size = 100 // Default page size
    if (pageOpts.pageSize > 0) {
      size = pageOpts.pageSize
    } else if (options.sizeLimit > 1) {
      // According to the RFC, servers should ignore the paging control if
      // pageSize >= sizelimit.  Some might still send results, but it's safer
      // to stay under that figure when assigning a default value.
      size = options.sizeLimit - 1
    }

    const pager = new SearchPager({
      callback,
      controls,
      pageSize: size,
      pagePause: pageOpts.pagePause,
      sendRequest
    })
    pager.begin()
  } else {
    sendRequest(controls, new CorkedEmitter(), callback)
  }
}

/**
 * Unbinds this client from the LDAP server.
 *
 * Note that unbind does not have a response, so this callback is actually
 * optional; either way, the client is disconnected.
 *
 * @param {Function} callback of the form f(err).
 * @throws {TypeError} if you pass in callback as not a function.
 */
Client.prototype.unbind = function unbind (callback) {
  if (!callback) { callback = function () {} }

  if (typeof (callback) !== 'function') { throw new TypeError('callback must be a function') }

  // When the socket closes, it is useful to know whether it was due to a
  // user-initiated unbind or something else.
  this.unbound = true

  if (!this._socket) { return callback() }

  const req = new UnbindRequest()
  return this._send(req, 'unbind', null, callback)
}

/**
 * Attempt to secure connection with StartTLS.
 */
Client.prototype.starttls = function starttls (options,
  controls,
  callback,
  _bypass) {
  assert.optionalObject(options)
  options = options || {}
  callback = once(callback)
  const self = this

  if (this._starttls) {
    return callback(new Error('STARTTLS already in progress or active'))
  }

  function onSend (sendErr, emitter) {
    if (sendErr) {
      callback(sendErr)
      return
    }
    /*
     * Now that the request has been sent, block all outgoing messages
     * until an error is received or we successfully complete the setup.
     */
    // TODO: block traffic
    self._starttls = {
      started: true
    }

    emitter.on('error', function (err) {
      self._starttls = null
      callback(err)
    })
    emitter.on('end', function (_res) {
      const sock = self._socket
      /*
       * Unplumb socket data during SSL negotiation.
       * This will prevent the LDAP parser from stumbling over the TLS
       * handshake and raising a ruckus.
       */
      sock.removeAllListeners('data')

      options.socket = sock
      const secure = tls.connect(options)
      secure.once('secureConnect', function () {
        /*
         * Wire up 'data' and 'error' handlers like the normal socket.
         * Handling 'end' events isn't necessary since the underlying socket
         * will handle those.
         */
        secure.removeAllListeners('error')
        secure.on('data', function onData (data) {
          self.log.trace('data event: %s', util.inspect(data))

          self._tracker.parser.write(data)
        })
        secure.on('error', function (err) {
          self.log.trace({ err }, 'error event: %s', new Error().stack)

          self.emit('error', err)
          sock.destroy()
        })
        callback(null)
      })
      secure.once('error', function (err) {
        // If the SSL negotiation failed, to back to plain mode.
        self._starttls = null
        secure.removeAllListeners()
        callback(err)
      })
      self._starttls.success = true
      self._socket = secure
    })
  }

  const req = new ExtendedRequest({
    requestName: '1.3.6.1.4.1.1466.20037',
    requestValue: null,
    controls
  })

  return this._send(req,
    [errors.LDAP_SUCCESS],
    new EventEmitter(),
    onSend,
    _bypass)
}

/**
 * Disconnect from the LDAP server and do not allow reconnection.
 *
 * If the client is instantiated with proper reconnection options, it's
 * possible to initiate new requests after a call to unbind since the client
 * will attempt to reconnect in order to fulfill the request.
 *
 * Calling destroy will prevent any further reconnection from occurring.
 *
 * @param {Object} err (Optional) error that was cause of client destruction
 */
Client.prototype.destroy = function destroy (err) {
  this.destroyed = true
  this.queue.freeze()
  // Purge any queued requests which are now meaningless
  this.queue.flush(function (msg, expect, emitter, cb) {
    if (typeof (cb) === 'function') {
      cb(new Error('client destroyed'))
    }
  })
  if (this.connected) {
    this.unbind()
  }
  if (this._socket) {
    this._socket.destroy()
  }

  this.emit('destroy', err)
}

/**
 * Initiate LDAP connection.
 */
Client.prototype.connect = function connect () {
  if (this.connecting || this.connected) {
    return
  }
  const self = this
  const log = this.log
  let socket
  let tracker

  // Establish basic socket connection
  function connectSocket (cb) {
    const server = self.urls[self._nextServer]
    self._nextServer = (self._nextServer + 1) % self.urls.length

    cb = once(cb)

    function onResult (err, res) {
      if (err) {
        if (self.connectTimer) {
          clearTimeout(self.connectTimer)
          self.connectTimer = null
        }
        self.emit('connectError', err)
      }
      cb(err, res)
    }
    function onConnect () {
      if (self.connectTimer) {
        clearTimeout(self.connectTimer)
        self.connectTimer = null
      }
      socket.removeAllListeners('error')
        .removeAllListeners('connect')
        .removeAllListeners('secureConnect')

      tracker.id = nextClientId() + '__' + tracker.id
      self.log = self.log.child({ ldap_id: tracker.id }, true)

      // Move on to client setup
      setupClient(cb)
    }

    const port = (server && server.port) || self.socketPath
    const host = server && server.hostname
    if (server && server.secure) {
      socket = tls.connect(port, host, self.tlsOptions)
      socket.once('secureConnect', onConnect)
    } else {
      socket = net.connect(port, host)
      socket.once('connect', onConnect)
    }
    socket.once('error', onResult)
    initSocket(server)

    // Setup connection timeout handling, if desired
    if (self.connectTimeout) {
      self.connectTimer = setTimeout(function onConnectTimeout () {
        if (!socket || !socket.readable || !socket.writeable) {
          socket.destroy()
          self._socket = null
          onResult(new ConnectionError('connection timeout'))
        }
      }, self.connectTimeout)
    }
  }

  // Initialize socket events and LDAP parser.
  function initSocket (server) {
    tracker = messageTrackerFactory({
      id: server ? server.href : self.socketPath,
      parser: new Parser({ log })
    })

    // This won't be set on TLS. So. Very. Annoying.
    if (typeof (socket.setKeepAlive) !== 'function') {
      socket.setKeepAlive = function setKeepAlive (enable, delay) {
        return socket.socket
          ? socket.socket.setKeepAlive(enable, delay)
          : false
      }
    }

    socket.on('data', function onData (data) {
      log.trace('data event: %s', util.inspect(data))

      tracker.parser.write(data)
    })

    // The "router"
    //
    // This is invoked after the incoming BER has been parsed into a JavaScript
    // object.
    tracker.parser.on('message', function onMessage (message) {
      message.connection = self._socket
      const trackedObject = tracker.fetch(message.messageId)
      if (!trackedObject) {
        log.error({ message: message.pojo }, 'unmatched server message received')
        return false
      }

      const { message: trackedMessage, callback } = trackedObject

      if (!callback) {
        log.error({ message: message.pojo }, 'unsolicited message')
        return false
      }

      // Some message types have narrower implementations and require extra
      // parsing to be complete. In particular, ExtensionRequest messages will
      // return responses that do not identify the request that generated them.
      // Therefore, we have to match the response to the request and handle
      // the extra processing accordingly.
      switch (trackedMessage.type) {
        case 'ExtensionRequest': {
          const extensionType = ExtendedRequest.recognizedOIDs().lookupName(trackedMessage.requestName)
          switch (extensionType) {
            case 'PASSWORD_MODIFY': {
              message = messages.PasswordModifyResponse.fromResponse(message)
              break
            }

            case 'WHO_AM_I': {
              message = messages.WhoAmIResponse.fromResponse(message)
              break
            }

            default:
          }

          break
        }

        default:
      }

      return callback(message)
    })

    tracker.parser.on('error', function onParseError (err) {
      self.emit('error', new VError(err, 'Parser error for %s',
        tracker.id))
      self.connected = false
      socket.end()
    })
  }

  // After connect, register socket event handlers and run any setup actions
  function setupClient (cb) {
    cb = once(cb)

    // Indicate failure if anything goes awry during setup
    function bail (err) {
      socket.destroy()
      cb(err || new Error('client error during setup'))
    }
    // Work around lack of close event on tls.socket in node < 0.11
    ((socket.socket) ? socket.socket : socket).once('close', bail)
    socket.once('error', bail)
    socket.once('end', bail)
    socket.once('timeout', bail)
    socket.once('cleanupSetupListeners', function onCleanup () {
      socket.removeListener('error', bail)
        .removeListener('close', bail)
        .removeListener('end', bail)
        .removeListener('timeout', bail)
    })

    self._socket = socket
    self._tracker = tracker

    // Run any requested setup (such as automatically performing a bind) on
    // socket before signalling successful connection.
    // This setup needs to bypass the request queue since all other activity is
    // blocked until the connection is considered fully established post-setup.
    // Only allow bind/search/starttls for now.
    const basicClient = {
      bind: function bindBypass (name, credentials, controls, callback) {
        return self.bind(name, credentials, controls, callback, true)
      },
      search: function searchBypass (base, options, controls, callback) {
        return self.search(base, options, controls, callback, true)
      },
      starttls: function starttlsBypass (options, controls, callback) {
        return self.starttls(options, controls, callback, true)
      },
      unbind: self.unbind.bind(self)
    }
    vasync.forEachPipeline({
      func: function (f, callback) {
        f(basicClient, callback)
      },
      inputs: self.listeners('setup')
    }, function (err, _res) {
      if (err) {
        self.emit('setupError', err)
      }
      cb(err)
    })
  }

  // Wire up "official" event handlers after successful connect/setup
  function postSetup () {
    // cleanup the listeners we attached in setup phrase.
    socket.emit('cleanupSetupListeners');

    // Work around lack of close event on tls.socket in node < 0.11
    ((socket.socket) ? socket.socket : socket).once('close',
      self._onClose.bind(self))
    socket.on('end', function onEnd () {
      log.trace('end event')

      self.emit('end')
      socket.end()
    })
    socket.on('error', function onSocketError (err) {
      log.trace({ err }, 'error event: %s', new Error().stack)

      self.emit('error', err)
      socket.destroy()
    })
    socket.on('timeout', function onTimeout () {
      log.trace('timeout event')

      self.emit('socketTimeout')
      socket.end()
    })

    const server = self.urls[self._nextServer]
    if (server) {
      self.host = server.hostname
      self.port = server.port
      self.secure = server.secure
    }
  }

  let retry
  let failAfter
  if (this.reconnect) {
    retry = backoff.exponential({
      initialDelay: this.reconnect.initialDelay,
      maxDelay: this.reconnect.maxDelay
    })
    failAfter = this.reconnect.failAfter
    if (this.urls.length > 1 && failAfter) {
      failAfter *= this.urls.length
    }
  } else {
    retry = backoff.exponential({
      initialDelay: 1,
      maxDelay: 2
    })
    failAfter = this.urls.length || 1
  }
  retry.failAfter(failAfter)

  retry.on('ready', function (num, _delay) {
    if (self.destroyed) {
      // Cease connection attempts if destroyed
      return
    }
    connectSocket(function (err) {
      if (!err) {
        postSetup()
        self.connecting = false
        self.connected = true
        self.emit('connect', socket)
        self.log.debug('connected after %d attempt(s)', num + 1)
        // Flush any queued requests
        self._flushQueue()
        self._connectRetry = null
      } else {
        retry.backoff(err)
      }
    })
  })
  retry.on('fail', function (err) {
    if (self.destroyed) {
      // Silence any connect/setup errors if destroyed
      return
    }
    self.log.debug('failed to connect after %d attempts', failAfter)
    // Communicate the last-encountered error
    if (err instanceof ConnectionError) {
      self.emitError('connectTimeout', err)
    } else if (err.code === 'ECONNREFUSED') {
      self.emitError('connectRefused', err)
    } else {
      self.emit('error', err)
    }
  })

  this._connectRetry = retry
  this.connecting = true
  retry.backoff()
}

/// --- Private API

/**
 * Flush queued requests out to the socket.
 */
Client.prototype._flushQueue = function _flushQueue () {
  // Pull items we're about to process out of the queue.
  this.queue.flush(this._send.bind(this))
}

/**
 * Clean up socket/parser resources after socket close.
 */
Client.prototype._onClose = function _onClose (closeError) {
  const socket = this._socket
  const tracker = this._tracker
  socket.removeAllListeners('connect')
    .removeAllListeners('data')
    .removeAllListeners('drain')
    .removeAllListeners('end')
    .removeAllListeners('error')
    .removeAllListeners('timeout')
  this._socket = null
  this.connected = false;

  ((socket.socket) ? socket.socket : socket).removeAllListeners('close')

  this.log.trace('close event had_err=%s', closeError ? 'yes' : 'no')

  this.emit('close', closeError)
  // On close we have to walk the outstanding messages and go invoke their
  // callback with an error.
  tracker.purge(function (msgid, cb) {
    if (socket.unbindMessageID !== msgid) {
      return cb(new ConnectionError(tracker.id + ' closed'))
    } else {
      // Unbinds will be communicated as a success since we're closed
      // TODO: we are faking this "UnbindResponse" object in order to make
      // tests pass. There is no such thing as an "unbind response" in the LDAP
      // protocol. When the client is revamped, this logic should be removed.
      // ~ jsumners 2023-02-16
      const Unbind = class extends LDAPResult {
        messageID = msgid
        messageId = msgid
        status = 'unbind'
      }
      const unbind = new Unbind()
      return cb(unbind)
    }
  })

  // Trash any parser or starttls state
  this._tracker = null
  delete this._starttls

  // Automatically fire reconnect logic if the socket was closed for any reason
  // other than a user-initiated unbind.
  if (this.reconnect && !this.unbound) {
    this.connect()
  }
  this.unbound = false
  return false
}

/**
 * Maintain idle timer for client.
 *
 * Will start timer to fire 'idle' event if conditions are satisfied.  If
 * conditions are not met and a timer is running, it will be cleared.
 *
 * @param {Boolean} override explicitly disable timer.
 */
Client.prototype._updateIdle = function _updateIdle (override) {
  if (this.idleTimeout === 0) {
    return
  }
  // Client must be connected but not waiting on any request data
  const self = this
  function isIdle (disable) {
    return ((disable !== true) &&
      (self._socket && self.connected) &&
      (self._tracker.pending === 0))
  }
  if (isIdle(override)) {
    if (!this._idleTimer) {
      this._idleTimer = setTimeout(function () {
        // Double-check idleness in case socket was torn down
        if (isIdle()) {
          self.emit('idle')
        }
      }, this.idleTimeout)
    }
  } else {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer)
      this._idleTimer = null
    }
  }
}

/**
 * Attempt to send an LDAP request.
 */
Client.prototype._send = function _send (message,
  expect,
  emitter,
  callback,
  _bypass) {
  assert.ok(message)
  assert.ok(expect)
  assert.optionalObject(emitter)
  assert.ok(callback)

  // Allow connect setup traffic to bypass checks
  if (_bypass && this._socket && this._socket.writable) {
    return this._sendSocket(message, expect, emitter, callback)
  }
  if (!this._socket || !this.connected) {
    if (!this.queue.enqueue(message, expect, emitter, callback)) {
      callback(new ConnectionError('connection unavailable'))
    }
    // Initiate reconnect if needed
    if (this.reconnect) {
      this.connect()
    }
    return false
  } else {
    this._flushQueue()
    return this._sendSocket(message, expect, emitter, callback)
  }
}

Client.prototype._sendSocket = function _sendSocket (message,
  expect,
  emitter,
  callback) {
  const conn = this._socket
  const tracker = this._tracker
  const log = this.log
  const self = this
  let timer = false
  let sentEmitter = false

  function sendResult (event, obj) {
    if (event === 'error') {
      self.emit('resultError', obj)
    }
    if (emitter) {
      if (event === 'error') {
        // Error will go unhandled if emitter hasn't been sent via callback.
        // Execute callback with the error instead.
        if (!sentEmitter) { return callback(obj) }
      }
      return emitter.emit(event, obj)
    }

    if (event === 'error') { return callback(obj) }

    return callback(null, obj)
  }

  function messageCallback (msg) {
    if (timer) { clearTimeout(timer) }

    log.trace({ msg: msg ? msg.pojo : null }, 'response received')

    if (expect === 'abandon') { return sendResult('end', null) }

    if (msg instanceof SearchEntry || msg instanceof SearchReference) {
      let event = msg.constructor.name
      // Generate the event name for the event emitter, i.e. "searchEntry"
      // and "searchReference".
      event = (event[0].toLowerCase() + event.slice(1)).replaceAll('Result', '')
      return sendResult(event, msg)
    } else {
      tracker.remove(message.messageId)
      // Potentially mark client as idle
      self._updateIdle()

      if (msg instanceof LDAPResult) {
        if (msg.status !== 0 && expect.indexOf(msg.status) === -1) {
          return sendResult('error', errors.getError(msg))
        }
        return sendResult('end', msg)
      } else if (msg instanceof Error) {
        return sendResult('error', msg)
      } else {
        return sendResult('error', new errors.ProtocolError(msg.type))
      }
    }
  }

  function onRequestTimeout () {
    self.emit('timeout', message)
    const { callback: cb } = tracker.fetch(message.messageId)
    if (cb) {
      // FIXME: the timed-out request should be abandoned
      cb(new errors.TimeoutError('request timeout (client interrupt)'))
    }
  }

  function writeCallback () {
    if (expect === 'abandon') {
      // Mark the messageId specified as abandoned
      tracker.abandon(message.abandonId)
      // No need to track the abandon request itself
      tracker.remove(message.id)
      return callback(null)
    } else if (expect === 'unbind') {
      conn.unbindMessageID = message.id
      // Mark client as disconnected once unbind clears the socket
      self.connected = false
      // Some servers will RST the connection after receiving an unbind.
      // Socket errors are blackholed since the connection is being closed.
      conn.removeAllListeners('error')
      conn.on('error', function () {})
      conn.end()
    } else if (emitter) {
      sentEmitter = true
      callback(null, emitter)
      emitter.emit('searchRequest', message)
      return
    }
    return false
  }

  // Start actually doing something...
  tracker.track(message, messageCallback)
  // Mark client as active
  this._updateIdle(true)

  if (self.timeout) {
    log.trace('Setting timeout to %d', self.timeout)
    timer = setTimeout(onRequestTimeout, self.timeout)
  }

  log.trace('sending request %j', message.pojo)

  try {
    const messageBer = message.toBer()
    return conn.write(messageBer.buffer, writeCallback)
  } catch (e) {
    if (timer) { clearTimeout(timer) }

    log.trace({ err: e }, 'Error writing message to socket')
    return callback(e)
  }
}

Client.prototype.emitError = function emitError (event, err) {
  if (event !== 'error' && err && this.listenerCount(event) === 0) {
    if (typeof err === 'string') {
      err = event + ': ' + err
    } else if (err.message) {
      err.message = event + ': ' + err.message
    }
    this.emit('error', err)
  }
  this.emit(event, err)
}

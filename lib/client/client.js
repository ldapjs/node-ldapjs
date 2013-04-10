// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var EventEmitter = require('events').EventEmitter;
var net = require('net');
var tls = require('tls');
var util = require('util');

var assert = require('assert-plus');

var Attribute = require('../attribute');
var Change = require('../change');
var Control = require('../controls/index').Control;
var PagedResultsControl = require('../controls/index').PagedResultsControl;
var Protocol = require('../protocol');
var dn = require('../dn');
var errors = require('../errors');
var filters = require('../filters');
var messages = require('../messages');
var url = require('../url');



///--- Globals

var AbandonRequest = messages.AbandonRequest;
var AddRequest = messages.AddRequest;
var BindRequest = messages.BindRequest;
var CompareRequest = messages.CompareRequest;
var DeleteRequest = messages.DeleteRequest;
var ExtendedRequest = messages.ExtendedRequest;
var ModifyRequest = messages.ModifyRequest;
var ModifyDNRequest = messages.ModifyDNRequest;
var SearchRequest = messages.SearchRequest;
var UnbindRequest = messages.UnbindRequest;
var UnbindResponse = messages.UnbindResponse;

var LDAPResult = messages.LDAPResult;
var SearchEntry = messages.SearchEntry;
var SearchReference = messages.SearchReference;
var SearchResponse = messages.SearchResponse;
var Parser = messages.Parser;

var Filter = filters.Filter;
var PresenceFilter = filters.PresenceFilter;

var ConnectionError = errors.ConnectionError;

var CMP_EXPECT = [errors.LDAP_COMPARE_TRUE, errors.LDAP_COMPARE_FALSE];
var MAX_MSGID = Math.pow(2, 31) - 1;

// node 0.6 got rid of FDs, so make up a client id for logging
var CLIENT_ID = 0;



///--- Internal Helpers

function nextClientId() {
  if (++CLIENT_ID === MAX_MSGID)
    return 1;

  return CLIENT_ID;
}

function validateControls(controls) {
  if (Array.isArray(controls)) {
    controls.forEach(function (c) {
      if (!(c instanceof Control))
        throw new TypeError('controls must be [Control]');
    });
  } else if (controls instanceof Control) {
    controls = [controls];
  } else {
    throw new TypeError('controls must be [Control]');
  }

  return controls;
}


function setupSocket(socket, opts) {
  var log = opts.log;

  socket.ldap = {
    id: opts.url ? opts.url.href : opts.socketPath,
    messageID: 0,
    messages: {},
    getNextMessageID: function getNextMessageID() {
      if (++socket.ldap.messageID >= MAX_MSGID)
        socket.ldap.messageID = 1;

      return socket.ldap.messageID;
    },
    parser: new Parser({
      log: log
    })
  };

  // This won't be set on TLS. So. Very. Annoying.
  if (typeof (socket.setKeepAlive) !== 'function') {
    socket.setKeepAlive = function setKeepAlive(enable, delay) {
      return socket.socket ? socket.socket.setKeepAlive(enable, delay) : false;
    };
  }

  // On close we have to walk the outstanding messages and go invoke their
  // callback with an error
  socket.on('close', function onClose(had_err) {
    socket.removeAllListeners('connect');
    socket.removeAllListeners('close');
    socket.removeAllListeners('data');
    socket.removeAllListeners('drain');
    socket.removeAllListeners('end');
    socket.removeAllListeners('error');
    socket.removeAllListeners('timeout');

    if (log.trace())
      log.trace('close event had_err=%s', had_err ? 'yes' : 'no');

    opts.emit('close', had_err);
    Object.keys(socket.ldap.messages).forEach(function (msgid) {
      var err;
      if (socket.unbindMessageID !== parseInt(msgid, 10)) {
        err = new ConnectionError(socket.ldap.id + ' closed');
      } else {
        err = new UnbindResponse({
          messageID: msgid
        });
        err.status = 'unbind';
      }

      if (typeof (socket.ldap.messages[msgid]) === 'function') {
        var callback = socket.ldap.messages[msgid];
        delete socket.ldap.messages[msgid];
        return callback(err);
      } else if (socket.ldap.messages[msgid]) {
        if (err instanceof Error)
          socket.ldap.messages[msgid].emit('error', err);
        delete socket.ldap.messages[msgid];
      }

      delete socket.ldap.parser;
      delete socket.ldap;
      return false;
    });
  });

  socket.on('data', function onData(data) {
    if (log.trace())
      log.trace('data event: %s', util.inspect(data));

    socket.ldap.parser.write(data);
  });

  socket.on('end', function onEnd() {
    if (log.trace())
      log.trace('end event');

    opts.emit('end');
    socket.end();
  });

  socket.on('error', function onError(err) {
    if (log.trace())
      log.trace({err: err}, 'error event: %s', new Error().stack);

    if (opts.listeners('error').length)
      opts.emit('error', err);

    socket.end();
  });

  socket.on('timeout', function onTimeout() {
    if (log.trace())
      log.trace('timeout event');

    opts.emit('socketTimeout');
    socket.end();
  });

  // The "router"
  socket.ldap.parser.on('message', function onMessage(message) {
    message.connection = socket;
    var callback = socket.ldap.messages[message.messageID];

    if (!callback) {
      log.error({message: message.json}, 'unsolicited message');
      return false;
    }

    return callback(message);
  });

  socket.ldap.parser.on('error', function onParseError(err) {
    log.trace({err: err}, 'parser error event');

    if (opts.listeners('error').length)
      opts.emit('error', err);

    socket.end();
  });
}



///--- API

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
function Client(options) {
  assert.ok(options);

  EventEmitter.call(this, options);

  var _url;
  if (options.url)
    _url = url.parse(options.url);

  this.connectTimeout = parseInt((options.connectTimeout || 0), 10);
  this.host = _url ? _url.hostname : undefined;
  this.log = options.log.child({clazz: 'Client'}, true);
  this.port = _url ? _url.port : false;
  this.secure = _url ? _url.secure : false;
  this.tlsOptions = options.tlsOptions;
  this.socketPath = options.socketPath || false;
  this.timeout = parseInt((options.timeout || 0), 10);
  this.url = _url;

  this.socket = this._connect();
}
util.inherits(Client, EventEmitter);
module.exports = Client;


/**
 * Sends an abandon request to the LDAP server.
 *
 * The callback will be invoked as soon as the data is flushed out to the
 * network, as there is never a response from abandon.
 *
 * @param {Number} messageID the messageID to abandon.
 * @param {Control} controls (optional) either a Control or [Control].
 * @param {Function} callback of the form f(err).
 * @throws {TypeError} on invalid input.
 */
Client.prototype.abandon = function abandon(messageID, controls, callback) {
  assert.number(messageID, 'messageID');
  if (typeof (controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    controls = validateControls(controls);
  }
  assert.func(callback, 'callback');

  var req = new AbandonRequest({
    abandonID: messageID,
    controls: controls
  });

  return this._send(req, 'abandon', null, callback);
};


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
Client.prototype.add = function add(name, entry, controls, callback) {
  assert.string(name, 'name');
  assert.object(entry, 'entry');
  if (typeof (controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    controls = validateControls(controls);
  }
  assert.func(callback, 'callback');

  if (Array.isArray(entry)) {
    entry.forEach(function (a) {
      if (!Attribute.isAttribute(a))
        throw new TypeError('entry must be an Array of Attributes');
    });
  } else {
    var save = entry;

    entry = [];
    Object.keys(save).forEach(function (k) {
      var attr = new Attribute({type: k});
      if (Array.isArray(save[k])) {
        save[k].forEach(function (v) {
          attr.addValue(v.toString());
        });
      } else {
        attr.addValue(save[k].toString());
      }
      entry.push(attr);
    });
  }

  var req = new AddRequest({
    entry: dn.parse(name),
    attributes: entry,
    controls: controls
  });

  return this._send(req, [errors.LDAP_SUCCESS], null, callback);
};


/**
 * Performs a simple authentication against the server.
 *
 * @param {String} name the DN to bind as.
 * @param {String} credentials the userPassword associated with name.
 * @param {Control} controls (optional) either a Control or [Control].
 * @param {Function} callback of the form f(err, res).
 * @throws {TypeError} on invalid input.
 */
Client.prototype.bind = function bind(name, credentials, controls, callback) {
  if (typeof (name) !== 'string' && !(name instanceof dn.DN))
    throw new TypeError('name (string) required');
  assert.string(credentials, 'credentials');
  if (typeof (controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    controls = validateControls(controls);
  }
  assert.func(callback, 'callback');

  var req = new BindRequest({
    name: name || '',
    authentication: 'Simple',
    credentials: credentials || '',
    controls: controls
  });

  return this._send(req, [errors.LDAP_SUCCESS], null, callback);
};


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
Client.prototype.compare = function compare(name,
                                            attr,
                                            value,
                                            controls,
                                            callback) {
  assert.string(name, 'name');
  assert.string(attr, 'attr');
  assert.string(value, 'value');
  if (typeof (controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    controls = validateControls(controls);
  }
  assert.func(callback, 'callback');

  var req = new CompareRequest({
    entry: dn.parse(name),
    attribute: attr,
    value: value,
    controls: controls
  });

  return this._send(req, CMP_EXPECT, null, function (err, res) {
    if (err)
      return callback(err);

    return callback(null, (res.status === errors.LDAP_COMPARE_TRUE), res);
  });
};


/**
 * Deletes an entry from the LDAP server.
 *
 * @param {String} name the DN of the entry to delete.
 * @param {Control} controls (optional) either a Control or [Control].
 * @param {Function} callback of the form f(err, res).
 * @throws {TypeError} on invalid input.
 */
Client.prototype.del = function del(name, controls, callback) {
  assert.string(name, 'name');
  if (typeof (controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    controls = validateControls(controls);
  }
  assert.func(callback, 'callback');

  var req = new DeleteRequest({
    entry: dn.parse(name),
    controls: controls
  });

  return this._send(req, [errors.LDAP_SUCCESS], null, callback);
};


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
Client.prototype.exop = function exop(name, value, controls, callback) {
  assert.string(name, 'name');
  if (typeof (value) === 'function') {
    callback = value;
    controls = [];
    value = '';
  }
  if (typeof (value) !== 'string')
    throw new TypeError('value (string) required');
  if (typeof (controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    controls = validateControls(controls);
  }
  assert.func(callback, 'callback');

  var req = new ExtendedRequest({
    requestName: name,
    requestValue: value,
    controls: controls
  });

  return this._send(req, [errors.LDAP_SUCCESS], null, function (err, res) {
    if (err)
      return callback(err);

    return callback(null, res.responseValue || '', res);
  });
};


/**
 * Performs an LDAP modify against the server.
 *
 * @param {String} name the DN of the entry to modify.
 * @param {Change} change update to perform (can be [Change]).
 * @param {Control} controls (optional) either a Control or [Control].
 * @param {Function} callback of the form f(err, res).
 * @throws {TypeError} on invalid input.
 */
Client.prototype.modify = function modify(name, change, controls, callback) {
  assert.string(name, 'name');
  assert.object(change, 'change');

  var changes = [];

  function changeFromObject(change) {
    if (!change.operation && !change.type)
      throw new Error('change.operation required');
    if (typeof (change.modification) !== 'object')
      throw new Error('change.modification (object) required');

    Object.keys(change.modification).forEach(function (k) {
      var mod = {};
      mod[k] = change.modification[k];
      changes.push(new Change({
        operation: change.operation || change.type,
        modification: mod
      }));
    });
  }

  if (change instanceof Change) {
    changes.push(change);
  } else if (Array.isArray(change)) {
    change.forEach(function (c) {
      if (c instanceof Change) {
        changes.push(c);
      } else {
        changeFromObject(c);
      }
    });
  } else {
    changeFromObject(change);
  }

  if (typeof (controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    controls = validateControls(controls);
  }
  assert.func(callback, 'callback');

  var req = new ModifyRequest({
    object: dn.parse(name),
    changes: changes,
    controls: controls
  });

  return this._send(req, [errors.LDAP_SUCCESS], null, callback);
};


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
Client.prototype.modifyDN = function modifyDN(name,
                                              newName,
                                              controls,
                                              callback) {
  if (typeof (name) !== 'string')
    throw new TypeError('name (string) required');
  if (typeof (newName) !== 'string')
    throw new TypeError('newName (string) required');
  if (typeof (controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    controls = validateControls(controls);
  }
  if (typeof (callback) !== 'function')
    throw new TypeError('callback (function) required');

  var DN = dn.parse(name);
  var newDN = dn.parse(newName);

  var req = new ModifyDNRequest({
    entry: DN,
    deleteOldRdn: true,
    controls: controls
  });

  if (newDN.length !== 1) {
    req.newRdn = dn.parse(newDN.rdns.shift().toString());
    req.newSuperior = newDN;
  } else {
    req.newRdn = newDN;
  }

  return this._send(req, [errors.LDAP_SUCCESS], null, callback);
};


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
Client.prototype.search = function search(base, options, controls, callback) {
  if (typeof (base) !== 'string' && !(base instanceof dn.DN))
    throw new TypeError('base (string) required');
  if (Array.isArray(options) || (options instanceof Control)) {
    controls = options;
    options = {};
  } else if (typeof (options) === 'function') {
    callback = options;
    controls = [];
    options = {
      filter: new PresenceFilter({attribute: 'objectclass'})
    };
  } else if (typeof (options) === 'string') {
    options = {filter: filters.parseString(options)};
  } else if (typeof (options) !== 'object') {
    throw new TypeError('options (object) required');
  }
  if (typeof (options.filter) === 'string') {
    options.filter = filters.parseString(options.filter);
  } else if (!options.filter) {
    options.filter = new PresenceFilter({attribute: 'objectclass'});
  } else if (!(options.filter instanceof Filter)) {
    throw new TypeError('options.filter (Filter) required');
  }

  if (typeof (controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    controls = validateControls(controls);
  }
  if (typeof (callback) !== 'function')
    throw new TypeError('callback (function) required');

  if (options.attributes) {
    if (!Array.isArray(options.attributes)) {
      if (typeof (options.attributes) === 'string') {
        options.attributes = [options.attributes];
      } else {
        throw new TypeError('options.attributes must be an Array of Strings');
      }
    }
  }

  var req = new SearchRequest({
    baseObject: typeof (base) === 'string' ? dn.parse(base) : base,
    scope: options.scope || 'base',
    filter: options.filter,
    derefAliases: Protocol.NEVER_DEREF_ALIASES,
    sizeLimit: options.sizeLimit || 0,
    timeLimit: options.timeLimit || 10,
    typesOnly: options.typesOnly || false,
    attributes: options.attributes || [],
    controls: controls
  });

  return this._send(req, [errors.LDAP_SUCCESS], new EventEmitter(), callback);
};


/**
 * Unbinds this client from the LDAP server.
 *
 * Note that unbind does not have a response, so this callback is actually
 * optional; either way, the client is disconnected.
 *
 * @param {Function} callback of the form f(err).
 * @throws {TypeError} if you pass in callback as not a function.
 */
Client.prototype.unbind = function unbind(callback) {
  if (!callback)
    callback = function () {};

  if (typeof (callback) !== 'function')
    throw new TypeError('callback must be a function');

  if (!this.socket)
    return callback();

  var req = new UnbindRequest();
  if (this.socket.listeners('error').length === 0) {
    this.socket.once('error', function(){});
  }
  return this._send(req, 'unbind', null, callback);
};



///--- Private API

Client.prototype._connect = function _connect() {
  var log = this.log;
  var proto = this.secure ? tls : net;
  var self = this;
  var socket = null;
  var timer = false;

  function onConnect() {
        if (timer)
      clearTimeout(timer);

    socket.removeListener('connect', onConnect);
    socket.removeListener('secureConnect', onConnect);
    assert.ok(socket.ldap);

    socket.ldap.id = nextClientId() + '__' + socket.ldap.id;
    self.log = self.log.child({ldap_id: socket.ldap.id}, true);

    log.trace('connect event');

    self.socket = socket;
    self.emit('connect', socket);
  }

  socket = proto.connect((this.port || this.socketPath), this.host, this.secure ? this.tlsOptions : null);

  socket.once('connect', onConnect);
  socket.once('secureConnect', onConnect);
  setupSocket(socket, this);

  if (this.connectTimeout) {
    timer = setTimeout(function onConnectTimeout() {
      if (!socket || !socket.readable || !socket.writeable) {
        socket.destroy();

        self.emit('connectTimeout');
      }
    }, this.connectTimeout);
  }

  return socket;
};


Client.prototype._send = function _send(message, expect, emitter, callback) {
  assert.ok(message);
  assert.ok(expect);
  assert.ok(typeof (emitter) !== undefined);
  assert.ok(callback);

  var conn = this.socket;
  var log = this.log;
  var self = this;
  var timer = false;

  if (!conn)
    return callback(new ConnectionError('no socket'));

  function _done(event, obj) {
    if (emitter) {
      if (event === 'error')
        emitter.removeAllListeners('end');
      if (event === 'end')
        emitter.removeAllListeners('error');

      return emitter.emit(event, obj);
    }

    if (event === 'error')
      return callback(obj);

    return callback(null, obj);
  } // end function _done(event, obj)

  function _continuePagedSearch(msg) {
    // this function looks for a paged control in the response msg
    // and continue searching or not according to RFC 2696:
    // http://www.ietf.org/rfc/rfc2696.txt
    if (Array.isArray(msg.controls) && msg.controls.length > 0) {
      log.trace('message has %d controls', msg.controls.length);

      for (var i = 0; i < msg.controls.length; i++) {
        var resControl = msg.controls[i];

        // check paged control in response
        if (resControl instanceof PagedResultsControl) {
          log.debug('paged search: end of page');
          if (resControl.value.cookie && resControl.value.cookie.length > 0) {
            log.trace('paged search: received cookie in response');

            if (Array.isArray(message.controls) &&
                message.controls.length > 0) {
              for (var j = 0; j < message.controls.length; j++) {
                var reqControl = message.controls[j];

                if (reqControl instanceof PagedResultsControl) {
                  // update request cookie and re-send
                  reqControl.value.cookie = resControl.value.cookie;

                  try {
                    log.debug('paged search: continuing');
                    conn.write(message.toBer());
                    return true;
                  } catch (e) {
                    if (timer)
                      clearTimeout(timer);

                    log.trace({err: e}, 'Error writing message to socket');
                    callback(e);
                    return false;
                  }
                }
              }
            }
          } else {
            log.debug('paged search done');
          }
        }
      }
    }

    // not a paged search or all pages received
    return false;
  } // end function _continuePagedSearch(msg)

  function messageCallback(msg) {
    if (timer)
      clearTimeout(timer);

    if (log.trace())
      log.trace({msg: msg ? msg.json : null}, 'response received');

    if (expect === 'abandon')
      return _done('end', null);

    if (msg instanceof SearchEntry || msg instanceof SearchReference) {
      var event = msg.constructor.name;
      event = event[0].toLowerCase() + event.slice(1);
      return _done(event, msg);
    } else if (_continuePagedSearch(msg)) {
      // page search continued, just return for now
      return undefined;
    } else {
      delete conn.ldap.messages[message.messageID];

      if (msg instanceof LDAPResult) {
        if (expect.indexOf(msg.status) === -1)
          return _done('error', errors.getError(msg));

        return _done('end', msg);
      } else if (msg instanceof Error) {
        return _done('error', msg);
      } else {
        return _done('error', new errors.ProtocolError(msg.type));
      }
    }
  } // end function messageCallback(msg)

  function onRequestTimeout() {
    self.emit('timeout', message);
    if (conn.ldap.messages[message.messageID]) {
      conn.ldap.messages[message.messageID](new LDAPResult({
        status: 80, // LDAP_OTHER
        errorMessage: 'request timeout (client interrupt)'
      }));
    }
  } // end function onRequestTimeout()

  function writeCallback() {
    if (expect === 'abandon') {
      return callback(null);
    } else if (expect === 'unbind') {
      conn.unbindMessageID = message.id;
      conn.end();
    } else if (emitter) {
      return callback(null, emitter);
    }
    return false;
  } // end writeCallback()

  // Start actually doing something...
  message.messageID = conn.ldap.getNextMessageID();
  conn.ldap.messages[message.messageID] = messageCallback;

  if (self.timeout) {
    log.trace('Setting timeout to %d', self.timeout);
    timer = setTimeout(onRequestTimeout, self.timeout);
  }

  if (log.trace())
    log.trace('sending request %j', message.json);

  try {
    return conn.write(message.toBer(), writeCallback);
  } catch (e) {
    if (timer)
      clearTimeout(timer);

    log.trace({err: e}, 'Error writing message to socket');
    return callback(e);
  }
};

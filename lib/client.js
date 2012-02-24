// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var net = require('net');
var tls = require('tls');
var util = require('util');

var Attribute = require('./attribute');
var Change = require('./change');
var Control = require('./controls/index').Control;
var Protocol = require('./protocol');
var dn = require('./dn');
var errors = require('./errors');
var filters = require('./filters');
var messages = require('./messages');
var url = require('./url');



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

var CMP_EXPECT = [errors.LDAP_COMPARE_TRUE, errors.LDAP_COMPARE_FALSE];
var MAX_MSGID = Math.pow(2, 31) - 1;



///--- Internal Helpers

function xor() {
  var b = false;
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] && !b) {
      b = true;
    } else if (arguments[i] && b) {
      return false;
    }
  }
  return b;
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


function ConnectionError(message) {
  errors.LDAPError.call(this,
                        'ConnectionError',
                        0x80, // LDAP_OTHER,
                        message,
                        null,
                        ConnectionError);
}
util.inherits(ConnectionError, errors.LDAPError);



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
  if (!options || typeof (options) !== 'object')
    throw new TypeError('options (object) required');
  if (options.url && typeof (options.url) !== 'string')
    throw new TypeError('options.url (string) required');
  if (options.socketPath && typeof (options.socketPath) !== 'string')
    throw new TypeError('options.socketPath must be a string');
  if (typeof (options.log) !== 'object')
    throw new TypeError('options.log must be an object');

  if (!xor(options.url, options.socketPath))
    throw new TypeError('options.url ^ options.socketPath (String) required');

  EventEmitter.call(this, options);

  var parsedUrl;
  if (options.url)
    parsedUrl = url.parse(options.url);

  this.connection = null;
  this.connectTimeout = options.connectTimeout || false;
  this.connectOptions = {
    port: parsedUrl ? parsedUrl.port : options.socketPath,
    host: parsedUrl ? parsedUrl.hostname : undefined,
    socketPath: options.socketPath || undefined
  };
  this.log = options.log;
  this.secure = parsedUrl ? parsedUrl.secure : false;
  this.timeout = options.timeout || false;
  this.url = parsedUrl || false;

  // We'll emit a connect event when this is done
  this.connect();
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
  if (typeof (messageID) !== 'number')
    throw new TypeError('messageID (number) required');
  if (typeof (controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    controls = validateControls(controls);
  }
  if (typeof (callback) !== 'function')
    throw new TypeError('callback (function) required');

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
  if (typeof (name) !== 'string')
    throw new TypeError('name (string) required');
  if (typeof (entry) !== 'object')
    throw new TypeError('entry (object) required');
  if (typeof (controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    controls = validateControls(controls);
  }
  if (typeof (callback) !== 'function')
    throw new TypeError('callback (function) required');

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
  if (typeof (credentials) !== 'string')
    throw new TypeError('credentials (string) required');
  if (typeof (controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    controls = validateControls(controls);
  }
  if (typeof (callback) !== 'function')
    throw new TypeError('callback (function) required');

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
  if (typeof (name) !== 'string')
    throw new TypeError('name (string) required');
  if (typeof (attr) !== 'string')
    throw new TypeError('attribute (string) required');
  if (typeof (value) !== 'string')
    throw new TypeError('value (string) required');
  if (typeof (controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    controls = validateControls(controls);
  }
  if (typeof (callback) !== 'function')
    throw new TypeError('callback (function) required');

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
  if (typeof (name) !== 'string')
    throw new TypeError('name (string) required');
  if (typeof (controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    controls = validateControls(controls);
  }
  if (typeof (callback) !== 'function')
    throw new TypeError('callback (function) required');

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
  if (typeof (name) !== 'string')
    throw new TypeError('name (string) required');
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
  if (typeof (callback) !== 'function')
    throw new TypeError('callback (function) required');

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
  if (typeof (name) !== 'string')
    throw new TypeError('name (string) required');
  if (typeof (change) !== 'object')
    throw new TypeError('change (Change) required');

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
  if (typeof (callback) !== 'function')
    throw new TypeError('callback (function) required');

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

  if (!this.connection)
    return callback();

  var req = new UnbindRequest();
  return this._send(req, 'unbind', null, callback);
};


/**
 * Connects this client, either at construct time, or after an unbind has
 * been called. Under normal circumstances you don't need to call this method.
 *
 * @param {Function} (optional) callback invoked when `connect` is emitted.
 */
Client.prototype.connect = function connect(callback) {
  var c = null;
  var log = this.log;
  var opts = this.connectOptions;
  var proto = this.secure ? tls : net;
  var self = this;
  var timer = false;

  c = proto.connect(opts.port, opts.host);

  if (this.connectTimeout) {
    timer = setTimeout(function () {
      c.destroy();

      self.emit('connectTimeout', new ConnectionError('timeout'));
    }, this.connectTimeout);
  }

  if (typeof (c.setKeepAlive) !== 'function') {
    c.setKeepAlive = function setKeepAlive(enable, delay) {
      return c.socket ? c.socket.setKeepAlive(enable, delay) : false;
    };
  }

  c.ldap = {
    id: self.url ? self.url.href : opts.socketPath,
    messageID: 0,
    messages: {},
    get nextMessageID() {
      if (++c.ldap.messageID >= MAX_MSGID)
        c.ldap.messageID = 1;

      return c.ldap.messageID;
    },
    parser: new Parser({
      log: self.log
    })
  };

  c.on('connect', function () {
    if (timer)
      clearTimeout(timer);

    assert.ok(c.ldap);

    c.ldap.id += c.fd ? (':' + c.fd) : '';

    if (log.trace())
      log.trace('%s connect event', c.ldap.id);

    self.connection = c;
    self.emit('connect', c);

    return (typeof (callback) === 'function' ? callback(null, c) : false);
  });

  c.on('end', function () {
    if (log.trace())
      log.trace('%s end event', c.ldap.id);

    c.end();
  });

  // On close we have to walk the outstanding messages and go invoke their
  // callback with an error
  c.on('close', function (had_err) {
    if (log.trace())
      log.trace('%s close event had_err=%s', c.ldap.id, had_err ? 'yes' : 'no');

    Object.keys(c.ldap.messages).forEach(function (msgid) {
      var err;
      if (c.unbindMessageID !== parseInt(msgid, 10)) {
        err = new ConnectionError(c.ldap.id + ' closed');
      } else {
        err = new UnbindResponse({
          messageID: msgid
        });
        err.status = 'unbind';
      }

      if (typeof (c.ldap.messages[msgid]) === 'function') {
        var callback = c.ldap.messages[msgid];
        delete c.ldap.messages[msgid];
        return callback(err);
      } else if (c.ldap.messages[msgid]) {
        if (err instanceof Error)
          c.ldap.messages[msgid].emit('error', err);
        delete c.ldap.messages[msgid];
      }

      delete c.ldap.parser;
      delete c.ldap;
      return false;
    });
  });

  c.on('error', function (err) {
    if (log.trace())
      log.trace({err: err}, '%s error event', c.ldap.id);

    if (self.listeners('error').length)
      self.emit('error', err);

    c.end();
  });

  c.on('timeout', function () {
    if (log.trace())
      log.trace('%s timeout event=%s', c.ldap.id);

    self.emit('timeout');
    c.end();
  });

  c.on('data', function (data) {
    if (log.trace())
      log.trace('%s data event: %s', c.ldap.id, util.inspect(data));

    c.ldap.parser.write(data);
  });

  // The "router"
  c.ldap.parser.on('message', function (message) {
    message.connection = c;
    var callback = c.ldap.messages[message.messageID];

    if (!callback) {
      log.error({message: message.json}, '%s: unsolicited message', c.ldap.id);
      return false;
    }

    return callback(message);
  });

  c.ldap.parser.on('error', function (err) {
    log.debug({err: err}, '%s parser error event', c.ldap.id, err);

    if (self.listeners('error').length)
      self.emit('error', err);

    c.end();
  });

  return c;
};


Client.prototype._send = function _send(message, expect, emitter, callback) {
  assert.ok(message);
  assert.ok(expect);
  assert.ok(typeof (emitter) !== undefined);
  assert.ok(callback);

  var conn = this.connection;
  var self = this;
  var timer = false;

  if (!conn)
    return callback(new ConnectionError('no socket'));

  message.messageID = conn.ldap.nextMessageID;
  conn.ldap.messages[message.messageID] = function messageCallback(res) {
    if (timer)
      clearTimeout(timer);

    if (expect === 'abandon')
      return callback(null);

    if (self.log.debug())
      self.log.debug({res: res.json}, '%s: response received', conn.ldap.id);

    var err = null;

    if (res instanceof LDAPResult) {
      delete conn.ldap.messages[message.messageID];

      if (expect.indexOf(res.status) === -1) {
        err = errors.getError(res);
        if (emitter)
          return emitter.emit('error', err);

        return callback(err);
      }

      if (emitter)
        return emitter.emit('end', res);

      return callback(null, res);
    } else if (res instanceof SearchEntry || res instanceof SearchReference) {
      assert.ok(emitter);
      var event = res.constructor.name;
      event = event[0].toLowerCase() + event.slice(1);
      return emitter.emit(event, res);
    } else if (res instanceof Error) {
      if (emitter)
        return emitter.emit('error', res);

      return callback(res);
    }

    delete conn.ldap.messages[message.messageID];
    err = new errors.ProtocolError(res.type);

    if (emitter)
      return emitter.emit('error', err);

    return callback(err);
  };

  // If there's a user specified timeout, pick that up
  if (this.timeout) {
    timer = setTimeout(function () {
      self.emit('timeout', message);
      if (conn.ldap.messages[message.messageID]) {
        conn.ldap.messages[message.messageID](new LDAPResult({
          status: 80, // LDAP_OTHER
          errorMessage: 'request timeout (client interrupt)'
        }));
      }
    }, this.timeout);
  }

  try {
    // Finally send some data
    if (this.log.debug())
      this.log.debug({msg: message.json}, '%s: sending request', conn.ldap.id);

    return conn.write(message.toBer(), function writeCallback() {
      if (expect === 'abandon') {
        return callback(null);
      } else if (expect === 'unbind') {
        conn.unbindMessageID = message.id;
        conn.end();
      } else if (emitter) {
        return callback(null, emitter);
      }
      return false;
    });

  } catch (e) {
    if (timer)
      clearTimeout(timer);

    conn.destroy();
    delete self.connection;
    return callback(e);
  }
};

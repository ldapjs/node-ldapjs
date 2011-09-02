// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var net = require('net');
var tls = require('tls');
var util = require('util');

var Attribute = require('./attribute');
var Change = require('./change');
var Control = require('./control');
var Protocol = require('./protocol');
var dn = require('./dn');
var errors = require('./errors');
var filters = require('./filters');
var logStub = require('./log_stub');
var messages = require('./messages');
var url = require('./url');



///--- Globals

var AddRequest = messages.AddRequest;
var BindRequest = messages.BindRequest;
var CompareRequest = messages.CompareRequest;
var DeleteRequest = messages.DeleteRequest;
var ExtendedRequest = messages.ExtendedRequest;
var ModifyRequest = messages.ModifyRequest;
var ModifyDNRequest = messages.ModifyDNRequest;
var SearchRequest = messages.SearchRequest;
var UnbindRequest = messages.UnbindRequest;

var LDAPResult = messages.LDAPResult;
var SearchEntry = messages.SearchEntry;
var SearchResponse = messages.SearchResponse;
var Parser = messages.Parser;


var Filter = filters.Filter;
var PresenceFilter = filters.PresenceFilter;


var MAX_MSGID = Math.pow(2, 31) - 1;



///--- Internal Helpers

function xor() {
  var b = false;
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] && !b) b = true;
    else if (arguments[i] && b) return false;
  }
  return b;
}


function validateControls(controls) {
  if (Array.isArray(controls)) {
    controls.forEach(function(c) {
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


function DisconnectedError(message) {
  Error.call(this, message);

  if (Error.captureStackTrace)
    Error.captureStackTrace(this, DisconnectedError);
}
util.inherits(DisconnectedError, Error);

///--- API

/**
 * Constructs a new client.
 *
 * The options object is required, and must contain either a URL (string) or
 * a socketPath (string); the socketPath is only if you want to talk to an LDAP
 * server over a Unix Domain Socket.  Additionally, you can pass in a log4js
 * option that is the result of `require('log4js')`, presumably after you've
 * configured it.
 *
 * @param {Object} options must have either url or socketPath.
 * @throws {TypeError} on bad input.
 */
function Client(options) {
  if (!options || typeof(options) !== 'object')
    throw new TypeError('options (object) required');
  if (options.url && typeof(options.url) !== 'string')
    throw new TypeError('options.url (string) required');
  if (options.socketPath && typeof(options.socketPath) !== 'string')
    throw new TypeError('options.socketPath must be a string');
  if (options.log4js && typeof(options.log4js) !== 'object')
    throw new TypeError('options.log4s must be an object');

  if (!xor(options.url, options.socketPath))
    throw new TypeError('options.url ^ options.socketPath required');

  EventEmitter.call(this, options);

  var self = this;
  this.secure = false;
  if (options.url) {
    this.url = url.parse(options.url);
    this.secure = this.url.secure;
  }

  this.log4js = options.log4js || logStub;
  this.connectOptions = {
    port: self.url ? self.url.port : options.socketPath,
    host: self.url ? self.url.hostname : undefined
  };
  this.shutdown = false;

  this.__defineGetter__('log', function() {
    if (!self._log)
      self._log = self.log4js.getLogger('Client');

    return self._log;
  });

  // Build the connection pool
  function newConnection() {
    var c;
    if (self.secure) {
      c = tls.connect(self.connectOptions.port, self.connectOptions.host);
    } else {
      c = net.createConnection(self.connectOptions.port,
                               self.connectOptions.host);
    }
    assert.ok(c);

    c.parser = new Parser({
      log4js: self.log4js
    });

    // Wrap the events
    c.ldap = {
      id: options.socketPath || self.url.hostname,
      connected: true, // lie, but node queues for us
      messageID: 0,
      messages: {}
    };
    c.ldap.__defineGetter__('nextMessageID', function() {
      if (++c.ldap.messageID >= MAX_MSGID)
        c.ldap.messageID = 1;
      return c.ldap.messageID;
    });
    c.on('connect', function() {
      c.ldap.connected = true;
      c.ldap.id += ':' + (c.type !== 'unix' ? c.remotePort : c.fd);
      self.emit('connect', c.ldap.id);
    });
    c.on('end', function() {
      self.emit('end');
    });
    c.addListener('close', function(had_err) {
      self.emit('close', had_err);
    });
    c.on('error', function(err) {
      self.emit('error', err);
    });
    c.on('timeout', function() {
      self.emit('timeout');
    });
    c.on('data', function(data) {
      if (self.log.isTraceEnabled())
        self.log.trace('data on %s: %s', c.ldap.id, util.inspect(data));
      c.parser.write(data);
    });

    // The "router"
    c.parser.on('message', function(message) {
      message.connection = c;

      var callback = c.ldap.messages[message.messageID];
      if (!callback) {
        self.log.error('%s: received unsolicited message: %j', c.ldap.id,
                       message.json);
        return;
      }

      return callback(message);
    });
    return c;
  }

  self.connection = newConnection();
}
util.inherits(Client, EventEmitter);
module.exports = Client;


/**
 * Performs a simple authentication against the server.
 *
 * @param {String} name the DN to bind as.
 * @param {String} credentials the userPassword associated with name.
 * @param {Control} controls (optional) either a Control or [Control].
 * @param {Function} callback of the form f(err, res).
 * @throws {TypeError} on invalid input.
 */
Client.prototype.bind = function(name, credentials, controls, callback) {
  if (typeof(name) !== 'string')
    throw new TypeError('name (string) required');
  if (typeof(credentials) !== 'string')
    throw new TypeError('credentials (string) required');
  if (typeof(controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    control = validateControls(controls);
  }
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (function) required');

  var self = this;

  var req = new BindRequest({
    name: dn.parse(name),
    authentication: 'Simple',
    credentials: credentials,
    controls: controls
  });

  return self._send(req, [errors.LDAP_SUCCESS], callback);
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
Client.prototype.add = function(name, entry, controls, callback) {
  if (typeof(name) !== 'string')
    throw new TypeError('name (string) required');
  if (typeof(entry) !== 'object')
    throw new TypeError('entry (object) required');
  if (typeof(controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    control = validateControls(controls);
  }
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (function) required');

  if (Array.isArray(entry)) {
    entry.forEach(function(a) {
      if (!Attribute.isAttribute(a))
        throw new TypeError('entry must be an Array of Attributes');
    });
  } else {
    var save = entry;

    entry = [];
    Object.keys(save).forEach(function(k) {
      var attr = new Attribute({type: k});
      if (Array.isArray(save[k])) {
        save[k].forEach(function(v) {
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

  return this._send(req, [errors.LDAP_SUCCESS], callback);
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
Client.prototype.compare = function(name, attr, value, controls, callback) {
  if (typeof(name) !== 'string')
    throw new TypeError('name (string) required');
  if (typeof(attr) !== 'string')
    throw new TypeError('attribute (string) required');
  if (typeof(value) !== 'string')
    throw new TypeError('value (string) required');
  if (typeof(controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    control = validateControls(controls);
  }
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (function) required');

  var req = new CompareRequest({
    entry: dn.parse(name),
    attribute: attr,
    value: value,
    controls: controls
  });

  function _callback(err, res) {
    if (err)
      return callback(err);

    return callback(null, (res.status === errors.LDAP_COMPARE_TRUE), res);
  }

  return this._send(req,
                    [errors.LDAP_COMPARE_TRUE, errors.LDAP_COMPARE_FALSE],
                    _callback);
};


/**
 * Deletes an entry from the LDAP server.
 *
 * @param {String} name the DN of the entry to delete.
 * @param {Control} controls (optional) either a Control or [Control].
 * @param {Function} callback of the form f(err, res).
 * @throws {TypeError} on invalid input.
 */
Client.prototype.del = function(name, controls, callback) {
  if (typeof(name) !== 'string')
    throw new TypeError('name (string) required');
  if (typeof(controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    control = validateControls(controls);
  }
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (function) required');

  var req = new DeleteRequest({
    entry: dn.parse(name),
    controls: controls
  });

  return this._send(req, [errors.LDAP_SUCCESS], callback);
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
Client.prototype.exop = function(name, value, controls, callback) {
  if (typeof(name) !== 'string')
    throw new TypeError('name (string) required');
  if (typeof(value) === 'function') {
    callback = value;
    controls = [];
    value = '';
  }
  if (typeof(value) !== 'string')
    throw new TypeError('value (string) required');
  if (typeof(controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    control = validateControls(controls);
  }
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (function) required');

  var req = new ExtendedRequest({
    requestName: name,
    requestValue: value,
    controls: controls
  });

  function _callback(err, res) {
    if (err)
      return callback(err);

    return callback(null, res.responseValue || '', res);
  }

  return this._send(req, [errors.LDAP_SUCCESS], _callback);
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
Client.prototype.modify = function(name, change, controls, callback) {
  if (typeof(name) !== 'string')
    throw new TypeError('name (string) required');
  if (!Array.isArray(change) && !(change instanceof Change))
    throw new TypeError('change (Change) required');
  if (!Array.isArray(change)) {
    var save = change;
    change = [];
    change.push(save);
  }
  change.forEach(function(c) {
    if (!(c instanceof Change))
      throw new TypeError('change ([Change]) required');
  });
  if (typeof(controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    control = validateControls(controls);
  }
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (function) required');

  var req = new ModifyRequest({
    object: dn.parse(name),
    changes: change,
    controls: controls
  });

  return this._send(req, [errors.LDAP_SUCCESS], callback);
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
Client.prototype.modifyDN = function(name, newName, controls, callback) {
  if (typeof(name) !== 'string')
    throw new TypeError('name (string) required');
  if (typeof(newName) !== 'string')
    throw new TypeError('newName (string) required');
  if (typeof(controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    control = validateControls(controls);
  }
  if (typeof(callback) !== 'function')
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

  return this._send(req, [errors.LDAP_SUCCESS], callback);
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
Client.prototype.search = function(base, options, controls, callback) {
  if (typeof(base) !== 'string')
    throw new TypeError('base (string) required');
  if (Array.isArray(options) || (options instanceof Control)) {
    controls = options;
    options = {};
  } else if (typeof(options) === 'function') {
    callback = options;
    controls = [];
    options = {
      filter: new PresenceFilter({attribute: 'objectclass'})
    };
  } else if (typeof(options) === 'string') {
    options = {filter: filters.parseString(options)};
  } else if (typeof(options) !== 'object') {
    throw new TypeError('options (object) required');
  }
  if (typeof(options.filter) === 'string') {
    options.filter = filters.parseString(options.filter);
  } else if (!options.filter) {
    options.filter = new PresenceFilter({attribute: 'objectclass'});
  } else if (!(options.filter instanceof Filter)) {
    throw new TypeError('options.filter (Filter) required');
  }

  if (typeof(controls) === 'function') {
    callback = controls;
    controls = [];
  } else {
    control = validateControls(controls);
  }
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (function) required');

  var req = new SearchRequest({
    baseObject: dn.parse(base),
    scope: options.scope || 'base',
    filter: options.filter,
    derefAliases: Protocol.NEVER_DEREF_ALIASES,
    sizeLimit: options.sizeLimit || 0,
    timeLimit: options.timeLimit || 10,
    typesOnly: options.typesOnly || false,
    attributes: options.attributes || []
  });

  var res = new EventEmitter();
  this._send(req, [errors.LDAP_SUCCESS], res);
  return callback(null, res);
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
Client.prototype.unbind = function(callback) {
  if (callback && typeof(callback) !== 'function')
    throw new TypeError('callback must be a function');

  var self = this;

  if (!callback)
    callback = function defUnbindCb() { self.log.trace('disconnected'); };

  var req = new UnbindRequest();
  return self._send(req, 'unbind', callback);
};



Client.prototype._send = function(message, expect, callback) {
  assert.ok(message);
  assert.ok(expect);
  assert.ok(callback);

  var self = this;

  var conn = self.connection;

  // Now set up the callback in the messages table
  message.messageID = conn.ldap.nextMessageID;
  conn.ldap.messages[message.messageID] = function(res) {
    if (self.log.isDebugEnabled())
      self.log.debug('%s: response received: %j', conn.ldap.id, res.json);

    var err = null;
    if (res instanceof LDAPResult) {
      delete conn.ldap.messages[message.messageID];

      if (expect.indexOf(res.status) === -1) {
        err = errors.getError(res);
        if (typeof(callback) === 'function')
          return callback(err);

        return callback.emit('error', err);
      }

      if (typeof(callback) === 'function')
        return callback(null, res);

      callback.emit('end', res);
    } else if (res instanceof SearchEntry) {
      assert.ok(callback instanceof EventEmitter);
      callback.emit('searchEntry', res);
    } else {
      delete conn.ldap.messages[message.messageID];

      err = new errors.ProtocolError(res.type);
      if (typeof(callback) === 'function')
        return callback(err);

      callback.emit('error', err);
    }
  };

  // Finally send some data
  if (this.log.isDebugEnabled())
    this.log.debug('%s: sending request: %j', conn.ldap.id, message.json);

  // Note if this was an unbind, we just go ahead and end, since there
  // will never be a response
  return conn.write(message.toBer(), (expect === 'unbind' ? function() {
    conn.on('end', function() {
      return callback();
    });
    conn.end();
  } : null));
};


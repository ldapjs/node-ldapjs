// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var pooling = require('pooling');

var ConnectionError = require('../errors').ConnectionError;
var BindResponse = require('../messages').BindResponse;

var Client = require('./client');



///--- Globals

var STD_OPS = [
  'add',
  'del',
  'modify',
  'modifyDN'
];

var RETURN_VAL_OPS = [
  'compare',
  'exop'
];



///--- Internal Functions

function createPool(options, clientpool) {
  assert.ok(options);

  return pooling.createPool({
    checkInterval: options.checkInterval,
    log: options.log,
    name: 'ldapjs_' + (options.url || options.socketPath).replace(/[:/]/g, '_'),
    max: options.maxConnections,
    maxIdleTime: options.maxIdleTime,

    create: function createClient(callback) {
      var client = new Client(options);

      client.on('error', function (err) {
        client.removeAllListeners('connect');
        client.removeAllListeners('connectTimeout');
        if (clientpool.listeners('error').length) {
          clientpool.emit('error', err);
        }
        return callback(err);
      });

      client.on('connectTimeout', function () {
        client.removeAllListeners('connect');
        clientpool.emit('connectTimeout');
      });

      client.once('connect', function onConnect() {
        client.removeAllListeners('error');

        if (!options.bindDN || !options.bindCredentials)
          return callback(null, client);

        function bindCallback(err, res) {
          if (err)
            return callback(err, null);

          return callback(null, client);
        }

        return client.bind(options.bindDN,
                           options.bindCredentials,
                           options.bindControls || [],
                           bindCallback);
      });
    },

    check: function check(client, callback) {
      // just do a root dse search
      client.search('', '(objectclass=*)', function (err, res) {
        if (err)
          return callback(err);

        res.on('error', function (e) {
          res.removeAllListeners('end');
          callback(e);
        });

        res.on('end', function () {
          res.removeAllListeners('error');
          callback(null);
        });

        return undefined;
      });
    },

    destroy: function destroy(client) {
      client.unbind(function () {});
    }
  });
}



///--- API

function ClientPool(options) {
  assert.ok(options);
  EventEmitter.call(this, options);

  this.log = options.log.child({clazz: 'ClientPool'}, true);
  this.options = {
    bindDN: options.bindDN,
    bindCredentials: options.bindCredentials,
    bindControls: options.bindControls || [],
    checkInterval: options.checkInterval,
    connectTimeout: (options.connectTimeout || 0),
    maxIdleTime: options.maxIdleTime,
    maxConnections: options.maxConnections,
    log: options.log,
    socketPath: options.socketPath,
    timeout: (options.timeout || 0),
    url: options.url,
    tlsOptions: options.tlsOptions
  };
  this.pool = createPool(options, this);
}
util.inherits(ClientPool, EventEmitter);
module.exports = ClientPool;



STD_OPS.forEach(function (op) {
  ClientPool.prototype[op] = function clientProxy() {
    var args = Array.prototype.slice.call(arguments);
    var cb = args.pop();
    if (typeof (cb) !== 'function')
      throw new TypeError('callback (Function) required');
    var self = this;

    return this.pool.acquire(function onAcquire(err, client) {
      if (err)
        return cb(err);

      args.push(function proxyCallback(err, res) {
        self.pool.release(client);
        return cb(err, res);
      });

      try {
        return Client.prototype[op].apply(client, args);
      } catch (e) {
        self.pool.release(client);
        return cb(e);
      }
    });
  };
});


RETURN_VAL_OPS.forEach(function (op) {
  ClientPool.prototype[op] = function clientProxy() {
    var args = Array.prototype.slice.call(arguments);
    var cb = args.pop();
    if (typeof (cb) !== 'function')
      throw new TypeError('callback (Function) required');
    var self = this;

    return this.pool.acquire(function onAcquire(poolErr, client) {
      if (poolErr)
        return cb(poolErr);

      args.push(function proxyCallback(err, val, res) {
        self.pool.release(client);
        return cb(err, val, res);
      });

      try {
        return Client.prototype[op].apply(client, args);
      } catch (e) {
        self.pool.release(client);
        return cb(e);
      }
    });
  };
});


ClientPool.prototype.search = function search(base, opts, controls, callback) {
  if (typeof (controls) === 'function') {
    callback = controls;
    controls = [];
  }

  var self = this;

  return this.pool.acquire(function onAcquire(err, client) {
    if (err)
      return callback(err);

    // This is largely in existence for search requests
    client.timeout = self.timeout || client.timeout;


    return client.search(base, opts, controls, function (err, res) {
      function cleanup() {
        self.pool.release(client);
      }

      if (err) {
        cleanup();
        return callback(err, res);
      }
      res.on('error', cleanup);
      res.on('end', cleanup);

      return callback(null, res);
    });
  });
};


ClientPool.prototype.abandon = function abandon(msgid, controls, callback) {
  if (typeof (controls) === 'function') {
    callback = controls;
    controls = [];
  }

  this.log.error({
    messageID: msgid
  }, 'Abandon is not supported with connection pooling. Ignoring.');
  return callback(null);
};


ClientPool.prototype.bind = function bind(dn, creds, controls, callback) {
  if (typeof (controls) === 'function') {
    callback = controls;
    controls = [];
  }

  var self = this;

  self.options.bindDN = null;
  self.options.bindCredentials = null;
  self.options.bindControls = null;

  return this.pool.shutdown(function () {
    self.pool = createPool(self.options, self);

    return self.pool.acquire(function onAcquire(err, client) {
      if (err)
        return callback(err);

      return client.bind(dn, creds, controls, function (err, res) {
        self.pool.release(client);

        if (err)
          return callback(err, res);

        self.options.bindDN = dn;
        self.options.bindCredentials = creds;
        self.options.bindControls = controls;

        return callback(null, res);
      });
    });
  });
};


ClientPool.prototype.unbind = function unbind(callback) {
  return this.pool.shutdown(callback);
};

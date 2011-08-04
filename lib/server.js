// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var net = require('net');
var tls = require('tls');
var util = require('util');

var asn1 = require('asn1');
var sprintf = require('sprintf').sprintf;

var dn = require('./dn');
var errors = require('./errors');
var Protocol = require('./protocol');
var logStub = require('./log_stub');

var Parser = require('./messages').Parser;
var AddResponse = require('./messages/add_response');
var BindResponse = require('./messages/bind_response');
var CompareResponse = require('./messages/compare_response');
var DeleteResponse = require('./messages/del_response');
var ExtendedResponse = require('./messages/ext_response');
var ModifyResponse = require('./messages/modify_response');
var ModifyDNResponse = require('./messages/moddn_response');
var SearchResponse = require('./messages/search_response');
var UnbindResponse = require('./messages/unbind_response');



///--- Globals

var Ber = asn1.Ber;
var BerReader = asn1.BerReader;



///--- Helpers

function setupConnection(server, c, config) {
  assert.ok(server);
  assert.ok(c);
  assert.ok(config);

  c.ldap = {
    id: c.remoteAddress + ':' + c.remotePort,
    config: config
  };

  c.addListener('timeout', function() {
    server.log.trace('%s timed out', c.ldap.id);
    c.destroy();
  });
  c.addListener('end', function() {
    server.log.trace('%s shutdown', c.ldap.id);
  });
  c.addListener('error', function(err) {
    server.log.warn('%s unexpected connection error', c.ldap.id, err);
    c.destroy();
  });
  c.addListener('close', function(had_err) {
    server.log.trace('%s close; had_err=%j', c.ldap.id, had_err);
    c.destroy();
  });
  return c;
}


function getResponse(req) {
  assert.ok(req);

  var Response;

  switch (req.protocolOp) {
  case Protocol.LDAP_REQ_BIND:
    Response = BindResponse;
    break;
  case Protocol.LDAP_REQ_ABANDON:
    return; // Noop
  case Protocol.LDAP_REQ_ADD:
    Response = AddResponse;
    break;
  case Protocol.LDAP_REQ_COMPARE:
    Response = CompareResponse;
    break;
  case Protocol.LDAP_REQ_DELETE:
    Response = DeleteResponse;
    break;
  case Protocol.LDAP_REQ_EXTENSION:
    Response = ExtendedResponse;
    break;
  case Protocol.LDAP_REQ_MODIFY:
    Response = ModifyResponse;
    break;
  case Protocol.LDAP_REQ_MODRDN:
    Response = ModifyDNResponse;
    break;
  case Protocol.LDAP_REQ_SEARCH:
    Response = SearchResponse;
    break;
  case Protocol.LDAP_REQ_UNBIND:
    Response = UnbindResponse;
    break;
  default:
    return null;
  }
  assert.ok(Response);

  var res = new Response({
    messageID: req.messageID,
    log4js: req.log4js
  });
  res.connection = req.connection;
  res.logId = req.logId;

  return res;
}


function defaultHandler(req, res, next) {
  assert.ok(req);
  assert.ok(res);
  assert.ok(next);

  res.matchedDN = req.dn.toString();
  res.errorMessage = 'Server method not implemented';
  res.end(errors.LDAP_OTHER);
  return next();
}


function noSuffixHandler(req, res, next) {
  assert.ok(req);
  assert.ok(res);
  assert.ok(next);

  res.errorMessage = 'No tree found for: ' + req.dn.toString();
  res.end(errors.LDAP_NO_SUCH_OBJECT);
  return next();
}


function noExOpHandler(req, res, next) {
  assert.ok(req);
  assert.ok(res);
  assert.ok(next);

  res.errorMessage = req.requestName + ' not supported';
  res.end(errors.LDAP_PROTOCOL_ERROR);
  return next();
}


function getHandlerChain(server, req) {
  assert.ok(server);
  assert.ok(req);

  var backend;
  var handlers;
  var matched = false;
  for (var r in server.routes) {
    if (server.routes.hasOwnProperty(r)) {

      if (req.protocolOp === Protocol.LDAP_REQ_EXTENSION) {
        if (r === req.requestName)
          matched = true;
      } else if (req.protocolOp === Protocol.LDAP_REQ_UNBIND) {
        matched = true;
      } else {
        if (req.dn) {
          if (r === req.dn.toString()) {
            matched = true;
          } else if (server.routes[r]._dn &&
                     server.routes[r]._dn.parentOf(req.dn)) {
            matched = true;
          }
        }
      }
      if (!matched)
        continue;

      switch (req.protocolOp) {
      case Protocol.LDAP_REQ_BIND:
        handlers = server.routes[r]._bind;
        break;

      case Protocol.LDAP_REQ_ABANDON:
        return; // Noop

      case Protocol.LDAP_REQ_ADD:
        handlers = server.routes[r]._add;
        break;

      case Protocol.LDAP_REQ_COMPARE:
        handlers = server.routes[r]._compare;
        break;

      case Protocol.LDAP_REQ_DELETE:
        handlers = server.routes[r]._del;
        break;

      case Protocol.LDAP_REQ_EXTENSION:
        handlers = server.routes[r]._exop;
        break;

      case Protocol.LDAP_REQ_MODIFY:
        handlers = server.routes[r]._modify;
        break;

      case Protocol.LDAP_REQ_MODRDN:
        handlers = server.routes[r]._modifyDN;
        break;

      case Protocol.LDAP_REQ_SEARCH:
        handlers = server.routes[r]._search;
        break;

      case Protocol.LDAP_REQ_UNBIND:
        if (server.routes['unbind'])
          handlers = server.routes['unbind']._unbind;
        break;

      default:
        server.log.warn('Unimplemented server method: %s', req.type);
        return c.destroy();
      }
    }
    if (handlers) {
      backend = server.routes[r]._backend;
      break;
    }
  }

  if (!handlers) {
    backend = server;
    if (matched) {
      server.log.warn('No handler registered for %s:%s, running default',
                      req.type, req.dn.toString());
      handlers = [defaultHandler];
    } else {
      server.log.trace('%s does not map to a known suffix/oid',
                       req.dn.toString());
      handlers = [req.protocolOp !== Protocol.LDAP_REQ_EXTENSION ?
                  noSuffixHandler : noExOpHandler];
    }
  }

  assert.ok(backend);
  assert.ok(handlers);
  assert.ok(handlers instanceof Array);
  assert.ok(handlers.length);

  return {
    backend: backend,
    handlers: handlers
  };
}


function addHandlers(server) {
  assert.ok(server);
  assert.ok(server.log);

  var log = server.log;

  var ops = [ // We don't support abandon.
    'add',
    'bind',
    'compare',
    'del',
    'exop',
    'modify',
    'modifyDN',
    'search',
    'unbind'
  ];

  function processHandlerChain(chain) {
    if (!chain)
      return [defaultHandler];

    if (chain instanceof Array) {
      if (!chain.length)
        return [defaultHandler];

      chain.forEach(function(f) {
        if (typeof(f) !== 'function')
          throw new TypeError('[function(req, res, next)] required');
      });

      return chain;
    } else if (typeof(chain) === 'function') {
      return [chain];
    }

    throw new TypeError('[function(req, res, next)] required');
  }

  server.routes = {};

  ops.forEach(function(o) {
    var op = '_' + o;
    server[o] = function(name, handler) {
      if (o === 'unbind') {
        if (typeof(name === 'function')) {
          handler = name;
          name = 'unbind';
        }
      }
      if (!name || typeof(name) !== 'string')
        throw new TypeError('name (string) required');
      if (!handler || typeof(handler) !== 'function')
        throw new TypeError('[function(req, res, next)] required');

      // Do this first so it will throw
      var _dn = null;
      if (o !== 'exop' && o !== 'unbind') {
        _dn = dn.parse(name);
        name = _dn.toString();
      }

      if (!server.routes[name])
        server.routes[name] = {};
      if (!server.routes[name]._backend)
        server.routes[name]._backend = server;

      server.routes[name][op] = processHandlerChain(handler);
      server.routes[name]._dn = _dn;
      if (log.isTraceEnabled()) {
        var _names = [];
        server.routes[name][op].forEach(function(f) {
          _names.push(f.name || 'Anonymous Function');
        });
        log.trace('%s(%s) -> %s', o, name, _names);
      }
    };
  });

  server.mount = function(name, backend) {
    if (!name || typeof(name) !== 'string')
      throw new TypeError('name (string) required');
    if (!backend || typeof(backend) !== 'object')
      throw new TypeError('backend (object) required');
    if (!backend.name)
      throw new TypeError('backend is not a valid LDAP Backend');
    if (!backend.register || typeof(backend.register) !== 'function')
      throw new TypeError('backend is not a valid LDAP Backend');

    var _dn = null;
    // Do this first so it will throw
    _dn = dn.parse(name);
    name = _dn.toString();

    ops.forEach(function(o) {
      if (o === 'exop' || o === 'unbind')
        return;

      var op = '_' + o;

      if (!server.routes[name])
        server.routes[name] = {};
      if (!server.routes[name]._backend)
        server.routes[name]._backend = backend;

      server.routes[name][op] = processHandlerChain(backend.register(o));
      if (log.isTraceEnabled()) {
        var _names = [];
        server.routes[name][op].forEach(function(f) { _names.push(f.name); });
        log.trace('%s(%s) -> %s', o, name, _names);
      }
    });

    server.routes[name]._dn = _dn;

    log.info('%s mounted at %s', server.routes[name]._backend.toString(), dn);

    return server;
  };

  return server;
}



///--- API

module.exports = {

  createServer: function(options) {
    if (options) {
      if (typeof(options) !== 'object')
        throw new TypeError('options (object) required');
      if (options.log4js && typeof(options.log4js) !== 'object')
        throw new TypeError('options.log4s must be an object');

      if (options.certificate || options.key) {
        if (!(options.certificate && options.key) ||
            typeof(options.certificate) !== 'string' ||
            typeof(options.key) !== 'string') {
          throw new TypeError('options.certificate and options.key (string) ' +
                              'are both required for TLS');
        }
      }
    } else {
      options = {};
    }

    var server;

    function newConnection(c) {
      assert.ok(c);

      if (c.type === 'unix' && server.type === 'unix') {
        c.remoteAddress = server.path;
        c.remotePort = c.fd;
      }

      assert.ok(c.remoteAddress);
      assert.ok(c.remotePort);

      setupConnection(server, c, options);
      if (server.log.isTraceEnabled())
        server.log.trace('new connection from %s', c.ldap.id);

      c.parser = new Parser({
        log4js: server.log4js
      });
      c.parser.on('message', function(req) {
        assert.ok(req);

        req.connection = c;
        req.logId = c.remoteAddress + '::' + req.messageID;

        if (server.log.isDebugEnabled())
          server.log.debug('%s: message received: req=%j', c.ldap.id, req.json);

        var res = getResponse(req);
        if (!res) {
          server.log.warn('Unimplemented server method: %s', req.type);
          c.destroy();
          return;
        }

        var chain = getHandlerChain(server, req);

        var i = 0;
        return function(err) {
          if (err) {
            res.status = err.code || errors.LDAP_OPERATIONS_ERROR;
            res.matchedDN = err.dn ? err.dn.toString() : req.dn.toString();
            res.errorMessage = err.message || '';
            return res.end();
          }

          var next = arguments.callee;
          if (chain.handlers[i])
            return chain.handlers[i++].call(chain.backend, req, res, next);
        }();
      });

      c.parser.on('protocolError', function(err, messageID) {
        server.log.warn('%s sent invalid protocol message', c.ldap.id, err);
        // TODO (mcavage) deal with this
        // send an unsolicited notification
        c.destroy();
      });
      c.parser.on('error', function(err) {
        server.log.error('Exception happened parsing for %s: %s',
                         c.ldap.id, err.stack);
        c.destroy();
      });
      c.on('data', function(data) {
        assert.ok(data);
        if (server.log.isTraceEnabled())
          server.log.trace('data on %s: %s', c.ldap.id, util.inspect(data));
        c.parser.write(data);
      });

    }; // end newConnection

    var secure = options.certificate && options.key;

    if (secure) {
      server = tls.createServer(options, newConnection);
    } else {
      server = net.createServer(newConnection);
    }

    server.log4js = options.log4js || logStub;

    server.ldap = {
      config: options
    };

    server.__defineGetter__('log', function() {
      if (!server._log)
        server._log = server.log4js.getLogger('LDAPServer');

      return server._log;
    });

    addHandlers(server);

    return server;
  }
};





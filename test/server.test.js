// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var Logger = require('bunyan');

var test = require('tape').test;
var uuid = require('node-uuid');
var vasync = require('vasync');


///--- Globals

var BIND_DN = 'cn=root';
var BIND_PW = 'secret';

var SUFFIX = 'dc=test';

var SERVER_PORT = process.env.SERVER_PORT || 1389;

var ldap;
var Attribute;
var Change;
var client;
var server;
var sock;

function getSock() {
  if (process.platform === 'win32') {
    return '\\\\.\\pipe\\' + uuid();
  } else {
    return '/tmp/.' + uuid();
  }
}

///--- Tests

test('load library', function (t) {
  ldap = require('../lib/index');
  t.ok(ldap.createServer);
  t.end();
});

test('basic create', function (t) {
  server = ldap.createServer();
  t.ok(server);
  t.end();
});

test('listen on unix/named socket', function (t) {
  t.plan(1);
  server = ldap.createServer();
  sock = getSock();
  server.listen(sock, function () {
    t.ok(true);
    server.close();
    t.end();
  });
});

test('listen on static port', function (t) {
  t.plan(2);
  server = ldap.createServer();
  server.listen(SERVER_PORT, '127.0.0.1', function () {
    var addr = server.address();
    t.equal(addr.port, parseInt(SERVER_PORT, 10));
    t.equals(server.url, 'ldap://127.0.0.1:' + SERVER_PORT);
    server.close();
    t.end();
  });
});

test('listen on ephemeral port', function (t) {
  t.plan(2);
  server = ldap.createServer();
  server.listen(0, 'localhost', function () {
    var addr = server.address();
    t.ok(addr.port > 0);
    t.ok(addr.port < 65535);
    server.close();
    t.end();
  });
});

test('route order', function (t) {
  function generateHandler(response) {
    var func = function handler(req, res, next) {
      res.send({
        dn: response,
        attributes: { }
      });
      res.end();
      return next();
    };
    return func;
  }

  server = ldap.createServer();
  sock = getSock();
  var dnShort = SUFFIX;
  var dnMed = 'dc=sub, ' + SUFFIX;
  var dnLong = 'dc=long, dc=sub, ' + SUFFIX;

  // Mount routes out of order
  server.search(dnMed, generateHandler(dnMed));
  server.search(dnShort, generateHandler(dnShort));
  server.search(dnLong, generateHandler(dnLong));
  server.listen(sock, function () {
    t.ok(true, 'server listen');
    client = ldap.createClient({ socketPath: sock });
    function runSearch(value, cb) {
      client.search(value, '(objectclass=*)', function (err, res) {
        t.ifError(err);
        t.ok(res);
        res.on('searchEntry', function (entry) {
          t.equal(entry.dn.toString(), value);
        });
        res.on('end', function () {
          cb();
        });
      });
    }

    vasync.forEachParallel({
      'func': runSearch,
      'inputs': [dnShort, dnMed, dnLong]
    }, function (err, results) {
      t.notOk(err);
      client.unbind();
      server.close();
      t.end();
    });
  });
});

test('route absent', function (t) {
  server = ldap.createServer();
  sock = getSock();
  var DN_ROUTE = 'dc=base';
  var DN_MISSING = 'dc=absent';

  server.bind(DN_ROUTE, function (req, res, next) {
    res.end();
    return next();
  });

  server.listen(sock, function () {
    t.ok(true, 'server startup');
    vasync.parallel({
      'funcs': [
        function presentBind(cb) {
          var clt = ldap.createClient({ socketPath: sock });
          clt.bind(DN_ROUTE, '', function (err) {
            t.notOk(err);
            clt.unbind();
            cb();
          });
        },
        function absentBind(cb) {
          var clt = ldap.createClient({ socketPath: sock });
          clt.bind(DN_MISSING, '', function (err) {
            t.ok(err);
            t.equal(err.code, ldap.LDAP_NO_SUCH_OBJECT);
            clt.unbind();
            cb();
          });
        }
      ]
    }, function (err, result) {
      t.notOk(err);
      server.close();
      t.end();
    });
  });
});

test('route unbind', function (t) {
  t.plan(4);
  server = ldap.createServer();
  sock = getSock();

  server.unbind(function (req, res, next) {
    t.ok(true, 'server unbind successful');
    res.end();
    return next();
  });

  server.listen(sock, function () {
    t.ok(true, 'server startup');
    client = ldap.createClient({ socketPath: sock });
    client.bind('', '', function (err) {
      t.ifError(err, 'client bind error');
      client.unbind(function (err) {
        t.ifError(err, 'client unbind error');
        server.close();
        t.end();
      });
    });
  });
});

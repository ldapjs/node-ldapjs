// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var logger = Object.create(require('abstract-logging'));

var fs = require('fs')
var tap = require('tap');
var uuid = require('uuid');
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

tap.beforeEach(function (done, t) {
  // We do not need a `.afterEach` to clean up the sock files because that
  // is done when the server is destroyed.
  t.context.sock = getSock()
  done()
})

tap.test('load library', function (t) {
  ldap = require('../lib/index');
  t.ok(ldap.createServer);
  t.end();
});

tap.test('basic create', function (t) {
  const server = ldap.createServer();
  t.ok(server);
  t.end();
});

tap.test('properties', function (t) {
  const server = ldap.createServer();
  t.equal(server.name, 'LDAPServer');

  // TODO: better test
  server.maxConnections = 10;
  t.equal(server.maxConnections, 10);

  t.equal(server.url, null, 'url empty before bind');
  // listen on a random port so we have a url
  server.listen(0, 'localhost', function () {
    t.ok(server.url);

    server.close();
    t.end();
  });
});

tap.test('listen on unix/named socket', function (t) {
  t.plan(2);
  const server = ldap.createServer();
  server.listen(t.context.sock, function () {
    t.ok(server.url);
    t.equal(server.url.split(':')[0], 'ldapi');
    server.close();
    t.end();
  });
});

tap.test('listen on static port', function (t) {
  t.plan(2);
  const server = ldap.createServer();
  server.listen(SERVER_PORT, '127.0.0.1', function () {
    var addr = server.address();
    t.equal(addr.port, parseInt(SERVER_PORT, 10));
    t.equals(server.url, 'ldap://127.0.0.1:' + SERVER_PORT);
    server.close();
    t.end();
  });
});

tap.test('listen on ephemeral port', function (t) {
  t.plan(2);
  const server = ldap.createServer();
  server.listen(0, 'localhost', function () {
    var addr = server.address();
    t.ok(addr.port > 0);
    t.ok(addr.port < 65535);
    server.close();
    t.end();
  });
});

tap.test('route order', function (t) {
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

tap.test('route absent', function (t) {
  const server = ldap.createServer();
  var DN_ROUTE = 'dc=base';
  var DN_MISSING = 'dc=absent';

  server.bind(DN_ROUTE, function (req, res, next) {
    res.end();
    return next();
  });

  server.listen(t.context.sock, function () {
    t.ok(true, 'server startup');
    vasync.parallel({
      'funcs': [
        function presentBind(cb) {
          var clt = ldap.createClient({ socketPath: t.context.sock });
          clt.bind(DN_ROUTE, '', function (err) {
            t.notOk(err);
            clt.unbind();
            cb();
          });
        },
        function absentBind(cb) {
          var clt = ldap.createClient({ socketPath: t.context.sock });
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

tap.test('route unbind', function (t) {
  t.plan(4);
  const server = ldap.createServer();

  server.unbind(function (req, res, next) {
    t.ok(true, 'server unbind successful');
    res.end();
    return next();
  });

  server.listen(t.context.sock, function () {
    t.ok(true, 'server startup');
    client = ldap.createClient({ socketPath: t.context.sock });
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

tap.test('strict routing', function (t) {
  var testDN = 'cn=valid';
  var clt;
  var server;
  var sock = t.context.sock;
  vasync.pipeline({
    funcs: [
      function setup(_, cb) {
        server = ldap.createServer({
          // strictDN: true - on by default
        });
        // invalid DNs would go to default handler
        server.search('', function (req, res, next) {
          t.ok(req.dn);
          t.equal(typeof (req.dn), 'object');
          t.equal(req.dn.toString(), testDN);
          res.end();
          next();
        });
        server.listen(sock, function () {
          t.ok(true, 'server startup');
          clt = ldap.createClient({
            socketPath: sock,
            strictDN: false
          });
          cb();
        });
      },
      function testBad(_, cb) {
        clt.search('not a dn', {scope: 'base'}, function (err, res) {
          t.ifError(err);
          res.once('error', function (err2) {
            t.ok(err2);
            t.equal(err2.code, ldap.LDAP_INVALID_DN_SYNTAX);
            cb();
          });
          res.once('end', function () {
            t.fail('accepted invalid dn');
            cb('bogus');
          });
        });
      },
      function testGood(_, cb) {
        clt.search(testDN, {scope: 'base'}, function (err, res) {
          t.ifError(err);
          res.once('error', function (err2) {
            t.ifError(err2);
            cb(err2);
          });
          res.once('end', function (result) {
            t.ok(result, 'accepted invalid dn');
            cb();
          });
        });
      }
    ]
  }, function (err, res) {
    if (clt) {
      clt.destroy();
    }
    server.close();
    t.end();
  });
});

tap.test('non-strict routing', function (t) {
  const server = ldap.createServer({
    strictDN: false
  });
  var testDN = 'this ain\'t a DN';

  // invalid DNs go to default handler
  server.search('', function (req, res, next) {
    t.ok(req.dn);
    t.equal(typeof (req.dn), 'string');
    t.equal(req.dn, testDN);
    res.end();
    next();
  });

  server.listen(t.context.sock, function () {
    t.ok(true, 'server startup');
    var clt = ldap.createClient({
      socketPath: t.context.sock,
      strictDN: false
    });
    clt.search(testDN, {scope: 'base'}, function (err, res) {
      t.ifError(err);
      res.on('end', function () {
        clt.destroy();
        server.close();
        t.end();
      });
    });
  });
});

tap.test('close accept a callback', function (t) {
  const server = ldap.createServer();
  // callback is called when the server is closed
  server.close(function(err){
    t.end();
  });
});

tap.test('close without error calls callback', function (t) {
  const server = ldap.createServer();
  // when the server is closed without error, the callback parameter is undefined
  server.listen(1389,'127.0.0.1',function(err){
    server.close(function(err){
      t.error(err);
      t.end();
    });
  });
});

tap.test('close passes error to callback', function (t) {
  const server = ldap.createServer();
  // when the server is closed with an error, the error is the first parameter of the callback
  server.close(function(err){
    t.ok(err);
    t.end();
  });
});

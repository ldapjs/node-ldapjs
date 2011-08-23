// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var test = require('tap').test;
var uuid = require('node-uuid');


///--- Globals

var BIND_DN = 'cn=root';
var BIND_PW = 'secret';
var SOCKET = '/tmp/.' + uuid();

var SUFFIX = 'dc=test';

var ldap;
var Attribute;
var Change;
var client;
var server;


///--- Tests

test('setup', function(t) {
  ldap = require('../lib/index');
  t.ok(ldap);
  t.ok(ldap.createClient);
  t.ok(ldap.createServer);
  t.ok(ldap.Attribute);
  t.ok(ldap.Change);

  Attribute = ldap.Attribute;
  Change = ldap.Change;

  server = ldap.createServer();
  t.ok(server);

  server.bind(BIND_DN, function(req, res, next) {
    if (req.credentials !== BIND_PW)
      return next(new ldap.InvalidCredentialsError('Invalid password'));

    res.end();
    return next();
  });

  server.add(SUFFIX, function(req, res, next) {
    res.end();
    return next();
  });

  server.compare(SUFFIX, function(req, res, next) {
    res.end(req.value === 'test');
    return next();
  });

  server.del(SUFFIX, function(req, res, next) {
    res.end();
    return next();
  });

  // LDAP whoami
  server.exop('1.3.6.1.4.1.4203.1.11.3', function(req, res, next) {
    res.value = 'u:xxyyz@EXAMPLE.NET';
    res.end();
    return next();
  });

  server.modify(SUFFIX, function(req, res, next) {
    res.end();
    return next();
  });

  server.modifyDN(SUFFIX, function(req, res, next) {
    res.end();
    return next();
  });

  server.search(SUFFIX, function(req, res, next) {
    var e = res.createSearchEntry({
      objectName: req.dn,
      attributes: {
        cn: ['unit', 'test'],
        sn: 'testy'
      }
    });
    res.send(e);
    res.send(e);
    res.end();
    return next();
  });

  server.unbind(function(req, res, next) {
    res.end();
    return next();
  });

  server.listen(SOCKET, function() {
    client = ldap.createClient({
      socketPath: SOCKET
    });
    t.ok(client);
    // client.log4js.setLevel('Debug');
    t.end();
  });

});


test('simple bind success', function(t) {
  client.bind(BIND_DN, BIND_PW, function(err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('simple bind failure', function(t) {
  client.bind(BIND_DN, uuid(), function(err, res) {
    t.ok(err);
    t.notOk(res);

    t.ok(err instanceof ldap.InvalidCredentialsError);
    t.ok(err instanceof Error);
    t.ok(err.dn);
    t.ok(err.message);
    t.ok(err.stack);

    t.end();
  });
});


test('add success', function(t) {
  var attrs = [
    new Attribute({
      type: 'cn',
      vals: ['test']
    })
  ];
  client.add('cn=add, ' + SUFFIX, attrs, function(err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('add success with object', function(t) {
  var entry = {
    cn: ['unit', 'add'],
    sn: 'test'
  };
  client.add('cn=add, ' + SUFFIX, entry, function(err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('compare success', function(t) {
  client.compare('cn=compare, ' + SUFFIX, 'cn', 'test', function(err,
                                                                 matched,
                                                                 res) {
    t.ifError(err);
    t.ok(matched);
    t.ok(res);
    t.end();
  });
});


test('compare false', function(t) {
  client.compare('cn=compare, ' + SUFFIX, 'cn', 'foo', function(err,
                                                                matched,
                                                                res) {
    t.ifError(err);
    t.notOk(matched);
    t.ok(res);
    t.end();
  });
});


test('compare bad suffix', function(t) {
  client.compare('cn=' + uuid(), 'cn', 'foo', function(err,
                                                       matched,
                                                       res) {
    t.ok(err);
    t.ok(err instanceof ldap.NoSuchObjectError);
    t.notOk(matched);
    t.notOk(res);
    t.end();
  });
});


test('delete success', function(t) {
  client.del('cn=delete, ' + SUFFIX, function(err, res) {
    t.ifError(err);
    t.ok(res);
    t.end();
  });
});


test('exop success', function(t) {
  client.exop('1.3.6.1.4.1.4203.1.11.3', function(err, value, res) {
    t.ifError(err);
    t.ok(value);
    t.ok(res);
    t.equal(value, 'u:xxyyz@EXAMPLE.NET');
    t.end();
  });
});


test('exop invalid', function(t) {
  client.exop('1.2.3.4', function(err, res) {
    t.ok(err);
    t.ok(err instanceof ldap.ProtocolError);
    t.notOk(res);
    t.end();
  });
});


test('modify success', function(t) {
  var change = new Change({
    type: 'Replace',
    modification: new Attribute({
      type: 'cn',
      vals: ['test']
    })
  });
  client.modify('cn=modify, ' + SUFFIX, change, function(err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('modify change plain object success', function(t) {
  var change = new Change({
    type: 'Replace',
    modification: {
      cn: 'test'
    }
  });
  client.modify('cn=modify, ' + SUFFIX, change, function(err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('modify array success', function(t) {
  var changes = [
    new Change({
      operation: 'Replace',
      modification: new Attribute({
        type: 'cn',
        vals: ['test']
      })
    }),
    new Change({
      operation: 'Delete',
      modification: new Attribute({
        type: 'sn'
      })
    })
  ];
  client.modify('cn=modify, ' + SUFFIX, changes, function(err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('modify DN new RDN only', function(t) {
  client.modifyDN('cn=old, ' + SUFFIX, 'cn=new', function(err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('modify DN new superior', function(t) {
  client.modifyDN('cn=old, ' + SUFFIX, 'cn=new, dc=foo', function(err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('search basic', function(t) {
  client.search('cn=test, ' + SUFFIX, '(objectclass=*)', function(err, res) {
    t.ifError(err);
    t.ok(res);
    var gotEntry = 0;
    res.on('searchEntry', function(entry) {
      t.ok(entry);
      t.ok(entry instanceof ldap.SearchEntry);
      t.equal(entry.dn.toString(), 'cn=test, ' + SUFFIX);
      t.ok(entry.attributes);
      t.ok(entry.attributes.length);
      t.ok(entry.object);
      gotEntry++;
    });
    res.on('error', function(err) {
      t.fail(err);
    });
    res.on('end', function(res) {
      t.ok(res);
      t.ok(res instanceof ldap.SearchResponse);
      t.equal(res.status, 0);
      t.equal(gotEntry, 2);
      t.end();
    });
  });
});


test('shutdown', function(t) {
  client.unbind(function() {
    server.on('close', function() {
      t.end();
    });
    server.close();
  });
});

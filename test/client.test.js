// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var Logger = require('bunyan');

var test = require('tape').test;
var uuid = require('node-uuid');
var vasync = require('vasync');
var util = require('util');


///--- Globals

var BIND_DN = 'cn=root';
var BIND_PW = 'secret';
var SOCKET = '/tmp/.' + uuid();

var SUFFIX = 'dc=test';

var LOG = new Logger({
  name: 'ldapjs_unit_test',
  stream: process.stderr,
  level: (process.env.LOG_LEVEL || 'info'),
  serializers: Logger.stdSerializers,
  src: true
});

var ldap;
var Attribute;
var Change;
var client;
var server;


///--- Tests

test('setup', function (t) {
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

  server.bind(BIND_DN, function (req, res, next) {
    if (req.credentials !== BIND_PW)
      return next(new ldap.InvalidCredentialsError('Invalid password'));

    res.end();
    return next();
  });

  server.add(SUFFIX, function (req, res, next) {
    res.end();
    return next();
  });

  server.compare(SUFFIX, function (req, res, next) {
    res.end(req.value === 'test');
    return next();
  });

  server.del(SUFFIX, function (req, res, next) {
    res.end();
    return next();
  });

  // LDAP whoami
  server.exop('1.3.6.1.4.1.4203.1.11.3', function (req, res, next) {
    res.value = 'u:xxyyz@EXAMPLE.NET';
    res.end();
    return next();
  });

  server.modify(SUFFIX, function (req, res, next) {
    res.end();
    return next();
  });

  server.modifyDN(SUFFIX, function (req, res, next) {
    res.end();
    return next();
  });

  server.search('dc=slow', function (req, res, next) {
    res.send({
      dn: 'dc=slow',
      attributes: {
        'you': 'wish',
        'this': 'was',
        'faster': '.'
      }
    });
    setTimeout(function () {
      res.end();
      next();
    }, 250);
  });

  server.search('dc=timeout', function (req, res, next) {
    // Haha client!
  });

  server.search(SUFFIX, function (req, res, next) {

    if (req.dn.equals('cn=ref,' + SUFFIX)) {
      res.send(res.createSearchReference('ldap://localhost'));
    } else if (req.dn.equals('cn=bin,' + SUFFIX)) {
      res.send(res.createSearchEntry({
        objectName: req.dn,
        attributes: {
          'foo;binary': 'wr0gKyDCvCA9IMK+',
          'gb18030': new Buffer([0xB5, 0xE7, 0xCA, 0xD3, 0xBB, 0xFA]),
          'objectclass': 'binary'
        }
      }));
    } else {
      var e = res.createSearchEntry({
        objectName: req.dn,
        attributes: {
          cn: ['unit', 'test'],
          SN: 'testy'
        }
      });
      res.send(e);
      res.send(e);
    }


    res.end();
    return next();
  });

  server.search('cn=sizelimit', function (req, res, next) {
    var sizeLimit = 200;
    var i;
    for (i = 0; i < 1000; i++) {
      if (req.sizeLimit > 0 && i >= req.sizeLimit) {
        break;
      } else if (i > sizeLimit) {
        res.end(ldap.LDAP_SIZE_LIMIT_EXCEEDED);
        return next();
      }
      res.send({
        dn: util.format('o=%d, cn=sizelimit', i),
        attributes: {
          o: [i],
          objectclass: ['pagedResult']
        }
      });
    }
    res.end();
    return next();
  });

  server.search('cn=paged', function (req, res, next) {
    var min = 0;
    var max = 1000;

    function sendResults(start, end) {
      start = (start < min) ? min : start;
      end = (end > max || end < min) ? max : end;
      var i;
      for (i = start; i < end; i++) {
        res.send({
          dn: util.format('o=%d, cn=paged', i),
          attributes: {
            o: [i],
            objectclass: ['pagedResult']
          }
        });
      }
      return i;
    }

    var cookie = null;
    var pageSize = 0;
    req.controls.forEach(function (control) {
      if (control.type === ldap.PagedResultsControl.OID) {
        pageSize = control.value.size;
        cookie = control.value.cookie;
      }
    });

    if (cookie && Buffer.isBuffer(cookie)) {
      // Do simple paging
      var first = min;
      if (cookie.length !== 0) {
        first = parseInt(cookie.toString(), 10);
      }
      var last = sendResults(first, first + pageSize);

      var resultCookie;
      if (last < max) {
        resultCookie = new Buffer(last.toString());
      } else {
        resultCookie = new Buffer('');
      }
      res.controls.push(new ldap.PagedResultsControl({
        value: {
          size: pageSize, // correctness not required here
          cookie: resultCookie
        }
      }));
      res.end();
      next();
    } else {
      // don't allow non-paged searches for this test endpoint
      next(new ldap.UnwillingToPerformError());
    }
  });

  server.search('cn=pagederr', function (req, res, next) {
    var cookie = null;
    req.controls.forEach(function (control) {
      if (control.type === ldap.PagedResultsControl.OID) {
        cookie = control.value.cookie;
      }
    });
    if (cookie && Buffer.isBuffer(cookie) && cookie.length === 0) {
      // send first "page"
        res.send({
          dn: util.format('o=result, cn=pagederr'),
          attributes: {
            o: 'result',
            objectclass: ['pagedResult']
          }
        });
        res.controls.push(new ldap.PagedResultsControl({
          value: {
            size: 2,
            cookie: new Buffer('a')
          }
        }));
        res.end();
        return next();
    } else {
      // send error instead of second page
        res.end(ldap.LDAP_SIZE_LIMIT_EXCEEDED);
        return next();
    }
  });

  server.search('dc=empty', function (req, res, next) {
    res.send({
      dn: 'dc=empty',
      attributes: {
        member: [],
        'member;range=0-1': ['cn=user1, dc=empty', 'cn=user2, dc=empty']
      }
    });
    res.end();
    return next();
  });

  server.search('cn=busy', function (req, res, next) {
    next(new ldap.BusyError('too much to do'));
  });

  server.search('', function (req, res, next) {
    if (req.dn.toString() === '') {
      res.send({
        dn: '',
        attributes: {
          objectclass: ['RootDSE', 'top']
        }
      });
      res.end();
    } else {
      // Turn away any other requests (since '' is the fallthrough route)
      res.errorMessage = 'No tree found for: ' + req.dn.toString();
      res.end(ldap.LDAP_NO_SUCH_OBJECT);
    }
    return next();
  });

  server.unbind(function (req, res, next) {
    res.end();
    return next();
  });

  server.listen(SOCKET, function () {
    client = ldap.createClient({
      connectTimeout: parseInt(process.env.LDAP_CONNECT_TIMEOUT || 0, 10),
      socketPath: SOCKET,
      log: LOG
    });
    t.ok(client);
    t.end();
  });

});


test('simple bind failure', function (t) {
  client.bind(BIND_DN, uuid(), function (err, res) {
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


test('simple bind success', function (t) {
  client.bind(BIND_DN, BIND_PW, function (err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('simple anonymous bind (empty credentials)', function (t) {
  client.bind('', '', function (err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('auto-bind bad credentials', function (t) {
  var clt = ldap.createClient({
    socketPath: SOCKET,
    bindDN: BIND_DN,
    bindCredentials: 'totallybogus',
    log: LOG
  });
  clt.once('error', function (err) {
    t.equal(err.code, ldap.LDAP_INVALID_CREDENTIALS);
    clt.destroy();
    t.end();
  });
});


test('auto-bind success', function (t) {
  var clt = ldap.createClient({
    socketPath: SOCKET,
    bindDN: BIND_DN,
    bindCredentials: BIND_PW,
    log: LOG
  });
  clt.once('connect', function () {
    t.ok(clt);
    clt.destroy();
    t.end();
  });
});


test('add success', function (t) {
  var attrs = [
    new Attribute({
      type: 'cn',
      vals: ['test']
    })
  ];
  client.add('cn=add, ' + SUFFIX, attrs, function (err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('add success with object', function (t) {
  var entry = {
    cn: ['unit', 'add'],
    sn: 'test'
  };
  client.add('cn=add, ' + SUFFIX, entry, function (err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('compare success', function (t) {
  client.compare('cn=compare, ' + SUFFIX, 'cn', 'test', function (err,
                                                                 matched,
                                                                 res) {
    t.ifError(err);
    t.ok(matched);
    t.ok(res);
    t.end();
  });
});


test('compare false', function (t) {
  client.compare('cn=compare, ' + SUFFIX, 'cn', 'foo', function (err,
                                                                matched,
                                                                res) {
    t.ifError(err);
    t.notOk(matched);
    t.ok(res);
    t.end();
  });
});


test('compare bad suffix', function (t) {
  client.compare('cn=' + uuid(), 'cn', 'foo', function (err,
                                                       matched,
                                                       res) {
    t.ok(err);
    t.ok(err instanceof ldap.NoSuchObjectError);
    t.notOk(matched);
    t.notOk(res);
    t.end();
  });
});


test('delete success', function (t) {
  client.del('cn=delete, ' + SUFFIX, function (err, res) {
    t.ifError(err);
    t.ok(res);
    t.end();
  });
});


test('delete with control (GH-212)', function (t) {
  var control = new ldap.Control({
    type: '1.2.3.4',
    criticality: false
  });
  client.del('cn=delete, ' + SUFFIX, control, function (err, res) {
    t.ifError(err);
    t.ok(res);
    t.end();
  });
});


test('exop success', function (t) {
  client.exop('1.3.6.1.4.1.4203.1.11.3', function (err, value, res) {
    t.ifError(err);
    t.ok(value);
    t.ok(res);
    t.equal(value, 'u:xxyyz@EXAMPLE.NET');
    t.end();
  });
});


test('exop invalid', function (t) {
  client.exop('1.2.3.4', function (err, res) {
    t.ok(err);
    t.ok(err instanceof ldap.ProtocolError);
    t.notOk(res);
    t.end();
  });
});


test('bogus exop (GH-17)', function (t) {
  client.exop('cn=root', function (err, value) {
    t.ok(err);
    t.end();
  });
});


test('modify success', function (t) {
  var change = new Change({
    type: 'Replace',
    modification: new Attribute({
      type: 'cn',
      vals: ['test']
    })
  });
  client.modify('cn=modify, ' + SUFFIX, change, function (err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('modify change plain object success', function (t) {
  var change = new Change({
    type: 'Replace',
    modification: {
      cn: 'test'
    }
  });
  client.modify('cn=modify, ' + SUFFIX, change, function (err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('modify array success', function (t) {
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
  client.modify('cn=modify, ' + SUFFIX, changes, function (err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('modify change plain object success (GH-31)', function (t) {
  var change = {
    type: 'replace',
    modification: {
      cn: 'test',
      sn: 'bar'
    }
  };
  client.modify('cn=modify, ' + SUFFIX, change, function (err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('modify DN new RDN only', function (t) {
  client.modifyDN('cn=old, ' + SUFFIX, 'cn=new', function (err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('modify DN new superior', function (t) {
  client.modifyDN('cn=old, ' + SUFFIX, 'cn=new, dc=foo', function (err, res) {
    t.ifError(err);
    t.ok(res);
    t.equal(res.status, 0);
    t.end();
  });
});


test('search basic', function (t) {
  client.search('cn=test, ' + SUFFIX, '(objectclass=*)', function (err, res) {
    t.ifError(err);
    t.ok(res);
    var gotEntry = 0;
    res.on('searchEntry', function (entry) {
      t.ok(entry);
      t.ok(entry instanceof ldap.SearchEntry);
      t.equal(entry.dn.toString(), 'cn=test, ' + SUFFIX);
      t.ok(entry.attributes);
      t.ok(entry.attributes.length);
      t.equal(entry.attributes[0].type, 'cn');
      t.equal(entry.attributes[1].type, 'SN');
      t.ok(entry.object);
      gotEntry++;
    });
    res.on('error', function (err) {
      t.fail(err);
    });
    res.on('end', function (res) {
      t.ok(res);
      t.ok(res instanceof ldap.SearchResponse);
      t.equal(res.status, 0);
      t.equal(gotEntry, 2);
      t.end();
    });
  });
});


test('search sizeLimit', function (t) {
  t.test('over limit', function (t2) {
    client.search('cn=sizelimit', {}, function (err, res) {
      t2.ifError(err);
      res.on('error', function (error) {
        t2.equal(error.name, 'SizeLimitExceededError');
        t2.end();
      });
    });
  });

  t.test('under limit', function (t2) {
    var limit = 100;
    client.search('cn=sizelimit', {sizeLimit: limit}, function (err, res) {
      t2.ifError(err);
      var count = 0;
      res.on('searchEntry', function (entry) {
        count++;
      });
      res.on('end', function () {
        t2.pass();
        t2.equal(count, limit);
        t2.end();
      });
      res.on('error', t2.ifError.bind(t));
    });
  });
});


test('search paged', function (t) {
  t.test('paged - no pauses', function (t2) {
    var countEntries = 0;
    var countPages = 0;
    client.search('cn=paged', {paged: {pageSize: 100}}, function (err, res) {
      t2.ifError(err);
      res.on('searchEntry', function () {
        countEntries++;
      });
      res.on('page', function () {
        countPages++;
      });
      res.on('error', t2.ifError.bind(t2));
      res.on('end', function () {
        t2.equal(countEntries, 1000);
        t2.equal(countPages, 10);
        t2.end();
      });
    });
  });

  t.test('paged - pauses', function (t2) {
    var countPages = 0;
    client.search('cn=paged', {
      paged: {
        pageSize: 100,
        pagePause: true
      }
    }, function (err, res) {
      t2.ifError(err);
      res.on('page', function (result, cb) {
        countPages++;
        // cancel after 9 to verify callback usage
        if (countPages === 9) {
          // another page should never be encountered
          res.removeAllListeners('page')
            .on('page', t2.fail.bind(null, 'unexpected page'));
          return cb(new Error());
        }
        return cb();
      });
      res.on('error', t2.ifError.bind(t2));
      res.on('end', function () {
        t2.equal(countPages, 9);
        t2.end();
      });
    });
  });

  t.test('paged - no support (err handled)', function (t2) {
    client.search(SUFFIX, {
      paged: { pageSize: 100 }
    }, function (err, res) {
      t2.ifError(err);
      res.on('pageError', t2.ok.bind(t2));
      res.on('end', function () {
        t2.pass();
        t2.end();
      });
    });
  });

  t.test('paged - no support (err not handled)', function (t2) {
    client.search(SUFFIX, {
      paged: { pageSize: 100 }
    }, function (err, res) {
      t2.ifError(err);
      res.on('end', t2.fail.bind(t2));
      res.on('error', function (error) {
        t2.ok(error);
        t2.end();
      });
    });
  });

  t.test('paged - redundant control', function (t2) {
    try {
      client.search(SUFFIX, {
        paged: { pageSize: 100 }
      }, new ldap.PagedResultsControl(),
      function (err, res) {
        t2.fail();
      });
    } catch (e) {
      t2.ok(e);
      t2.end();
    }
  });

  t.test('paged - handle later error', function (t2) {
    var countEntries = 0;
    var countPages = 0;
    client.search('cn=pagederr', {
      paged: { pageSize: 1 }
    }, function (err, res) {
      t2.ifError(err);
      res.on('searchEntry', function () {
        t2.ok(++countEntries);
      });
      res.on('page', function () {
        t2.ok(++countPages);
      });
      res.on('error', function (error) {
        t2.equal(countEntries, 1);
        t2.equal(countPages, 1);
        t2.end();
      });
      res.on('end', function () {
        t2.fail('should not be reached');
      });
    });
  });

  t.end();
});


test('search referral', function (t) {
  client.search('cn=ref, ' + SUFFIX, '(objectclass=*)', function (err, res) {
    t.ifError(err);
    t.ok(res);
    var gotEntry = 0;
    var gotReferral = false;
    res.on('searchEntry', function (entry) {
      gotEntry++;
    });
    res.on('searchReference', function (referral) {
      gotReferral = true;
      t.ok(referral);
      t.ok(referral instanceof ldap.SearchReference);
      t.ok(referral.uris);
      t.ok(referral.uris.length);
    });
    res.on('error', function (err) {
      t.fail(err);
    });
    res.on('end', function (res) {
      t.ok(res);
      t.ok(res instanceof ldap.SearchResponse);
      t.equal(res.status, 0);
      t.equal(gotEntry, 0);
      t.ok(gotReferral);
      t.end();
    });
  });
});


test('search rootDSE', function (t) {
  client.search('', '(objectclass=*)', function (err, res) {
    t.ifError(err);
    t.ok(res);
    res.on('searchEntry', function (entry) {
      t.ok(entry);
      t.equal(entry.dn.toString(), '');
      t.ok(entry.attributes);
      t.ok(entry.object);
    });
    res.on('error', function (err) {
      t.fail(err);
    });
    res.on('end', function (res) {
      t.ok(res);
      t.ok(res instanceof ldap.SearchResponse);
      t.equal(res.status, 0);
      t.end();
    });
  });
});


test('search empty attribute', function (t) {
  client.search('dc=empty', '(objectclass=*)', function (err, res) {
    t.ifError(err);
    t.ok(res);
    var gotEntry = 0;
    res.on('searchEntry', function (entry) {
      var obj = entry.toObject();
      t.equal('dc=empty', obj.dn);
      t.ok(obj.member);
      t.equal(obj.member.length, 0);
      t.ok(obj['member;range=0-1']);
      t.ok(obj['member;range=0-1'].length);
      gotEntry++;
    });
    res.on('error', function (err) {
      t.fail(err);
    });
    res.on('end', function (res) {
      t.ok(res);
      t.ok(res instanceof ldap.SearchResponse);
      t.equal(res.status, 0);
      t.equal(gotEntry, 1);
      t.end();
    });
  });
});


test('GH-21 binary attributes', function (t) {
  client.search('cn=bin, ' + SUFFIX, '(objectclass=*)', function (err, res) {
    t.ifError(err);
    t.ok(res);
    var gotEntry = 0;
    var expect = new Buffer('\u00bd + \u00bc = \u00be', 'utf8');
    var expect2 = new Buffer([0xB5, 0xE7, 0xCA, 0xD3, 0xBB, 0xFA]);
    res.on('searchEntry', function (entry) {
      t.ok(entry);
      t.ok(entry instanceof ldap.SearchEntry);
      t.equal(entry.dn.toString(), 'cn=bin, ' + SUFFIX);
      t.ok(entry.attributes);
      t.ok(entry.attributes.length);
      t.equal(entry.attributes[0].type, 'foo;binary');
      t.equal(entry.attributes[0].vals[0], expect.toString('base64'));
      t.equal(entry.attributes[0].buffers[0].toString('base64'),
              expect.toString('base64'));

      t.ok(entry.attributes[1].type, 'gb18030');
      t.equal(entry.attributes[1].buffers.length, 1);
      t.equal(expect2.length, entry.attributes[1].buffers[0].length);
      for (var i = 0; i < expect2.length; i++)
        t.equal(expect2[i], entry.attributes[1].buffers[0][i]);

      t.ok(entry.object);
      gotEntry++;
    });
    res.on('error', function (err) {
      t.fail(err);
    });
    res.on('end', function (res) {
      t.ok(res);
      t.ok(res instanceof ldap.SearchResponse);
      t.equal(res.status, 0);
      t.equal(gotEntry, 1);
      t.end();
    });
  });
});


test('GH-23 case insensitive attribute filtering', function (t) {
  var opts = {
    filter: '(objectclass=*)',
    attributes: ['Cn']
  };
  client.search('cn=test, ' + SUFFIX, opts, function (err, res) {
    t.ifError(err);
    t.ok(res);
    var gotEntry = 0;
    res.on('searchEntry', function (entry) {
      t.ok(entry);
      t.ok(entry instanceof ldap.SearchEntry);
      t.equal(entry.dn.toString(), 'cn=test, ' + SUFFIX);
      t.ok(entry.attributes);
      t.ok(entry.attributes.length);
      t.equal(entry.attributes[0].type, 'cn');
      t.ok(entry.object);
      gotEntry++;
    });
    res.on('error', function (err) {
      t.fail(err);
    });
    res.on('end', function (res) {
      t.ok(res);
      t.ok(res instanceof ldap.SearchResponse);
      t.equal(res.status, 0);
      t.equal(gotEntry, 2);
      t.end();
    });
  });
});


test('GH-24 attribute selection of *', function (t) {
  var opts = {
    filter: '(objectclass=*)',
    attributes: ['*']
  };
  client.search('cn=test, ' + SUFFIX, opts, function (err, res) {
    t.ifError(err);
    t.ok(res);
    var gotEntry = 0;
    res.on('searchEntry', function (entry) {
      t.ok(entry);
      t.ok(entry instanceof ldap.SearchEntry);
      t.equal(entry.dn.toString(), 'cn=test, ' + SUFFIX);
      t.ok(entry.attributes);
      t.ok(entry.attributes.length);
      t.equal(entry.attributes[0].type, 'cn');
      t.equal(entry.attributes[1].type, 'SN');
      t.ok(entry.object);
      gotEntry++;
    });
    res.on('error', function (err) {
      t.fail(err);
    });
    res.on('end', function (res) {
      t.ok(res);
      t.ok(res instanceof ldap.SearchResponse);
      t.equal(res.status, 0);
      t.equal(gotEntry, 2);
      t.end();
    });
  });
});


test('idle timeout', function (t) {
  client.idleTimeout = 250;
  function premature() {
    t.ifError(true);
  }
  client.on('idle', premature);
  client.search('dc=slow', 'objectclass=*', function (err, res) {
    t.ifError(err);
    res.on('searchEntry', function (res) {
      t.ok(res);
    });
    res.on('error', function (err) {
      t.ifError(err);
    });
    res.on('end', function () {
      var late = setTimeout(function () {
        t.ifError(false, 'too late');
      }, 500);
      // It's ok to go idle now
      client.removeListener('idle', premature);
      client.on('idle', function () {
        clearTimeout(late);
        client.removeAllListeners('idle');
        client.idleTimeout = 0;
        t.end();
      });
    });
  });
});


test('setup action', function (t) {
  var setupClient = ldap.createClient({
      connectTimeout: parseInt(process.env.LDAP_CONNECT_TIMEOUT || 0, 10),
      socketPath: SOCKET,
      log: LOG
    });
  setupClient.on('setup', function (clt, cb) {
    clt.bind(BIND_DN, BIND_PW, function (err, res) {
      t.ifError(err);
      cb(err);
    });
  });
  setupClient.search(SUFFIX, {scope: 'base'}, function (err, res) {
    t.ifError(err);
    t.ok(res);
    res.on('end', function () {
      setupClient.destroy();
      t.end();
    });
  });
});


test('setup reconnect', function (t) {
  var rClient = ldap.createClient({
      connectTimeout: parseInt(process.env.LDAP_CONNECT_TIMEOUT || 0, 10),
      socketPath: SOCKET,
      reconnect: true,
      log: LOG
    });
  rClient.on('setup', function (clt, cb) {
    clt.bind(BIND_DN, BIND_PW, function (err, res) {
      t.ifError(err);
      cb(err);
    });
  });

  function doSearch(_, cb) {
    rClient.search(SUFFIX, {scope: 'base'}, function (err, res) {
      t.ifError(err);
      res.on('end', function () {
        cb();
      });
    });
  }
  vasync.pipeline({
    funcs: [
      doSearch,
      function cleanDisconnect(_, cb) {
        t.ok(rClient.connected);
        rClient.once('close', function (had_err) {
          t.ifError(had_err);
          t.equal(rClient.connected, false);
          cb();
        });
        rClient.unbind();
      },
      doSearch,
      function simulateError(_, cb) {
        var msg = 'fake socket error';
        rClient.once('error', function (err) {
          t.equal(err.message, msg);
          t.ok(err);
        });
        rClient.once('close', function (had_err) {
          // can't test had_err because the socket error is being faked
          cb();
        });
        rClient._socket.emit('error', new Error(msg));
      },
      doSearch
    ]
  }, function (err, res) {
    t.ifError(err);
    rClient.destroy();
    t.end();
  });
});


test('setup abort', function (t) {
  var setupClient = ldap.createClient({
      connectTimeout: parseInt(process.env.LDAP_CONNECT_TIMEOUT || 0, 10),
      socketPath: SOCKET,
      reconnect: true,
      log: LOG
    });
  var message = 'It\'s a trap!';
  setupClient.on('setup', function (clt, cb) {
    // simulate failure
    t.ok(clt);
    cb(new Error(message));
  });
  setupClient.on('setupError', function (err) {
    t.ok(true);
    t.equal(err.message, message);
    setupClient.destroy();
    t.end();
  });
});


test('abort reconnect', function (t) {
  var abortClient = ldap.createClient({
    connectTimeout: parseInt(process.env.LDAP_CONNECT_TIMEOUT || 0, 10),
    socketPath: '/dev/null',
    reconnect: true,
    log: LOG
  });
  var retryCount = 0;
  abortClient.on('connectError', function () {
    ++retryCount;
  });
  abortClient.once('connectError', function () {
    t.ok(true);
    abortClient.once('destroy', function () {
      t.ok(retryCount < 3);
      t.end();
    });
    abortClient.destroy();
  });
});


test('reconnect max retries', function (t) {
  var RETRIES = 5;
  var rClient = ldap.createClient({
    connectTimeout: 100,
    socketPath: '/dev/null',
    reconnect: {
      failAfter: RETRIES,
      // Keep the test duration low
      initialDelay: 10,
      maxDelay: 100
    },
    log: LOG
  });
  var count = 0;
  rClient.on('connectError', function () {
    count++;
  });
  rClient.on('error', function (err) {
    t.equal(count, RETRIES);
    rClient.destroy();
    t.end();
  });
});


test('reconnect on server close', function (t) {
  var clt = ldap.createClient({
    socketPath: SOCKET,
    reconnect: true,
    log: LOG
  });
  clt.on('setup', function (sclt, cb) {
    sclt.bind(BIND_DN, BIND_PW, function (err, res) {
      t.ifError(err);
      cb(err);
    });
  });
  clt.once('connect', function () {
    t.ok(clt._socket);
    clt.once('connect', function () {
      t.ok(true, 'successful reconnect');
      clt.destroy();
      t.end();
    });

    // Simulate server-side close
    clt._socket.destroy();
  });
});


test('no auto-reconnect on unbind', function (t) {
  var clt = ldap.createClient({
    socketPath: SOCKET,
    reconnect: true,
    log: LOG
  });
  clt.on('setup', function (sclt, cb) {
    sclt.bind(BIND_DN, BIND_PW, function (err, res) {
      t.ifError(err);
      cb(err);
    });
  });
  clt.once('connect', function () {
    clt.once('connect', function () {
      t.ifError(new Error('client should not reconnect'));
    });
    clt.once('close', function () {
      t.ok(true, 'initial close');
      setImmediate(function () {
        t.ok(!clt.connected, 'should not be connected');
        t.ok(!clt.connecting, 'should not be connecting');
        clt.destroy();
        t.end();
      });
    });

    clt.unbind();
  });
});


test('abandon (GH-27)', function (t) {
  // FIXME: test abandoning a real request
  client.abandon(401876543, function (err) {
    t.ifError(err);
    t.end();
  });
});


test('search timeout (GH-51)', function (t) {
  client.timeout = 250;
  client.search('dc=timeout', 'objectclass=*', function (err, res) {
    t.ifError(err);
    res.on('error', function () {
      t.end();
    });
  });
});


test('resultError handling', function (t) {
  t.plan(3);
  vasync.pipeline({
    funcs: [
      function errSearch(_, cb) {
        client.once('resultError', function (error) {
          t.equal(error.name, 'BusyError');
        });
        client.search('cn=busy', {}, function (err, res) {
          res.once('error', function (error) {
            t.equal(error.name, 'BusyError');
            cb();
          });
        });
      },
      function cleanSearch(_, cb) {
        client.on('resultError', t.ifError.bind(null));
        client.search(SUFFIX, {}, function (err, res) {
          res.once('end', function () {
            t.ok(true);
            cb();
          });
        });
      }
    ]
  }, function (err, res) {
    client.removeAllListeners('resultError');
  });
});


test('unbind (GH-30)', function (t) {
  client.unbind(function (err) {
    t.ifError(err);
    t.end();
  });
});


test('shutdown', function (t) {
  server.on('close', function () {
    t.end();
  });
  server.close();
});

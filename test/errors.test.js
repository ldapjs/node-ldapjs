// Copyright 2015 Joyent, Inc.

var test = require('tape').test;

var ldap = require('../lib/index');


///--- Tests

test('basic error', function (t) {
  var msg = 'mymsg';
  var err = new ldap.LDAPError(msg, null, null);
  t.ok(err);
  t.equal(err.name, 'LDAPError');
  t.equal(err.code, ldap.LDAP_OTHER);
  t.equal(err.dn, '');
  t.equal(err.message, msg);
  t.end();
});

test('"custom" errors', function (t) {
  var errors = [
    { name: 'ConnectionError', func: ldap.ConnectionError },
    { name: 'AbandonedError', func: ldap.AbandonedError },
    { name: 'TimeoutError', func: ldap.TimeoutError }
  ];

  errors.forEach(function (entry) {
    var msg = entry.name + 'msg';
    var err = new entry.func(msg);
    t.ok(err);
    t.equal(err.name, entry.name);
    t.equal(err.code, ldap.LDAP_OTHER);
    t.equal(err.dn, '');
    t.equal(err.message, msg);
  });

  t.end();
});

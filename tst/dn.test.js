// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var test = require('tap').test;



///--- Globals

var dn;



///--- Tests

test('load library', function(t) {
  dn = require('../lib/index').dn;
  t.ok(dn);
  t.end();
});


test('parse basic', function(t) {
  var DN_STR = 'cn=mark, ou=people, o=joyent';
  var name = dn.parse(DN_STR);
  t.ok(name);
  t.ok(name.rdns);
  t.ok(Array.isArray(name.rdns));
  t.equal(3, name.rdns.length);
  name.rdns.forEach(function(rdn) {
    t.equal('object', typeof(rdn));
  });
  t.equal(name.toString(), DN_STR);
  t.end();
});


test('parse escaped', function(t) {
  var DN_STR = 'cn=m\\,ark, ou=people, o=joyent';
  var name = dn.parse(DN_STR);
  t.ok(name);
  t.ok(name.rdns);
  t.ok(Array.isArray(name.rdns));
  t.equal(3, name.rdns.length);
  name.rdns.forEach(function(rdn) {
    t.equal('object', typeof(rdn));
  });
  t.equal(name.toString(), DN_STR);
  t.end();
});


test('parse compound', function(t) {
  var DN_STR = 'cn=mark+sn=cavage, ou=people, o=joyent';
  var name = dn.parse(DN_STR);
  t.ok(name);
  t.ok(name.rdns);
  t.ok(Array.isArray(name.rdns));
  t.equal(3, name.rdns.length);
  name.rdns.forEach(function(rdn) {
    t.equal('object', typeof(rdn));
  });
  t.equal(name.toString(), DN_STR);
  t.end();
});


test('parse quoted', function(t) {
  var DN_STR = 'cn="mark+sn=cavage", ou=people, o=joyent';
  var name = dn.parse(DN_STR);
  t.ok(name);
  t.ok(name.rdns);
  t.ok(Array.isArray(name.rdns));
  t.equal(3, name.rdns.length);
  name.rdns.forEach(function(rdn) {
    t.equal('object', typeof(rdn));
  });
  t.equal(name.toString(), DN_STR);
  t.end();
});

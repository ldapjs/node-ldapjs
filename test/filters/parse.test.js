// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var test = require('tape').test;

var parse = require('../../lib/index').parseFilter;



test('GH-48 XML Strings in filter', function (t) {
  var str = '(&(CentralUIEnrollments=\\<mydoc\\>*)(objectClass=User))';
  var f = parse(str);
  t.ok(f);
  t.ok(f.filters);
  t.equal(f.filters.length, 2);
  f.filters.forEach(function (filter) {
    t.ok(filter.attribute);
  });
  t.end();
});


test('GH-50 = in filter', function (t) {
  var str = '(uniquemember=uuid=930896af-bf8c-48d4-885c-6573a94b1853, ' +
    'ou=users, o=smartdc)';
  var f = parse(str);
  t.ok(f);
  t.equal(f.attribute, 'uniquemember');
  t.equal(f.value,
          'uuid=930896af-bf8c-48d4-885c-6573a94b1853, ou=users, o=smartdc');
  t.end();
});


test('( in filter', function (t) {
  var str = '(foo=bar\\()';
  var f = parse(str);
  t.ok(f);
  t.equal(f.attribute, 'foo');
  t.equal(f.value, 'bar(');
  t.equal(f.toString(), '(foo=bar\\28)');
  t.end();
});

test(') in filter', function (t) {
  var str = '(foo=bar\\))';
  var f = parse(str);
  t.ok(f);
  t.equal(f.attribute, 'foo');
  t.equal(f.value, 'bar)');
  t.equal(f.toString(), '(foo=bar\\29)');
  t.end();
});


test('( in filter', function (t) {
  var str = 'foo(bar=baz\\()';
  var f = parse(str);
  t.ok(f);
  t.equal(f.attribute, 'foo(bar');
  t.equal(f.value, 'baz()');
  t.equal(f.toString(), '(foo\\28bar=baz\\28\\29)');
  t.end();
});


test('( in filter', function (t) {
  var str = 'foo)(&(bar=baz)(';
  var f = parse(str);
  t.ok(f);
  t.equal(f.attribute, 'foo)(&(bar');
  t.equal(f.value, 'baz)(');
  t.equal(f.toString(), '(foo\\29\\28&\\28bar=baz\\29\\28)');
  t.end();
});


test('\\ in filter', function (t) {
  var str = '(foo=bar\\\\)';
  var f = parse(str);
  t.ok(f);
  t.equal(f.attribute, 'foo');
  t.equal(f.value, 'bar\\');
  t.equal(f.toString(), '(foo=bar\\5c)');
  t.end();
});


test('* in equality filter', function (t) {
  var str = '(foo=bar\\*)';
  var f = parse(str);
  t.ok(f);
  t.equal(f.attribute, 'foo');
  t.equal(f.value, 'bar*');
  t.equal(f.toString(), '(foo=bar\\2a)');
  t.end();
});


test('* substr filter (prefix)', function (t) {
  var str = '(foo=bar*)';
  var f = parse(str);
  t.ok(f);
  t.equal(f.attribute, 'foo');
  t.equal(f.initial, 'bar');
  t.equal(f.toString(), '(foo=bar*)');
  t.end();
});


test('GH-53 NotFilter', function (t) {
  var str = '(&(objectClass=person)(!(objectClass=shadowAccount)))';
  var f = parse(str);
  t.ok(f);
  t.equal(f.type, 'and');
  t.equal(f.filters.length, 2);
  t.equal(f.filters[0].type, 'equal');
  t.equal(f.filters[1].type, 'not');
  t.equal(f.filters[1].filter.type, 'equal');
  t.equal(f.filters[1].filter.attribute, 'objectClass');
  t.equal(f.filters[1].filter.value, 'shadowAccount');
  t.end();
});


test('presence filter', function (t) {
  var f = parse('(foo=*)');
  t.ok(f);
  t.equal(f.type, 'present');
  t.equal(f.attribute, 'foo');
  t.equal(f.toString(), '(foo=*)');
  t.end();
});


test('bogus filter', function (t) {
  t.throws(function () {
    parse('foo>1');
  });
  t.end();
});


test('bogus filter !=', function (t) {
  t.throws(function () {
    parse('foo!=1');
  });
  t.end();
});


test('mismatched parens', function (t) {
  t.throws(function () {
    parse('(&(foo=bar)(!(state=done))');
  });
  t.end();
});

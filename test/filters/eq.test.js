// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var test = require('tape').test;

var asn1 = require('asn1');


///--- Globals

var EqualityFilter;
var BerReader = asn1.BerReader;
var BerWriter = asn1.BerWriter;



///--- Tests

test('load library', function (t) {
  var filters = require('../../lib/index').filters;
  t.ok(filters);
  EqualityFilter = filters.EqualityFilter;
  t.ok(EqualityFilter);
  t.end();
});


test('Construct no args', function (t) {
  var f = new EqualityFilter();
  t.ok(f);
  t.ok(!f.attribute);
  t.ok(!f.value);
  t.end();
});


test('Construct args', function (t) {
  var f = new EqualityFilter({
    attribute: 'foo',
    value: 'bar'
  });
  t.ok(f);
  t.equal(f.attribute, 'foo');
  t.equal(f.value, 'bar');
  t.equal(f.toString(), '(foo=bar)');
  t.end();
});


test('GH-109 = escape value only in toString()', function (t) {
  var f = new EqualityFilter({
    attribute: 'foo',
    value: 'ba(r)'
  });
  t.ok(f);
  t.equal(f.attribute, 'foo');
  t.equal(f.value, 'ba(r)');
  t.equal(f.toString(), '(foo=ba\\28r\\29)');
  t.end();
});


test('match true', function (t) {
  var f = new EqualityFilter({
    attribute: 'foo',
    value: 'bar'
  });
  t.ok(f);
  t.ok(f.matches({ foo: 'bar' }));
  t.end();
});


test('match multiple', function (t) {
  var f = new EqualityFilter({
    attribute: 'foo',
    value: 'bar'
  });
  t.ok(f);
  t.ok(f.matches({ foo: ['plop', 'bar'] }));
  t.end();
});


test('match false', function (t) {
  var f = new EqualityFilter({
    attribute: 'foo',
    value: 'bar'
  });
  t.ok(f);
  t.ok(!f.matches({ foo: 'baz' }));
  t.end();
});


test('parse ok', function (t) {
  var writer = new BerWriter();
  writer.writeString('foo');
  writer.writeString('bar');

  var f = new EqualityFilter();
  t.ok(f);
  t.ok(f.parse(new BerReader(writer.buffer)));
  t.ok(f.matches({ foo: 'bar' }));
  t.equal(f.attribute, 'foo');
  t.equal(f.value, 'bar');
  t.end();
});


test('escape EqualityFilter inputs', function (t) {
  var f = new EqualityFilter({
    attribute: '(|(foo',
    value: 'bar))('
  });

  t.equal(f.attribute, '(|(foo');
  t.equal(f.value, 'bar))(');
  t.equal(f.toString(), '(\\28|\\28foo=bar\\29\\29\\28)');
  t.end();
});


test('parse bad', function (t) {
  var writer = new BerWriter();
  writer.writeString('foo');
  writer.writeInt(20);

  var f = new EqualityFilter();
  t.ok(f);
  try {
    f.parse(new BerReader(writer.buffer));
    t.fail('Should have thrown InvalidAsn1Error');
  } catch (e) {
    t.equal(e.name, 'InvalidAsn1Error');
  }
  t.end();
});


test('GH-109 = to ber uses plain values', function (t) {
  var f = new EqualityFilter({
    attribute: 'foo',
    value: 'ba(r)'
  });
  t.ok(f);
  var writer = new BerWriter();
  f.toBer(writer);

  f = new EqualityFilter();
  t.ok(f);

  var reader = new BerReader(writer.buffer);
  reader.readSequence();
  t.ok(f.parse(reader));

  t.equal(f.attribute, 'foo');
  t.equal(f.value, 'ba(r)');
  t.end();
});


test('handle values passed via buffer', function (t) {
  var b = new Buffer([32, 64, 128, 254]);
  var f = new EqualityFilter({
    attribute: 'foo',
    value: b
  });
  t.ok(f);

  var writer = new BerWriter();
  f.toBer(writer);
  var reader = new BerReader(writer.buffer);
  reader.readSequence();

  var f2 = new EqualityFilter();
  t.ok(f2.parse(reader));

  t.equal(f2.value, b.toString());
  t.equal(f2.raw.length, b.length);
  for (var i = 0; i < b.length; i++) {
    t.equal(f2.raw[i], b[i]);
  }
  t.end();
});


test('GH-277 objectClass should be case-insensitive', function (t) {
  var f = new EqualityFilter({
    attribute: 'objectClass',
    value: 'CaseInsensitiveObj'
  });
  t.ok(f);
  t.ok(f.matches({ objectClass: 'CaseInsensitiveObj' }));
  t.ok(f.matches({ OBJECTCLASS: 'CASEINSENSITIVEOBJ' }));
  t.ok(f.matches({ objectclass: 'caseinsensitiveobj' }));
  t.ok(!f.matches({ objectclass: 'matchless' }));
  t.end();
});

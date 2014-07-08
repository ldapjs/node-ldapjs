// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var test = require('tape').test;

var asn1 = require('asn1');


///--- Globals

var PresenceFilter;
var BerReader = asn1.BerReader;
var BerWriter = asn1.BerWriter;



///--- Tests

test('load library', function (t) {
  var filters = require('../../lib/index').filters;
  t.ok(filters);
  PresenceFilter = filters.PresenceFilter;
  t.ok(PresenceFilter);
  t.end();
});


test('Construct no args', function (t) {
  var f = new PresenceFilter();
  t.ok(f);
  t.ok(!f.attribute);
  t.end();
});


test('Construct args', function (t) {
  var f = new PresenceFilter({
    attribute: 'foo'
  });
  t.ok(f);
  t.equal(f.attribute, 'foo');
  t.equal(f.toString(), '(foo=*)');
  t.end();
});

test('GH-109 = escape value only in toString()', function (t) {
  var f = new PresenceFilter({
    attribute: 'fo)o'
  });
  t.ok(f);
  t.equal(f.attribute, 'fo)o');
  t.equal(f.toString(), '(fo\\29o=*)');
  t.end();
});


test('match true', function (t) {
  var f = new PresenceFilter({
    attribute: 'foo'
  });
  t.ok(f);
  t.ok(f.matches({ foo: 'bar' }));
  t.end();
});


test('match false', function (t) {
  var f = new PresenceFilter({
    attribute: 'foo'
  });
  t.ok(f);
  t.ok(!f.matches({ bar: 'foo' }));
  t.end();
});


test('parse ok', function (t) {
  var writer = new BerWriter();
  writer.writeString('foo', 0x87);

  var f = new PresenceFilter();
  t.ok(f);

  var reader = new BerReader(writer.buffer);
  reader.readSequence();
  t.ok(f.parse(reader));
  t.ok(f.matches({ foo: 'bar' }));
  t.end();
});


test('GH-109 = to ber uses plain values', function (t) {
  var f = new PresenceFilter({
    attribute: 'f(o)o'
  });
  t.ok(f);
  var writer = new BerWriter();
  f.toBer(writer);

  f = new PresenceFilter();
  t.ok(f);

  var reader = new BerReader(writer.buffer);
  reader.readSequence();
  t.ok(f.parse(reader));

  t.equal(f.attribute, 'f(o)o');
  t.end();
});

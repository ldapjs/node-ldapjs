// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var test = require('tape').test;

var asn1 = require('asn1');


///--- Globals

var BerReader = asn1.BerReader;
var BerWriter = asn1.BerWriter;
var Attribute;


///--- Tests

test('load library', function (t) {
  Attribute = require('../lib/index').Attribute;
  t.ok(Attribute);
  t.end();
});


test('new no args', function (t) {
  t.ok(new Attribute());
  t.end();
});


test('new with args', function (t) {
  var attr = new Attribute({
    type: 'cn',
    vals: ['foo', 'bar']
  });
  t.ok(attr);
  attr.addValue('baz');
  t.equal(attr.type, 'cn');
  t.equal(attr.vals.length, 3);
  t.equal(attr.vals[0], 'foo');
  t.equal(attr.vals[1], 'bar');
  t.equal(attr.vals[2], 'baz');
  t.throws(function () {
    attr = new Attribute('not an object');
  });
  t.throws(function () {
    var typeThatIsNotAString = 1;
    attr = new Attribute({
      type: typeThatIsNotAString
    });
  });
  t.end();
});


test('toBer', function (t) {
  var attr = new Attribute({
    type: 'cn',
    vals: ['foo', 'bar']
  });
  t.ok(attr);
  var ber = new BerWriter();
  attr.toBer(ber);
  var reader = new BerReader(ber.buffer);
  t.ok(reader.readSequence());
  t.equal(reader.readString(), 'cn');
  t.equal(reader.readSequence(), 0x31); // lber set
  t.equal(reader.readString(), 'foo');
  t.equal(reader.readString(), 'bar');
  t.end();
});


test('parse', function (t) {
  var ber = new BerWriter();
  ber.startSequence();
  ber.writeString('cn');
  ber.startSequence(0x31);
  ber.writeStringArray(['foo', 'bar']);
  ber.endSequence();
  ber.endSequence();

  var attr = new Attribute();
  t.ok(attr);
  t.ok(attr.parse(new BerReader(ber.buffer)));

  t.equal(attr.type, 'cn');
  t.equal(attr.vals.length, 2);
  t.equal(attr.vals[0], 'foo');
  t.equal(attr.vals[1], 'bar');
  t.end();
});

test('parse - without 0x31', function (t) {
  var ber = new BerWriter;
  ber.startSequence();
  ber.writeString('sn');
  ber.endSequence();

  var attr = new Attribute;
  t.ok(attr);
  t.ok(attr.parse(new BerReader(ber.buffer)));

  t.equal(attr.type, 'sn');
  t.equal(attr.vals.length, 0);

  t.end();
});

test('toString', function (t) {
  var attr = new Attribute({
    type: 'foobar',
    vals: ['asdf']
  });
  var expected = attr.toString();
  var actual = JSON.stringify(attr.json);
  t.equal(actual, expected);
  t.end();
});

test('isAttribute', function (t) {
  var isA = Attribute.isAttribute;
  t.notOk(isA(null));
  t.notOk(isA('asdf'));
  t.ok(isA(new Attribute({
    type: 'foobar',
    vals: ['asdf']
  })));

  t.ok(isA({
    type: 'foo',
    vals: ['item', new Buffer(5)],
    toBer: function () { /* placeholder */ }
  }));

  // bad type in vals
  t.notOk(isA({
    type: 'foo',
    vals: ['item', null],
    toBer: function () { /* placeholder */ }
  }));

  t.end();
});


test('compare', function (t) {
  var comp = Attribute.compare;
  var a = new Attribute({
    type: 'foo',
    vals: ['bar']
  });
  var b = new Attribute({
    type: 'foo',
    vals: ['bar']
  });
  var notAnAttribute = 'this is not an attribute';

  t.throws(function () {
    comp(a, notAnAttribute);
  });
  t.throws(function () {
    comp(notAnAttribute, b);
  });

  t.equal(comp(a, b), 0);

  // Different types
  a.type = 'boo';
  t.equal(comp(a, b), -1);
  t.equal(comp(b, a), 1);
  a.type = 'foo';

  // Different value counts
  a.vals = ['bar', 'baz'];
  t.equal(comp(a, b), 1);
  t.equal(comp(b, a), -1);

  // Different value contents (same count)
  a.vals = ['baz'];
  t.equal(comp(a, b), 1);
  t.equal(comp(b, a), -1);

  t.end();
});

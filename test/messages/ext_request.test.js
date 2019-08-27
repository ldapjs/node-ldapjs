// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var test = require('tape').test;

var asn1 = require('asn1');

var Buffer = require('buffer').Buffer;

// Buffer.compare was only added on node 0.11.13
var areBuffersEqual = function areBuffersEqual(bufA, bufB) {
    if(!(Buffer.isBuffer(bufA) && Buffer.isBuffer(bufB))) {
      return false;
    }

    if(typeof Buffer.compare === 'function') {
      return Buffer.compare(bufA, bufB) === 0;
    }

    var len = bufA.length;
    if (len !== bufB.length) {
        return false;
    }
    for (var i = 0; i < len; i++) {
        if (bufA.readUInt8(i) !== bufB.readUInt8(i)) {
            return false;
        }
    }
    return true;
};


///--- Globals

var BerReader = asn1.BerReader;
var BerWriter = asn1.BerWriter;
var ExtendedRequest;
var dn;

///--- Tests

test('load library', function (t) {
  ExtendedRequest = require('../../lib/index').ExtendedRequest;
  dn = require('../../lib/index').dn;
  t.ok(ExtendedRequest);
  t.ok(dn);
  t.end();
});


test('new no args', function (t) {
  t.ok(new ExtendedRequest());
  t.end();
});


test('new with args', function (t) {
  var req = new ExtendedRequest({
    requestName: '1.2.3.4',
    requestValue: 'test'
  });
  t.ok(req);
  t.equal(req.requestName, '1.2.3.4');
  t.equal(req.requestValue, 'test');
  t.ok(areBuffersEqual(req.requestValueBuffer, new Buffer('test', 'utf8')));
  t.equal(req.value, 'test');
  t.ok(areBuffersEqual(req.valueBuffer, new Buffer('test', 'utf8')));
  t.end();
});


test('new with buffer args', function (t) {
  var req = new ExtendedRequest({
    requestName: '1.2.3.4',
    requestValue: new Buffer('test', 'utf8')
  });
  t.ok(req);
  t.equal(req.requestName, '1.2.3.4');
  t.equal(req.requestValue, req.requestValueBuffer);
  t.ok(areBuffersEqual(req.requestValueBuffer, new Buffer('test', 'utf8')));
  t.equal(req.value, req.valueBuffer);
  t.ok(areBuffersEqual(req.valueBuffer, new Buffer('test', 'utf8')));
  t.end();
});


test('new no args set args', function (t) {
  var req = new ExtendedRequest();
  t.ok(req);

  req.name = '1.2.3.4';
  t.equal(req.requestName, '1.2.3.4');

  req.value = 'test';
  t.equal(req.requestValue, 'test');
  t.ok(areBuffersEqual(req.requestValueBuffer, new Buffer('test', 'utf8')));
  t.equal(req.value, 'test');
  t.ok(areBuffersEqual(req.valueBuffer, new Buffer('test', 'utf8')));

  t.end();
});


test('new no args set args buffer', function (t) {
  var req = new ExtendedRequest();
  t.ok(req);

  req.name = '1.2.3.4';
  t.equal(req.requestName, '1.2.3.4');

  req.value = new Buffer('test', 'utf8');
  t.equal(req.requestValue, req.requestValueBuffer);
  t.ok(areBuffersEqual(req.requestValueBuffer, new Buffer('test', 'utf8')));
  t.equal(req.value, req.valueBuffer);
  t.ok(areBuffersEqual(req.valueBuffer, new Buffer('test', 'utf8')));

  t.end();
});


test('parse', function (t) {
  var ber = new BerWriter();
  ber.writeString('1.2.3.4', 0x80);
  ber.writeString('test', 0x81);


  var req = new ExtendedRequest();
  t.ok(req._parse(new BerReader(ber.buffer)));
  t.equal(req.requestName, '1.2.3.4');
  t.equal(req.requestValue, 'test');
  t.ok(areBuffersEqual(req.requestValueBuffer, new Buffer('test', 'utf8')));
  t.equal(req.value, 'test');
  t.ok(areBuffersEqual(req.valueBuffer, new Buffer('test', 'utf8')));
  t.end();
});


test('toBer', function (t) {
  var req = new ExtendedRequest({
    messageID: 123,
    requestName: '1.2.3.4',
    requestValue: 'test'
  });

  t.ok(req);

  var ber = new BerReader(req.toBer());
  t.ok(ber);
  t.equal(ber.readSequence(), 0x30);
  t.equal(ber.readInt(), 123);
  t.equal(ber.readSequence(), 0x77);
  t.equal(ber.readString(0x80), '1.2.3.4');
  t.equal(ber.readString(0x81), 'test');

  t.end();
});


test('toBer from buffer', function (t) {
  var req = new ExtendedRequest({
    messageID: 123,
    requestName: '1.2.3.4',
    requestValue: new Buffer('test', 'utf8')
  });

  t.ok(req);

  var ber = new BerReader(req.toBer());
  t.ok(ber);
  t.equal(ber.readSequence(), 0x30);
  t.equal(ber.readInt(), 123);
  t.equal(ber.readSequence(), 0x77);
  t.equal(ber.readString(0x80), '1.2.3.4');
  t.equal(ber.readString(0x81), 'test');

  t.end();
});

// Copyright 2014 Joyent, Inc.  All rights reserved.

var test = require('tape').test;
var logger = Object.create(require('abstract-logging'));

///--- Globals

var lib;
var Parser;

///--- Tests
test('load library', function (t) {
  lib = require('../../lib/');
  Parser = lib.Parser;

  t.ok(Parser);
  t.end();
});

test('wrong protocol error', function (t) {
  var p = new Parser({log: logger});

  p.once('error', function (err) {
    t.ok(err);
    t.end();
  });

  // Send some bogus data to incur an error
  p.write(new Buffer([16, 1, 4]));
});

test('bad protocol op', function (t) {
  var p = new Parser({log: logger});
  var message = new lib.LDAPMessage({
    protocolOp: 254 // bogus (at least today)
  });
  p.once('error', function (err) {
    t.ok(err);
    t.ok(/not supported$/.test(err.message));
    t.end();
  });
  p.write(message.toBer());
});

test('bad message structure', function (t) {
  var p = new Parser({log: logger});

  // message with bogus structure
  var message = new lib.LDAPMessage({
    protocolOp: lib.LDAP_REQ_EXTENSION
  });
  message._toBer = function (writer) {
    writer.writeBuffer(new Buffer([16, 1, 4]), 80);
    return writer;
  };

  p.once('error', function (err) {
    t.ok(err);
    t.end();
  });

  p.write(message.toBer());
});

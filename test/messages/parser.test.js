// Copyright 2014 Joyent, Inc.  All rights reserved.

var test = require('tape').test;
var bunyan = require('bunyan');

///--- Globals

var lib;
var Parser;
var LOG = bunyan.createLogger({name: 'ldapjs-test'});

///--- Tests
test('load library', function (t) {
  lib = require('../../lib/');
  Parser = lib.Parser;

  t.ok(Parser);
  t.end();
});

test('wrong protocol error', function (t) {
  var p = new Parser({log: LOG});

  p.once('error', function (err) {
    t.ok(err);
    t.end();
  });

  // Send some bogus data to incur an error
  p.write(new Buffer([16, 1, 4]));
});

test('bad protocol op', function (t) {
  var p = new Parser({log: LOG});
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
  var p = new Parser({log: LOG});

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

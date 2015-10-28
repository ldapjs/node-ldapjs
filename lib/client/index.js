// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');

var Logger = require('bunyan');

var Client = require('./client');


///--- Globals

var DEF_LOG = new Logger({
  name: 'ldapjs',
  component: 'client',
  stream: process.stderr,
  serializers: Logger.stdSerializers
});


///--- Functions

function xor() {
  var b = false;
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] && !b) {
      b = true;
    } else if (arguments[i] && b) {
      return false;
    }
  }
  return b;
}



///--- Exports

module.exports = {
  Client: Client,
  createClient: function createClient(options) {
    if (typeof (options) !== 'object')
      throw new TypeError('options (object) required');
    if (options.url && typeof (options.url) !== 'string')
      throw new TypeError('options.url (string) required');
    if (options.socketPath && typeof (options.socketPath) !== 'string')
      throw new TypeError('options.socketPath must be a string');
    if (!xor(options.url, options.socketPath))
      throw new TypeError('options.url ^ options.socketPath (String) required');
    if (!options.log)
      options.log = DEF_LOG;
    if (typeof (options.log) !== 'object')
      throw new TypeError('options.log must be an object');

    return new Client(options);
  }
};

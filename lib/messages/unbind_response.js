// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var LDAPMessage = require('./result');
var Protocol = require('../protocol');


///--- API
// Ok, so there's really no such thing as an unbind 'response', but to make
// the framework not suck, I just made this up, and have it stubbed so it's
// not such a one-off.

function UnbindResponse(options) {
  if (!options)
    options = {};
  if (typeof(options) !== 'object')
    throw new TypeError('options must be an object');

  options.protocolOp = 0;
  LDAPMessage.call(this, options);
  this.__defineGetter__('type', function() { return 'UnbindResponse'; });
}
util.inherits(UnbindResponse, LDAPMessage);
module.exports = UnbindResponse;


/**
 * Special override that just ends the connection, if present.
 *
 * @param {Number} status completely ignored.
 */
UnbindResponse.prototype.end = function(status) {
  assert.ok(this.connection);

  if (this.log.isTraceEnabled())
    this.log.trace('%s: unbinding!', this.connection.ldap.id);

  this.connection.end();
};


UnbindResponse.prototype._json = function(j) {
  return j;
};

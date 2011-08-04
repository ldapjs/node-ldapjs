// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var LDAPResult = require('./result');
var SearchEntry = require('./search_entry');

var Protocol = require('../protocol');



///--- API

function SearchResponse(options) {
  if (!options)
    options = {};
  if (typeof(options) !== 'object')
    throw new TypeError('options must be an object');

  options.protocolOp = Protocol.LDAP_REP_SEARCH;
  LDAPResult.call(this, options);
}
util.inherits(SearchResponse, LDAPResult);
module.exports = SearchResponse;


/**
 * Allows you to send a SearchEntry back to the client.
 *
 * @param {Object} entry an instance of SearchEntry.
 */
SearchResponse.prototype.send = function(entry) {
  if (!entry || !(entry instanceof SearchEntry))
    throw new TypeError('entry (SearchEntry) required');
  if (entry.messageID !== this.messageID)
    throw new Error('SearchEntry messageID mismatch');

  assert.ok(this.connection);

  if (this.log.isDebugEnabled())
    this.log.debug('%s: sending:  %j', this.connection.ldap.id, entry.json);

  this.connection.write(entry.toBer());
};


SearchResponse.prototype.createSearchEntry = function(options) {
  if (options) {
    if (typeof(options) !== 'object')
      throw new TypeError('options must be an object');
  } else {
    options = {};
  }

  options.messageID = this.messageID;
  options.log4js = this.log4js;

  return new SearchEntry(options);
};

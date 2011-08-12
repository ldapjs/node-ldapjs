// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var LDAPResult = require('./result');
var SearchEntry = require('./search_entry');

var parseDN = require('../dn').parse;
var Protocol = require('../protocol');



///--- API

function SearchResponse(options) {
  if (!options)
    options = {};
  if (typeof(options) !== 'object')
    throw new TypeError('options must be an object');

  options.protocolOp = Protocol.LDAP_REP_SEARCH;
  LDAPResult.call(this, options);

  this.attributes = options.attributes ? options.attributes.slice() : [];
  this.notAttributes = [];
}
util.inherits(SearchResponse, LDAPResult);
module.exports = SearchResponse;


/**
 * Allows you to send a SearchEntry back to the client.
 *
 * @param {Object} entry an instance of SearchEntry.
 */
SearchResponse.prototype.send = function(entry) {
  if (!entry || typeof(entry) !== 'object')
    throw new TypeError('entry (SearchEntry) required');

  var self = this;

  if (!(entry instanceof SearchEntry)) {
    if (!entry.dn)
      throw new Error('entry.dn required');
    if (!entry.attributes)
      throw new Error('entry.attributes required');

    var save = entry;

    // Rip out anything that either the client didn't ask for, the server
    // wants to strip, or 'private' vars that are prefixed with '_'
    Object.keys(entry.attributes).forEach(function(a) {
      if ((self.attributes.length && self.attributes.indexOf(a) === -1) ||
          (self.notAttributes.length && self.notAttributes.indexOf(a) !== -1) ||
          (a.length && a.charAt(0) === '_')) {
        delete entry.attributes[a];
      }
    });

    entry = new SearchEntry({
      objectName: typeof(save.dn) === 'string' ? parseDN(save.dn) : save.dn,
      messageID: self.messageID,
      log4js: self.log4js
    });
    entry.fromObject(save);
  } else {
    if (!entry.messageID)
      entry.messageID = this.messageID;
    if (entry.messageID !== this.messageID)
      throw new Error('SearchEntry messageID mismatch');
  }

  try {
    if (this.log.isDebugEnabled())
      this.log.debug('%s: sending:  %j', this.connection.ldap.id, entry.json);

    this.connection.write(entry.toBer());
  } catch (e) {
    this.log.warn('%s failure to write message %j: %s',
                  this.connection.ldap.id, this.json, e.toString());
  }

};


SearchResponse.prototype.createSearchEntry = function(object) {
  if (!object || typeof(object) !== 'object')
    throw new TypeError('object required');

  var self = this;

  var entry = new SearchEntry({
    messageID: self.messageID,
    log4js: self.log4js,
    objectName: object.objectName || object.dn
  });
  entry.fromObject((object.attributes || object));

  return entry;
};

// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var LDAPResult = require('./result');
var SearchEntry = require('./search_entry');
var SearchReference = require('./search_reference');

var parseDN = require('../dn').parse;
var parseURL = require('../url').parse;
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
  this.sentEntries = 0;
}
util.inherits(SearchResponse, LDAPResult);
module.exports = SearchResponse;


/**
 * Allows you to send a SearchEntry back to the client.
 *
 * @param {Object} entry an instance of SearchEntry.
 * @param {Boolean} nofiltering skip filtering notAttributes and '_' attributes.
 *                  Defaults to 'false'.
 */
SearchResponse.prototype.send = function(entry, nofiltering) {
  if (!entry || typeof(entry) !== 'object')
    throw new TypeError('entry (SearchEntry) required');
  if (nofiltering === undefined)
    nofiltering = false;
  if (typeof(nofiltering) !== 'boolean')
    throw new TypeError('noFiltering must be a boolean');

  var self = this;

  if (entry instanceof SearchEntry || entry instanceof SearchReference) {
    if (!entry.messageID)
      entry.messageID = this.messageID;
    if (entry.messageID !== this.messageID)
      throw new Error('SearchEntry messageID mismatch');
  } else {
    if (!entry.attributes)
      throw new Error('entry.attributes required');

    var all = (self.attributes.indexOf('*') !== -1);
    Object.keys(entry.attributes).forEach(function(a) {
      var _a = a.toLowerCase();
      if (!nofiltering && _a.length && _a[0] === '_') {
        delete entry.attributes[a];
      } else if (!nofiltering && self.notAttributes.indexOf(_a) !== -1) {
        delete entry.attributes[a];
      } else if (all) {
        // noop
      } else if (self.attributes.length && self.attributes.indexOf(_a) === -1) {
        delete entry.attributes[a];
      }
    });

    var save = entry;
    entry = new SearchEntry({
      objectName: typeof(save.dn) === 'string' ? parseDN(save.dn) : save.dn,
      messageID: self.messageID,
      log4js: self.log4js
    });
    entry.fromObject(save);
  }

  try {
    if (this.log.isDebugEnabled())
      this.log.debug('%s: sending:  %j', this.connection.ldap.id, entry.json);

    this.connection.write(entry.toBer());
    this.sentEntries++;
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


SearchResponse.prototype.createSearchReference = function(uris) {
  if (!uris)
    throw new TypeError('uris ([string]) required');

  if (!Array.isArray(uris))
    uris = [uris];

  for (var i = 0; i < uris.length; i++) {
    if (typeof(uris[i]) == 'string')
      uris[i] = parseURL(uris[i]);
  }

  var self = this;
  return new SearchReference({
    messageID: self.messageID,
    log4js: self.log4js,
    uris: uris
  });
};

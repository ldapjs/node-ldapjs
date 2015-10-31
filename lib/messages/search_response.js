// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var util = require('util');

var LDAPResult = require('./result');
var SearchEntry = require('./search_entry');
var SearchReference = require('./search_reference');

var dtrace = require('../dtrace');
var parseDN = require('../dn').parse;
var parseURL = require('../url').parse;
var Protocol = require('../protocol');


///--- API

function SearchResponse(options) {
  options = options || {};
  assert.object(options);

  options.protocolOp = Protocol.LDAP_REP_SEARCH;
  LDAPResult.call(this, options);

  this.attributes = options.attributes ? options.attributes.slice() : [];
  this.notAttributes = [];
  this.sentEntries = 0;
}
util.inherits(SearchResponse, LDAPResult);

/**
 * Allows you to send a SearchEntry back to the client.
 *
 * @param {Object} entry an instance of SearchEntry.
 * @param {Boolean} nofiltering skip filtering notAttributes and '_' attributes.
 *                  Defaults to 'false'.
 */
SearchResponse.prototype.send = function (entry, nofiltering) {
  if (!entry || typeof (entry) !== 'object')
    throw new TypeError('entry (SearchEntry) required');
  if (nofiltering === undefined)
    nofiltering = false;
  if (typeof (nofiltering) !== 'boolean')
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

    var savedAttrs = {};
    var all = (self.attributes.indexOf('*') !== -1);
    Object.keys(entry.attributes).forEach(function (a) {
      var _a = a.toLowerCase();
      if (!nofiltering && _a.length && _a[0] === '_') {
        savedAttrs[a] = entry.attributes[a];
        delete entry.attributes[a];
      } else if (!nofiltering && self.notAttributes.indexOf(_a) !== -1) {
        savedAttrs[a] = entry.attributes[a];
        delete entry.attributes[a];
      } else if (all) {
        return;
      } else if (self.attributes.length && self.attributes.indexOf(_a) === -1) {
        savedAttrs[a] = entry.attributes[a];
        delete entry.attributes[a];
      }
    });

    var save = entry;
    entry = new SearchEntry({
      objectName: typeof (save.dn) === 'string' ? parseDN(save.dn) : save.dn,
      messageID: self.messageID,
      log: self.log
    });
    entry.fromObject(save);
  }

  try {
    if (this.log.debug())
      this.log.debug('%s: sending:  %j', this.connection.ldap.id, entry.json);

    this.connection.write(entry.toBer());
    this.sentEntries++;

    if (self._dtraceOp && self._dtraceId) {
      dtrace.fire('server-search-entry', function () {
        var c = self.connection || {ldap: {}};
        return [
          self._dtraceId || 0,
          (c.remoteAddress || ''),
          c.ldap.bindDN ? c.ldap.bindDN.toString() : '',
          (self.requestDN ? self.requestDN.toString() : ''),
          entry.objectName.toString(),
          entry.attributes.length
        ];
      });
    }

    // Restore attributes
    Object.keys(savedAttrs || {}).forEach(function (k) {
      save.attributes[k] = savedAttrs[k];
    });

  } catch (e) {
    this.log.warn(e, '%s failure to write message %j',
                  this.connection.ldap.id, this.json);
  }
};

SearchResponse.prototype.createSearchEntry = function (object) {
  assert.object(object);

  var entry = new SearchEntry({
    messageID: this.messageID,
    log: this.log,
    objectName: object.objectName || object.dn
  });
  entry.fromObject((object.attributes || object));
  return entry;
};

SearchResponse.prototype.createSearchReference = function (uris) {
  if (!uris)
    throw new TypeError('uris ([string]) required');

  if (!Array.isArray(uris))
    uris = [uris];

  for (var i = 0; i < uris.length; i++) {
    if (typeof (uris[i]) == 'string')
      uris[i] = parseURL(uris[i]);
  }

  var self = this;
  return new SearchReference({
    messageID: self.messageID,
    log: self.log,
    uris: uris
  });
};


///--- Exports

module.exports = SearchResponse;

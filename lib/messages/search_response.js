// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const LDAPResult = require('./result')
const SearchEntry = require('./search_entry')
const SearchReference = require('./search_reference')

const dtrace = require('../dtrace')
const parseDN = require('../dn').parse
const parseURL = require('../url').parse
const Protocol = require('../protocol')

/// --- API

function SearchResponse (options) {
  options = options || {}
  assert.object(options)

  options.protocolOp = Protocol.LDAP_REP_SEARCH
  LDAPResult.call(this, options)

  this.attributes = options.attributes ? options.attributes.slice() : []
  this.notAttributes = []
  this.sentEntries = 0
}
util.inherits(SearchResponse, LDAPResult)

/**
 * Allows you to send a SearchEntry back to the client.
 *
 * @param {Object} entry an instance of SearchEntry.
 * @param {Boolean} nofiltering skip filtering notAttributes and '_' attributes.
 *                  Defaults to 'false'.
 */
SearchResponse.prototype.send = function (entry, nofiltering) {
  if (!entry || typeof (entry) !== 'object') { throw new TypeError('entry (SearchEntry) required') }
  if (nofiltering === undefined) { nofiltering = false }
  if (typeof (nofiltering) !== 'boolean') { throw new TypeError('noFiltering must be a boolean') }

  const self = this

  const savedAttrs = {}
  let save = null
  if (entry instanceof SearchEntry || entry instanceof SearchReference) {
    if (!entry.messageID) { entry.messageID = this.messageID }
    if (entry.messageID !== this.messageID) { throw new Error('SearchEntry messageID mismatch') }
  } else {
    if (!entry.attributes) { throw new Error('entry.attributes required') }

    const all = (self.attributes.indexOf('*') !== -1)
    Object.keys(entry.attributes).forEach(function (a) {
      const _a = a.toLowerCase()
      if (!nofiltering && _a.length && _a[0] === '_') {
        savedAttrs[a] = entry.attributes[a]
        delete entry.attributes[a]
      } else if (!nofiltering && self.notAttributes.indexOf(_a) !== -1) {
        savedAttrs[a] = entry.attributes[a]
        delete entry.attributes[a]
      } else if (all) {
        // do nothing
      } else if (self.attributes.length && self.attributes.indexOf(_a) === -1) {
        savedAttrs[a] = entry.attributes[a]
        delete entry.attributes[a]
      }
    })

    save = entry
    entry = new SearchEntry({
      objectName: typeof (save.dn) === 'string' ? parseDN(save.dn) : save.dn,
      messageID: self.messageID,
      log: self.log
    })
    entry.fromObject(save)
  }

  try {
    this.log.debug('%s: sending:  %j', this.connection.ldap.id, entry.json)

    this.connection.write(entry.toBer())
    this.sentEntries++

    if (self._dtraceOp && self._dtraceId) {
      dtrace.fire('server-search-entry', function () {
        const c = self.connection || { ldap: {} }
        return [
          self._dtraceId || 0,
          (c.remoteAddress || ''),
          c.ldap.bindDN ? c.ldap.bindDN.toString() : '',
          (self.requestDN ? self.requestDN.toString() : ''),
          entry.objectName.toString(),
          entry.attributes.length
        ]
      })
    }

    // Restore attributes
    Object.keys(savedAttrs).forEach(function (k) {
      save.attributes[k] = savedAttrs[k]
    })
  } catch (e) {
    this.log.warn(e, '%s failure to write message %j',
      this.connection.ldap.id, this.json)
  }
}

SearchResponse.prototype.createSearchEntry = function (object) {
  assert.object(object)

  const entry = new SearchEntry({
    messageID: this.messageID,
    log: this.log,
    objectName: object.objectName || object.dn
  })
  entry.fromObject((object.attributes || object))
  return entry
}

SearchResponse.prototype.createSearchReference = function (uris) {
  if (!uris) { throw new TypeError('uris ([string]) required') }

  if (!Array.isArray(uris)) { uris = [uris] }

  for (let i = 0; i < uris.length; i++) {
    if (typeof (uris[i]) === 'string') { uris[i] = parseURL(uris[i]) }
  }

  const self = this
  return new SearchReference({
    messageID: self.messageID,
    log: self.log,
    uris: uris
  })
}

/// --- Exports

module.exports = SearchResponse

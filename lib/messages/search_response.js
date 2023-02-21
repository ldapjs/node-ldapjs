// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')

const Attribute = require('@ldapjs/attribute')
const {
  SearchResultEntry: SearchEntry,
  SearchResultReference: SearchReference,
  SearchResultDone
} = require('@ldapjs/messages')

const parseDN = require('@ldapjs/dn').DN.fromString

/// --- API

class SearchResponse extends SearchResultDone {
  attributes
  notAttributes
  sentEntries

  constructor (options = {}) {
    super(options)

    this.attributes = options.attributes ? options.attributes.slice() : []
    this.notAttributes = []
    this.sentEntries = 0
  }
}

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
    if (!entry.messageId) { entry.messageId = this.messageId }
    if (entry.messageId !== this.messageId) {
      throw new Error('SearchEntry messageId mismatch')
    }
  } else {
    if (!entry.attributes) { throw new Error('entry.attributes required') }

    const all = (self.attributes.indexOf('*') !== -1)
    // Filter attributes in a plain object according to the magic `_` prefix
    // and presence in `notAttributes`.
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
      messageId: self.messageId,
      attributes: Attribute.fromObject(entry.attributes)
    })
  }

  try {
    this.log.debug('%s: sending:  %j', this.connection.ldap.id, entry.pojo)

    this.connection.write(entry.toBer().buffer)
    this.sentEntries++

    // Restore attributes
    Object.keys(savedAttrs).forEach(function (k) {
      save.attributes[k] = savedAttrs[k]
    })
  } catch (e) {
    this.log.warn(e, '%s failure to write message %j',
      this.connection.ldap.id, this.pojo)
  }
}

SearchResponse.prototype.createSearchEntry = function (object) {
  assert.object(object)

  const entry = new SearchEntry({
    messageId: this.messageId,
    objectName: object.objectName || object.dn,
    attributes: object.attributes ?? []
  })
  return entry
}

SearchResponse.prototype.createSearchReference = function (uris) {
  if (!uris) { throw new TypeError('uris ([string]) required') }

  if (!Array.isArray(uris)) { uris = [uris] }

  const self = this
  return new SearchReference({
    messageId: self.messageId,
    uri: uris
  })
}

/// --- Exports

module.exports = SearchResponse

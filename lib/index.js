// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const logger = require('./logger')

const client = require('./client')
const Attribute = require('@ldapjs/attribute')
const Change = require('@ldapjs/change')
const Protocol = require('@ldapjs/protocol')
const Server = require('./server')

const controls = require('./controls')
const persistentSearch = require('./persistent_search')
const dn = require('@ldapjs/dn')
const errors = require('./errors')
const filters = require('@ldapjs/filter')
const messages = require('./messages')
const url = require('./url')

const hasOwnProperty = (target, val) => Object.prototype.hasOwnProperty.call(target, val)

/// --- API

module.exports = {
  Client: client.Client,
  createClient: client.createClient,

  Server,
  createServer: function (options) {
    if (options === undefined) { options = {} }

    if (typeof (options) !== 'object') { throw new TypeError('options (object) required') }

    if (!options.log) {
      options.log = logger
    }

    return new Server(options)
  },

  Attribute,
  Change,

  dn,
  DN: dn.DN,
  RDN: dn.RDN,
  parseDN: dn.DN.fromString,

  persistentSearch,
  PersistentSearchCache: persistentSearch.PersistentSearchCache,

  filters,
  parseFilter: filters.parseString,

  url,
  parseURL: url.parse
}

/// --- Export all the childrenz

let k

for (k in Protocol) {
  if (hasOwnProperty(Protocol, k)) { module.exports[k] = Protocol[k] }
}

for (k in messages) {
  if (hasOwnProperty(messages, k)) { module.exports[k] = messages[k] }
}

for (k in controls) {
  if (hasOwnProperty(controls, k)) { module.exports[k] = controls[k] }
}

for (k in filters) {
  if (hasOwnProperty(filters, k)) {
    if (k !== 'parse' && k !== 'parseString') { module.exports[k] = filters[k] }
  }
}

for (k in errors) {
  if (hasOwnProperty(errors, k)) {
    module.exports[k] = errors[k]
  }
}

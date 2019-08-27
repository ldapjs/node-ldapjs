// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

const logger = require('../logger')
const Client = require('./client')

/// --- Functions

function xor () {
  var b = false
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] && !b) {
      b = true
    } else if (arguments[i] && b) {
      return false
    }
  }
  return b
}

/// --- Exports

module.exports = {
  Client: Client,
  createClient: function createClient (options) {
    if (typeof (options) !== 'object') { throw new TypeError('options (object) required') }
    if (options.url && typeof (options.url) !== 'string') { throw new TypeError('options.url (string) required') }
    if (options.socketPath && typeof (options.socketPath) !== 'string') { throw new TypeError('options.socketPath must be a string') }
    if (!xor(options.url, options.socketPath)) { throw new TypeError('options.url ^ options.socketPath (String) required') }
    if (!options.log) { options.log = logger }
    if (!options.log.child) { options.log.child = function () { return options.log } }
    if (typeof (options.log) !== 'object') { throw new TypeError('options.log must be an object') }

    return new Client(options)
  }
}

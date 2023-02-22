'use strict'

const logger = require('../logger')
const Client = require('./client')

module.exports = {
  Client,
  createClient: function createClient (options) {
    if (isObject(options) === false) throw TypeError('options (object) required')
    if (options.url && typeof options.url !== 'string' && !Array.isArray(options.url)) throw TypeError('options.url (string|array) required')
    if (options.socketPath && typeof options.socketPath !== 'string') throw TypeError('options.socketPath must be a string')
    if ((options.url && options.socketPath) || !(options.url || options.socketPath)) throw TypeError('options.url ^ options.socketPath (String) required')
    if (!options.log) options.log = logger
    if (isObject(options.log) !== true) throw TypeError('options.log must be an object')
    if (!options.log.child) options.log.child = function () { return options.log }

    return new Client(options)
  }
}

function isObject (input) {
  return Object.prototype.toString.apply(input) === '[object Object]'
}

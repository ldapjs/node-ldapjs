// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const EventEmitter = require('events').EventEmitter
const util = require('util')

const assert = require('assert-plus')
const asn1 = require('asn1')
// var VError = require('verror').VError
const logger = require('../logger')

const AbandonRequest = require('./abandon_request')
const AddRequest = require('./add_request')
const AddResponse = require('./add_response')
const BindRequest = require('./bind_request')
const BindResponse = require('./bind_response')
const CompareRequest = require('./compare_request')
const CompareResponse = require('./compare_response')
const DeleteRequest = require('./del_request')
const DeleteResponse = require('./del_response')
const ExtendedRequest = require('./ext_request')
const ExtendedResponse = require('./ext_response')
const ModifyRequest = require('./modify_request')
const ModifyResponse = require('./modify_response')
const ModifyDNRequest = require('./moddn_request')
const ModifyDNResponse = require('./moddn_response')
const SearchRequest = require('./search_request')
const SearchEntry = require('./search_entry')
const SearchReference = require('./search_reference')
const SearchResponse = require('./search_response')
const UnbindRequest = require('./unbind_request')
// var UnbindResponse = require('./unbind_response')

const LDAPResult = require('./result')
// var Message = require('./message')

const Protocol = require('../protocol')

/// --- Globals

// var Ber = asn1.Ber
const BerReader = asn1.BerReader

/// --- API

function Parser (options = {}) {
  assert.object(options)

  EventEmitter.call(this)

  this.buffer = null
  this.log = options.log || logger
}
util.inherits(Parser, EventEmitter)

Parser.prototype.write = function (data) {
  if (!data || !Buffer.isBuffer(data)) { throw new TypeError('data (buffer) required') }

  let nextMessage = null
  const self = this

  function end () {
    if (nextMessage) { return self.write(nextMessage) }

    return true
  }

  self.buffer = (self.buffer ? Buffer.concat([self.buffer, data]) : data)

  const ber = new BerReader(self.buffer)

  let foundSeq = false
  try {
    foundSeq = ber.readSequence()
  } catch (e) {
    this.emit('error', e)
  }

  if (!foundSeq || ber.remain < ber.length) {
    // ENOTENOUGH
    return false
  } else if (ber.remain > ber.length) {
    // ETOOMUCH
    // This is sort of ugly, but allows us to make miminal copies
    nextMessage = self.buffer.slice(ber.offset + ber.length)
    ber._size = ber.offset + ber.length
    assert.equal(ber.remain, ber.length)
  }

  // If we're here, ber holds the message, and nextMessage is temporarily
  // pointing at the next sequence of data (if it exists)
  self.buffer = null

  let message
  try {
    // Bail here if peer isn't speaking protocol at all
    message = this.getMessage(ber)

    if (!message) {
      return end()
    }
    message.parse(ber)
  } catch (e) {
    this.emit('error', e, message)
    return false
  }

  this.emit('message', message)
  return end()
}

Parser.prototype.getMessage = function (ber) {
  assert.ok(ber)

  const self = this

  const messageID = ber.readInt()
  const type = ber.readSequence()

  let Message
  switch (type) {
    case Protocol.LDAP_REQ_ABANDON:
      Message = AbandonRequest
      break

    case Protocol.LDAP_REQ_ADD:
      Message = AddRequest
      break

    case Protocol.LDAP_REP_ADD:
      Message = AddResponse
      break

    case Protocol.LDAP_REQ_BIND:
      Message = BindRequest
      break

    case Protocol.LDAP_REP_BIND:
      Message = BindResponse
      break

    case Protocol.LDAP_REQ_COMPARE:
      Message = CompareRequest
      break

    case Protocol.LDAP_REP_COMPARE:
      Message = CompareResponse
      break

    case Protocol.LDAP_REQ_DELETE:
      Message = DeleteRequest
      break

    case Protocol.LDAP_REP_DELETE:
      Message = DeleteResponse
      break

    case Protocol.LDAP_REQ_EXTENSION:
      Message = ExtendedRequest
      break

    case Protocol.LDAP_REP_EXTENSION:
      Message = ExtendedResponse
      break

    case Protocol.LDAP_REQ_MODIFY:
      Message = ModifyRequest
      break

    case Protocol.LDAP_REP_MODIFY:
      Message = ModifyResponse
      break

    case Protocol.LDAP_REQ_MODRDN:
      Message = ModifyDNRequest
      break

    case Protocol.LDAP_REP_MODRDN:
      Message = ModifyDNResponse
      break

    case Protocol.LDAP_REQ_SEARCH:
      Message = SearchRequest
      break

    case Protocol.LDAP_REP_SEARCH_ENTRY:
      Message = SearchEntry
      break

    case Protocol.LDAP_REP_SEARCH_REF:
      Message = SearchReference
      break

    case Protocol.LDAP_REP_SEARCH:
      Message = SearchResponse
      break

    case Protocol.LDAP_REQ_UNBIND:
      Message = UnbindRequest
      break

    default:
      this.emit('error',
        new Error('Op 0x' + (type ? type.toString(16) : '??') +
                        ' not supported'),
        new LDAPResult({
          messageID: messageID,
          protocolOp: type || Protocol.LDAP_REP_EXTENSION
        }))

      return false
  }

  return new Message({
    messageID: messageID,
    log: self.log
  })
}

/// --- Exports

module.exports = Parser

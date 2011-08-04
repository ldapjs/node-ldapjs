// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var asn1 = require('asn1');

var AddRequest = require('./add_request');
var AddResponse = require('./add_response');
var BindRequest = require('./bind_request');
var BindResponse = require('./bind_response');
var CompareRequest = require('./compare_request');
var CompareResponse = require('./compare_response');
var DeleteRequest = require('./del_request');
var DeleteResponse = require('./del_response');
var ExtendedRequest = require('./ext_request');
var ExtendedResponse = require('./ext_response');
var ModifyRequest = require('./modify_request');
var ModifyResponse = require('./modify_response');
var ModifyDNRequest = require('./moddn_request');
var ModifyDNResponse = require('./moddn_response');
var SearchRequest = require('./search_request');
var SearchEntry = require('./search_entry');
var SearchResponse = require('./search_response');
var UnbindRequest = require('./unbind_request');
var UnbindResponse = require('./unbind_response');
var Message = require('./message');

var Protocol = require('../protocol');

// Just make sure this adds to the prototype
require('buffertools');



///--- Globals

var Ber = asn1.Ber;
var BerReader = asn1.BerReader;



///--- API

function Parser(options) {
  if (!options || typeof(options) !== 'object')
    throw new TypeError('options (object) required');
  if (!options.log4js || typeof(options.log4js) !== 'object')
    throw new TypeError('options.log4js (object) required');

  EventEmitter.call(this);

  this._reset();

  var self = this;
  this.log4js = options.log4js;
  this.log = this.log4js.getLogger('Parser');
}
util.inherits(Parser, EventEmitter);
module.exports = Parser;


Parser.prototype.write = function(data) {
  if (!data || !Buffer.isBuffer(data))
    throw new TypeError('data (buffer) required');

  var self = this;

  if (this._buffer)
    data = this._buffer.concat(data);

  if (this.log.isTraceEnabled())
    this.log.trace('Processing buffer (concat\'d): ' + util.inspect(data));

  // If there's more than one message in this buffer
  var extra;

  try {
    if (this._message === null) {
      var ber = new BerReader(data);
      if (!this._newMessage(ber))
        return false;

      data = data.slice(ber.offset);
    }

    if (data.length > this._messageLength) {
      extra = data.slice(ber.length);
      data = data.slice(0, ber.length);
    }

    if (!this._message.parse(data, ber.length))
      this.emit('protocolError', new Error('TODO'));

    var message = this._message;
    this._reset();
    this.emit('message', message);

  } catch (e) {
    if (e.name === 'InvalidAsn1Error') {
      self.emit('protocolError', e, self._message);
    } else {
      self.emit('error', e);
    }
    return false;
  }

  // Another message is already there
  if (extra) {
    if (this.log.isTraceEnabled())
      this.log.trace('parsing extra bytes: ' + util.inspect(extra));

    return this.write(extra);
  }

  return true;
};


Parser.prototype._newMessage = function(ber) {
  assert.ok(ber);

  if (this._messageLength === null) {
    if (ber.readSequence() === null) { // not enough data for the length?
      this._buffer = ber.buffer;
      if (this.log.isTraceEnabled())
        this.log.trace('Not enough data for the message header');

      return false;
    }
    this._messageLength = ber.length;

  }

  if (ber.remain < this._messageLength) {
    if (this.log.isTraceEnabled())
      this.log.trace('Not enough data for the message');

    this._buffer = ber.buffer;
    return false;
  }

  var messageID = ber.readInt();
  var type = ber.readSequence();

  if (this.log.isTraceEnabled())
    this.log.trace('message id=%d, type=0x%s', messageID, type.toString(16));

  var Message;
  switch (type) {

  case Protocol.LDAP_REQ_ADD:
    Message = AddRequest;
    break;

  case Protocol.LDAP_REP_ADD:
    Message = AddResponse;
    break;

  case Protocol.LDAP_REQ_BIND:
    Message = BindRequest;
    break;

  case Protocol.LDAP_REP_BIND:
    Message = BindResponse;
    break;

  case Protocol.LDAP_REQ_COMPARE:
    Message = CompareRequest;
    break;

  case Protocol.LDAP_REP_COMPARE:
    Message = CompareResponse;
    break;

  case Protocol.LDAP_REQ_DELETE:
    Message = DeleteRequest;
    break;

  case Protocol.LDAP_REP_DELETE:
    Message = DeleteResponse;
    break;

  case Protocol.LDAP_REQ_EXTENSION:
    Message = ExtendedRequest;
    break;

  case Protocol.LDAP_REP_EXTENSION:
    Message = ExtendedResponse;
    break;

  case Protocol.LDAP_REQ_MODIFY:
    Message = ModifyRequest;
    break;

  case Protocol.LDAP_REP_MODIFY:
    Message = ModifyResponse;
    break;

  case Protocol.LDAP_REQ_MODRDN:
    Message = ModifyDNRequest;
    break;

  case Protocol.LDAP_REP_MODRDN:
    Message = ModifyDNResponse;
    break;

  case Protocol.LDAP_REQ_SEARCH:
    Message = SearchRequest;
    break;

  case Protocol.LDAP_REP_SEARCH_ENTRY:
    Message = SearchEntry;
    break;

  case Protocol.LDAP_REP_SEARCH:
    Message = SearchResponse;
    break;

  case Protocol.LDAP_REQ_UNBIND:
    Message = UnbindRequest;
    break;

  default:
    var e = new Error('protocolOp 0x' + type.toString(16) + ' not supported');
    this.emit('protocolError', e, messageID);
    this._reset();
    return false;
  }
  assert.ok(Message);

  var self = this;
  this._message = new Message({
    messageID: messageID,
    log4js: self.log4js
  });

  return true;
};


Parser.prototype._reset = function() {
  this._message = null;
  this._messageLength = null;
  this._buffer = null;
};

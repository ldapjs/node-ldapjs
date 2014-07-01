var assert = require('assert');
var util = require('util');

var asn1 = require('asn1');

var Control = require('./control');

var CODES = require('../errors/codes');



///--- Globals

var BerReader = asn1.BerReader;
var BerWriter = asn1.BerWriter;

var VALID_CODES = [
  CODES.LDAP_SUCCESS,
  CODES.LDAP_OPERATIONS_ERROR,
  CODES.LDAP_TIME_LIMIT_EXCEEDED,
  CODES.LDAP_STRONG_AUTH_REQUIRED,
  CODES.LDAP_ADMIN_LIMIT_EXCEEDED,
  CODES.LDAP_NO_SUCH_ATTRIBUTE,
  CODES.LDAP_INAPPROPRIATE_MATCHING,
  CODES.LDAP_INSUFFICIENT_ACCESS_RIGHTS,
  CODES.LDAP_BUSY,
  CODES.LDAP_UNWILLING_TO_PERFORM,
  CODES.LDAP_OTHER
];

function ServerSideSortingResponseControl(options) {
  if (!options)
    options = {};

  options.type = ServerSideSortingResponseControl.OID;
  options.criticality = false;

  if (options.value) {
    if (Buffer.isBuffer(options.value)) {
      this.parse(options.value);
    } else if (typeof (options.value) === 'object') {
      if (VALID_CODES.indexOf(options.value.result) === -1) {
        throw new Error('Invalid result code');
      }
      if (options.value.failedAttribute &&
          typeof (options.value.failedAttribute) !== 'string') {
        throw new Error('failedAttribute must be String');
      }

      this._value = options.value;
    } else {
      throw new TypeError('options.value must be a Buffer or Object');
    }
    options.value = null;
  }
  Control.call(this, options);

  var self = this;
  this.__defineGetter__('value', function () {
    return self._value || {};
  });
}
util.inherits(ServerSideSortingResponseControl, Control);
module.exports = ServerSideSortingResponseControl;


ServerSideSortingResponseControl.prototype.parse = function parse(buffer) {
  assert.ok(buffer);

  var ber = new BerReader(buffer);
  if (ber.readSequence(0x30)) {
    this._value = {};
    this._value.result = ber.readEnumeration();
    if (ber.peek() == 0x80) {
      this._value.failedAttribute = ber.readString(0x80);
    }
    return true;
  }
  return false;
};


ServerSideSortingResponseControl.prototype._toBer = function (ber) {
  assert.ok(ber);

  if (!this._value || this.value.length === 0)
    return;

  var writer = new BerWriter();
  writer.startSequence(0x30);
  writer.writeEnumeration(this.value.result);
  if (this.value.result !== CODES.LDAP_SUCCESS && this.value.failedAttribute) {
    writer.writeString(this.value.failedAttribute, 0x80);
  }
  writer.endSequence();
  ber.writeBuffer(writer.buffer, 0x04);
};


ServerSideSortingResponseControl.prototype._json = function (obj) {
  obj.controlValue = this.value;
  return obj;
};

ServerSideSortingResponseControl.OID = '1.2.840.113556.1.4.474';

var assert = require('assert');
var util = require('util');

var asn1 = require('asn1');

var Control = require('./control');



///--- Globals

var BerReader = asn1.BerReader;
var BerWriter = asn1.BerWriter;



///--- API

function ServerSideSortingControl(options) {
  if (!options)
    options = {};

  options.type = ServerSideSortingControl.OID;
  if (options.value) {
    if (Buffer.isBuffer(options.value)) {
      this.parse(options.value);
    } else if (Array.isArray(options.value)) {
      for (var i = 0; i < options.value.length; i++) {
        if (!typeof (options.value[i]) === 'object') {
          throw new TypeError('Elements of options.value must be Objects');
        } else if (!options.value[i].hasOwnProperty('attributeType')) {
          throw new Error('Missing required key: attributeType');
        }
      }
      this._value = options.value;
    } else if (typeof (options.value) === 'object') {
      if (!options.value.hasOwnProperty('attributeType')) {
        throw new Error('Missing required key: attributeType');
      }
      this._value = options.value;
    } else {
      throw new TypeError('options.value must be a Buffer, Array or Object');
    }
    options.value = null;
  }
  Control.call(this, options);

  var self = this;
  this.__defineGetter__('value', function () {
    return self._value || {};
  });
}
util.inherits(ServerSideSortingControl, Control);
module.exports = ServerSideSortingControl;


ServerSideSortingControl.prototype.parse = function parse(buffer) {
  assert.ok(buffer);

  var ber = new BerReader(buffer);
  if (ber.readSequence()) {
    this._value = {};
    this._value.sortResult = ber.readInt();
    this._value.attributeType = ber.readString(asn1.Ber.OctetString, true);
     //readString returns '' instead of a zero-length buffer
    if (!this._value.attributeType)
      this._value.attributeType = new Buffer(0);

    return true;
  }

  return false;
};


ServerSideSortingControl.prototype._toBer = function (ber) {
  assert.ok(ber);

  if (!this._value)
    return;

  var writer = new BerWriter();
  writer.startSequence(0x30);

  if (Array.isArray(this.value)) {
    for (var i = 0; i < this.value.length; i++) {
      this._sortKeyListItemToBer(writer, this.value[i]);
    }
  } else if (typeof (this.value) === 'object') {
    this._sortKeyListItemToBer(writer, this.value);
  }

  writer.endSequence();
  ber.writeBuffer(writer.buffer, 0x04);
};


ServerSideSortingControl.prototype._json = function (obj) {
  obj.controlValue = this.value;
  return obj;
};

ServerSideSortingControl.prototype._sortKeyListItemToBer = function(writer, obj) {
  writer.startSequence(0x30);
  if (obj.attributeType) {
    writer.writeString(obj.attributeType, asn1.Ber.OctetString);
  }
  if (obj.orderingRule) {
    writer.writeString(obj.orderingRule, 0x80);
  }
  if (obj.reverseOrder) {
    writer.writeBoolean(obj.reverseOrder, 0x81);
  }
  writer.endSequence();
};

ServerSideSortingControl.OID = '1.2.840.113556.1.4.473';

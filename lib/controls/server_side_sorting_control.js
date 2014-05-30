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

  if (ber.readSequence(0x30)) {
    this._value = [];

    while (ber.readSequence(0x30)) {
      var sortKeyListItem = this._parseSortKeyListItem(ber)
      this._value.push(sortKeyListItem);
    }

    if (this._value.length == 1) {
      this._value = this._value[0];
    }

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

ServerSideSortingControl.prototype._parseSortKeyListItem = function(reader) {
  var sortKeyListItem = {};
  sortKeyListItem.attributeType = reader.readString(asn1.Ber.OctetString);

  if (reader.peek() == 0x80) {
    sortKeyListItem.orderingRule = reader.readString(0x80);
  }

  if (reader.peek() == 0x81) {
    sortKeyListItem.reverseOrder = (reader._readTag(0x81) === 0 ? false : true);
  }

  return sortKeyListItem;
};

ServerSideSortingControl.OID = '1.2.840.113556.1.4.473';

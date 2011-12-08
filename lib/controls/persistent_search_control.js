// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var asn1 = require('asn1');

var Control = require('./control');



///--- Globals

var BerReader = asn1.BerReader;
var BerWriter = asn1.BerWriter;



///--- API

function PersistentSearchControl(options) {
  if (!options)
    options = {};

  options.type = PersistentSearchControl.OID;
  if (options.value) {
    if (Buffer.isBuffer(options.value)) {
      this.parse(options.value);
    } else if (typeof(options.value) === 'object') {
      this._value = options.value;
    } else {
      throw new TypeError('options.value must be a Buffer or Object');
    }
    options.value = null;
  }
  Control.call(this, options);

  var self = this;
  this.__defineGetter__('value', function() {
    return self._value || {};
  });
  this.__defineGetter__('json', function() {
    var json = Control.prototype.json.call(self);
    json.controlValue = self.value;
    return json;
  });
}
util.inherits(PersistentSearchControl, Control);
module.exports = PersistentSearchControl;


PersistentSearchControl.prototype.parse = function parse(buffer) {
  assert.ok(buffer);

  var ber = new BerReader(buffer);
  if (ber.readSequence()) {
    this._value = {
      changeTypes: ber.readInt(),
      changesOnly: ber.readBoolean(),
      returnECs: ber.readBoolean()
    };

    return true;
  }

  return false;
};


PersistentSearchControl.prototype._toBer = function(ber) {
  assert.ok(ber);

  if (!this._value)
    return;

  var writer = new BerWriter();
  writer.startSequence();
  writer.writeInt(this.value.changeTypes);
  writer.writeBoolean(this.value.changesOnly);
  writer.writeBoolean(this.value.returnECs);
  writer.endSequence();

  ber.writeBuffer(writer.buffer, 0x04);
};


PersistentSearchControl.OID = '2.16.840.1.113730.3.4.3';

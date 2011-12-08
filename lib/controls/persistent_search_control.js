var assert = require('assert');
var asn1 = require('asn1');
var buffer = require('buffer');
var Control = require('./control');
var util = require('util');

function PersistentSearchControl(options) {
  if (options) {
    if (typeof(options) !== 'object')
      throw new TypeError('options must be an object');
    if (options.type && typeof(options.type) !== 'string')
      throw new TypeError('options.type must be a string');
    if (options.criticality !== undefined &&
        typeof(options.criticality) !== 'boolean')
      throw new TypeError('options.criticality must be a boolean');
    if (options.value && !Buffer.isBuffer(options.value))
      throw new TypeError('options.value must be a buffer');
  } else {
    options = {};
  }

  this.type = options.type || '2.16.840.1.113730.3.4.3';
  this.criticality = options.criticality || false;

  if (options.value) {
    // parse out this.value into the PSC object
    var ber = new asn1.BerReader(options.value);
    if (ber.readSequence()) {
      this.value = {
        changeTypes: ber.readInt(),
        changesOnly: ber.readBoolean(),
        returnECs: ber.readBoolean()
      };
    }
  }

  var self = this;
  this.__defineGetter__('json', function() {
    return {
      controlType: self.type,
      criticality: self.criticality,
      controlValue: self.value
    };
  });
}
module.exports = PersistentSearchControl;

// returns a psc given a fully populated psc object
PersistentSearchControl.prototype.get = function(options) {
  if (options) {
    if (typeof(options) !== 'object')
      throw new TypeError('options must be an object');
    if (options.type && typeof(options.type) !== 'string')
      throw new TypeError('options.type must be a string');
    if (options.criticality !== undefined &&
        typeof(options.criticality) !== 'boolean')
      throw new TypeError('options.criticality must be a boolean');
    if (options.value && typeof(options.value) !== 'object') {
      throw new TypeError('options.value must be an object');
    } else {
      if (options.value.changeTypes &&
          typeof(options.value.changeTypes) !== 'number')
        throw new TypeError('options.value.changeTypes must be a number');
      if (options.value.changesOnly !== undefined &&
          typeof(options.value.changesOnly) !== 'boolean')
        throw new TypeError('options.value.changesOnly must be a boolean');
      if (options.value.returnECs !== undefined &&
          typeof(options.value.returnECs) !== 'boolean')
        throw new TypeError('options.value.returnECs must be a boolean');
    }
  } else {
    options = {};
  }

  this.type = options.type || '';
  this.criticality = options.criticality || false;
  this.value = options.value || undefined;

  var self = this;
  this.__defineGetter__('json', function() {
    return {
      controlType: self.type,
      criticality: self.criticality,
      controlValue: self.value
    };
  });
};

PersistentSearchControl.prototype.toBer = function(ber) {
  assert.ok(ber);

  ber.startSequence();
  ber.writeString(this.type);
  ber.writeBoolean(this.criticality);

  var pscWriter = new asn1.BerWriter();

  // write the value subsequence
  pscWriter.startSequence();
  pscWriter.writeInt(this.value.changeTypes);
  pscWriter.writeBoolean(this.value.changesOnly);
  pscWriter.writeBoolean(this.value.returnECs);
  pscWriter.endSequence();

  // write the pscValue as a octetstring to the ber
  ber.writeBuffer(pscWriter.buffer, 0x04);

  ber.endSequence();
};

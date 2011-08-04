// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');

var asn1 = require('asn1');


///--- Globals

var BerWriter = asn1.BerWriter;

///--- API

function Filter(options) {
  if (!options || typeof(options) !== 'object')
    throw new TypeError('options (object) required');
  if (typeof(options.type) !== 'number')
    throw new TypeError('options.type (number) required');

  this._type = options.type;

  var self = this;
  this.__defineGetter__('type', function() {
    return '0x' + self._type.toString(16);
  });
}
module.exports = Filter;


Filter.prototype.toBer = function(ber) {
  if (!ber || !(ber instanceof BerWriter))
    throw new TypeError('ber (BerWriter) required');

  ber.startSequence(this._type);
  ber = this._toBer(ber);
  ber.endSequence();
  return ber;
};

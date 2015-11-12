var assert = require('assert-plus');
var util = require('util');

var asn1 = require('asn1');

var Control = require('./control');


///--- Globals

var BerReader = asn1.BerReader;
var BerWriter = asn1.BerWriter;


///--- API

function PagedResultsControl(options) {
  assert.optionalObject(options);
  options = options || {};
  options.type = PagedResultsControl.OID;
  if (options.value) {
    if (Buffer.isBuffer(options.value)) {
      this.parse(options.value);
    } else if (typeof (options.value) === 'object') {
      this._value = options.value;
    } else {
      throw new TypeError('options.value must be a Buffer or Object');
    }
    options.value = null;
  }
  Control.call(this, options);
}
util.inherits(PagedResultsControl, Control);
Object.defineProperties(PagedResultsControl.prototype, {
  value: {
    get: function () { return this._value || {}; },
    configurable: false
  }
});

PagedResultsControl.prototype.parse = function parse(buffer) {
  assert.ok(buffer);

  var ber = new BerReader(buffer);
  if (ber.readSequence()) {
    this._value = {};
    this._value.size = ber.readInt();
    this._value.cookie = ber.readString(asn1.Ber.OctetString, true);
     //readString returns '' instead of a zero-length buffer
    if (!this._value.cookie)
      this._value.cookie = new Buffer(0);

    return true;
  }

  return false;
};

PagedResultsControl.prototype._toBer = function (ber) {
  assert.ok(ber);

  if (!this._value)
    return;

  var writer = new BerWriter();
  writer.startSequence();
  writer.writeInt(this.value.size);
  if (this.value.cookie && this.value.cookie.length > 0) {
    writer.writeBuffer(this.value.cookie, asn1.Ber.OctetString);
  } else {
    writer.writeString(''); //writeBuffer rejects zero-length buffers
  }
  writer.endSequence();

  ber.writeBuffer(writer.buffer, 0x04);
};

PagedResultsControl.prototype._json = function (obj) {
  obj.controlValue = this.value;
  return obj;
};

PagedResultsControl.OID = '1.2.840.113556.1.4.319';


///--- Exports
module.exports = PagedResultsControl;

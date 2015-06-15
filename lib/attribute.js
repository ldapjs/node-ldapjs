// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');

var asn1 = require('asn1');

var Protocol = require('./protocol');


///--- API

function Attribute(options) {
  if (options) {
    if (typeof (options) !== 'object')
      throw new TypeError('options must be an object');
    if (options.type && typeof (options.type) !== 'string')
      throw new TypeError('options.type must be a string');
  } else {
    options = {};
  }

  var self = this;

  this.type = options.type || '';
  this._vals = [];

  this.__defineGetter__('vals', function () {
    var _vals = [];

    self._vals.forEach(function (v) {
      /* JSSTYLED */
      if (/;binary$/.test(self.type)) {
        _vals.push(v.toString('base64'));
      } else {
        _vals.push(v.toString('utf8'));
      }
    });

    return _vals;
  });

  this.__defineSetter__('vals', function (vals) {
    if (Array.isArray(vals)) {
      vals.forEach(function (v) {
        self.addValue(v);
      });
    } else {
      self.addValue(vals);
    }
  });

  this.__defineGetter__('buffers', function () {
    return self._vals;
  });

  this.__defineGetter__('json', function () {
    return {
      type: self.type,
      vals: self.vals
    };
  });

  if (options.vals !== undefined && options.vals !== null)
    this.vals = options.vals;

}
module.exports = Attribute;

Attribute.prototype.addValue = function (val) {
  if (Buffer.isBuffer(val)) {
    this._vals.push(val);
  } else {
    var encoding = 'utf8';
    /* JSSTYLED */
    if (/;binary$/.test(this.type))
      encoding = 'base64';
    this._vals.push(new Buffer(val + '', encoding));
  }
};


/* BEGIN JSSTYLED */
Attribute.compare = function compare(a, b) {
  if (!(Attribute.isAttribute(a)) || !(Attribute.isAttribute(b))) {
    throw new TypeError('can only compare Attributes');
  }

  if (a.type < b.type) return -1;
  if (a.type > b.type) return 1;
  if (a.vals.length < b.vals.length) return -1;
  if (a.vals.length > b.vals.length) return 1;

  for (var i = 0; i < a.vals.length; i++) {
    if (a.vals[i] < b.vals[i]) return -1;
    if (a.vals[i] > b.vals[i]) return 1;
  }

  return 0;
};
/* END JSSTYLED */


Attribute.prototype.parse = function (ber) {
  assert.ok(ber);

  ber.readSequence();
  this.type = ber.readString();

  if (ber.peek() === Protocol.LBER_SET) {
    if (ber.readSequence(Protocol.LBER_SET)) {
      var end = ber.offset + ber.length;
      while (ber.offset < end)
        this._vals.push(ber.readString(asn1.Ber.OctetString, true));
    }
  }

  return true;
};


Attribute.prototype.toBer = function (ber) {
  assert.ok(ber);

  ber.startSequence();
  ber.writeString(this.type);
  ber.startSequence(Protocol.LBER_SET);
  if (this._vals.length) {
    this._vals.forEach(function (b) {
      ber.writeByte(asn1.Ber.OctetString);
      ber.writeLength(b.length);
      for (var i = 0; i < b.length; i++)
        ber.writeByte(b[i]);
    });
  } else {
    ber.writeStringArray([]);
  }
  ber.endSequence();
  ber.endSequence();

  return ber;
};


Attribute.toBer = function (attr, ber) {
  return Attribute.prototype.toBer.call(attr, ber);
};


Attribute.isAttribute = function (attr) {
  if (!attr || typeof (attr) !== 'object') {
    return false;
  }
  if (attr instanceof Attribute) {
    return true;
  }
  if ((typeof (attr.toBer) === 'function') &&
      (typeof (attr.type) === 'string') &&
      (Array.isArray(attr.vals)) &&
      (attr.vals.filter(function (item) {
         return (typeof (item) === 'string' ||
                  Buffer.isBuffer(item));
       }).length === attr.vals.length)) {
    return true;
  }
  return false;
};


Attribute.prototype.toString = function () {
  return JSON.stringify(this.json);
};

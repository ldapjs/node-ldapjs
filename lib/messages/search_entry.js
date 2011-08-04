// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var asn1 = require('asn1');

var LDAPMessage = require('./message');
var Attribute = require('../attribute');
var dn = require('../dn');
var Protocol = require('../protocol');



///--- Globals

var BerWriter = asn1.BerWriter;



///--- API

function SearchEntry(options) {
  if (options) {
    if (typeof(options) !== 'object')
      throw new TypeError('options must be an object');
    if (options.objectName && !(options.objectName instanceof dn.DN))
      throw new TypeError('options.objectName must be a DN');
    if (options.attributes && !Array.isArray(options.attributes))
      throw new TypeError('options.attributes must be an array[Attribute]');
    if (options.attributes && options.attributes.length) {
      options.attributes.forEach(function(a) {
        if (!(a instanceof Attribute))
          throw new TypeError('options.attributes must be an array[Attribute]');
      });
  }
  } else {
    options = {};
  }

  options.protocolOp = Protocol.LDAP_REP_SEARCH_ENTRY;
  LDAPMessage.call(this, options);

  this.objectName = options.objectName || null;
  this.attributes = options.attributes ? options.attributes.slice(0) : [];

  var self = this;
  this.__defineGetter__('type', function() { return 'SearchEntry'; });
  this.__defineGetter__('_dn', function() {
    return self.objectName.toString();
  });
}
util.inherits(SearchEntry, LDAPMessage);
module.exports = SearchEntry;


SearchEntry.prototype.addAttribute = function(attr) {
  if (!attr || typeof(attr) !== 'object')
    throw new TypeError('attr (attribute) required');

  this.attributes.push(attr);
};


SearchEntry.prototype._json = function(j) {
  assert.ok(j);

  j.objectName = this.objectName.toString();
  j.attributes = [];
  this.attributes.forEach(function(a) {
    j.attributes.push(a.json);
  });

  return j;
};


SearchEntry.prototype._parse = function(ber) {
  assert.ok(ber);

  this.objectName = ber.readString();
  assert.ok(ber.readSequence());
  var end = ber.offset + ber.length;

  while (ber.offset < end) {
    var a = new Attribute();
    a.parse(ber);
    this.attributes.push(a);
  }

  return true;
};


SearchEntry.prototype._toBer = function(ber) {
  assert.ok(ber);

  ber.writeString(this.objectName.toString());
  ber.startSequence();
  this.attributes.forEach(function(a) {
    // This may or may not be an attribute
    ber = Attribute.toBer(a, ber);
  });
  ber.endSequence();

  return ber;
};




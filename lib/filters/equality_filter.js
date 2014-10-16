// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var ASN1 = require('asn1').Ber;
var parents = require('ldap-filter');

var Filter = require('./filter');



///--- API

function EqualityFilter(options) {
  parents.EqualityFilter.call(this, options);
}
util.inherits(EqualityFilter, parents.EqualityFilter);
Filter.mixin(EqualityFilter);
module.exports = EqualityFilter;


EqualityFilter.prototype.parse = function (ber) {
  assert.ok(ber);

  this.attribute = ber.readString().toLowerCase();
  this.value = ber.readString(ASN1.OctetString, true);

  if (this.attribute === 'objectclass')
    this.value = this.value.toLowerCase();

  return true;
};


EqualityFilter.prototype._toBer = function (ber) {
  assert.ok(ber);

  ber.writeString(this.attribute);
  ber.writeBuffer(this.raw, ASN1.OctetString);

  return ber;
};

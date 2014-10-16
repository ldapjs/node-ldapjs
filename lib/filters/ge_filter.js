// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var parents = require('ldap-filter');

var Filter = require('./filter');


///--- API

function GreaterThanEqualsFilter(options) {
  parents.GreaterThanEqualsFilter.call(this, options);
}
util.inherits(GreaterThanEqualsFilter, parents.GreaterThanEqualsFilter);
Filter.mixin(GreaterThanEqualsFilter);
module.exports = GreaterThanEqualsFilter;


GreaterThanEqualsFilter.prototype.parse = function (ber) {
  assert.ok(ber);

  this.attribute = ber.readString().toLowerCase();
  this.value = ber.readString();

  return true;
};


GreaterThanEqualsFilter.prototype._toBer = function (ber) {
  assert.ok(ber);

  ber.writeString(this.attribute);
  ber.writeString(this.value);

  return ber;
};

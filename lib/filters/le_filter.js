// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var parents = require('ldap-filter');

var Filter = require('./filter');


///--- API

function LessThanEqualsFilter(options) {
  parents.LessThanEqualsFilter.call(this, options);
}
util.inherits(LessThanEqualsFilter, parents.LessThanEqualsFilter);
Filter.mixin(LessThanEqualsFilter);
module.exports = LessThanEqualsFilter;


LessThanEqualsFilter.prototype.parse = function (ber) {
  assert.ok(ber);

  this.attribute = ber.readString().toLowerCase();
  this.value = ber.readString();

  return true;
};


LessThanEqualsFilter.prototype._toBer = function (ber) {
  assert.ok(ber);

  ber.writeString(this.attribute);
  ber.writeString(this.value);

  return ber;
};

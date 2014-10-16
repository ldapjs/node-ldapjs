// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var parents = require('ldap-filter');

var Filter = require('./filter');



///--- API

function ApproximateFilter(options) {
  parents.ApproximateFilter.call(this, options);
}
util.inherits(ApproximateFilter, parents.ApproximateFilter);
Filter.mixin(ApproximateFilter);
module.exports = ApproximateFilter;


ApproximateFilter.prototype.parse = function (ber) {
  assert.ok(ber);

  this.attribute = ber.readString().toLowerCase();
  this.value = ber.readString();

  return true;
};


ApproximateFilter.prototype._toBer = function (ber) {
  assert.ok(ber);

  ber.writeString(this.attribute);
  ber.writeString(this.value);

  return ber;
};

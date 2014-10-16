// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var parents = require('ldap-filter');

var Filter = require('./filter');



///--- API

function AndFilter(options) {
  parents.AndFilter.call(this, options);
}
util.inherits(AndFilter, parents.AndFilter);
Filter.mixin(AndFilter);
module.exports = AndFilter;


AndFilter.prototype._toBer = function (ber) {
  assert.ok(ber);

  this.filters.forEach(function (f) {
    ber = f.toBer(ber);
  });

  return ber;
};

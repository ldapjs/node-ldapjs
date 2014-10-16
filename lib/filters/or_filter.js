// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var parents = require('ldap-filter');

var Filter = require('./filter');


///--- API

function OrFilter(options) {
  parents.OrFilter.call(this, options);
}
util.inherits(OrFilter, parents.OrFilter);
Filter.mixin(OrFilter);
module.exports = OrFilter;


OrFilter.prototype._toBer = function (ber) {
  assert.ok(ber);

  this.filters.forEach(function (f) {
    ber = f.toBer(ber);
  });

  return ber;
};

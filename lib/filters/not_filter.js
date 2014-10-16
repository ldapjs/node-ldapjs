// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var parents = require('ldap-filter');

var Filter = require('./filter');


///--- API

function NotFilter(options) {
  parents.NotFilter.call(this, options);
}
util.inherits(NotFilter, parents.NotFilter);
Filter.mixin(NotFilter);
module.exports = NotFilter;


NotFilter.prototype._toBer = function (ber) {
  assert.ok(ber);

  return this.filter.toBer(ber);
};

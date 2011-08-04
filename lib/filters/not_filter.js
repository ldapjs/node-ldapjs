// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var Filter = require('./filter');

var Protocol = require('../protocol');



///--- API

function NotFilter(options) {
  if (typeof(options) !== 'object')
    throw new TypeError('options (object) required');
  if (!options.filter || !(options.filter instanceof Filter))
    throw new TypeError('options.filter (Filter) required');

  options.type = Protocol.FILTER_NOT;
  Filter.call(this, options);

  this.filter = options.filter;

  var self = this;
  this.__defineGetter__('json', function() {
    return {
      type: 'Not',
      filter: self.filter
    };
  });
}
util.inherits(NotFilter, Filter);
module.exports = NotFilter;


NotFilter.prototype.toString = function() {
  return '(!' + this.filter.toString() + ')';
};


NotFilter.prototype.matches = function(target) {
  return !this.filter.matches(target);
};


NotFilter.prototype._toBer = function(ber) {
  assert.ok(ber);

  return this.filter.toBer(ber);
};

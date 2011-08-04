// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var Filter = require('./filter');

var Protocol = require('../protocol');


///--- API

function PresenceFilter(options) {
  if (typeof(options) === 'object') {
    if (!options.attribute || typeof(options.attribute) !== 'string')
      throw new TypeError('options.attribute (string) required');
    this.attribute = options.attribute;
  } else {
    options = {};
  }
  options.type = Protocol.FILTER_PRESENT;
  Filter.call(this, options);

  var self = this;
  this.__defineGetter__('json', function() {
    return {
      type: 'PresenceMatch',
      attribute: self.attribute || undefined
    };
  });
}
util.inherits(PresenceFilter, Filter);
module.exports = PresenceFilter;


PresenceFilter.prototype.toString = function() {
  return '(' + this.attribute + '=*)';
};


PresenceFilter.prototype.matches = function(target) {
  if (typeof(target) !== 'object')
    throw new TypeError('target (object) required');

  var matches = false;
  if (target.hasOwnProperty(this.attribute))
    matches = true;

  return matches;
};


PresenceFilter.prototype.parse = function(ber) {
  assert.ok(ber);

  this.attribute = ber.readString();
  return true;
};


PresenceFilter.prototype._toBer = function(ber) {
  assert.ok(ber);

  ber.writeString(this.attribute);

  return ber;
};

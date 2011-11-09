// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var Filter = require('./filter');

var Protocol = require('../protocol');



///--- API

function ExtensibleFilter(options) {
  if (typeof(options) === 'object') {
    if (options.rule && typeof(options.rule) !== 'string')
      throw new TypeError('options.rule must be a string');
    if (options.matchType && typeof(options.matchType) !== 'string')
      throw new TypeError('options.type must be a string');
    if (options.value && typeof(options.value) !== 'string')
      throw new TypeError('options.value (string) required');
  } else {
    options = {};
  }

  this.matchType = options.matchType || null;
  this.rule = options.rule || null;
  this.value = options.value || '';
  this.dnAttributes = options.dnAttributes || false;
  options.type = Protocol.FILTER_EXT;
  Filter.call(this, options);

  var self = this;
  this.__defineGetter__('json', function() {
    return {
      type: 'ExtensibleMatch',
      matchRule: self.rule,
      matchType: self.matchType,
      matchValue: self.value,
      dnAttributes: self.dnAttributes
    };
  });
  this.__defineGetter__('matchingRule', function() {
    return self.rule;
  });
  this.__defineGetter__('matchValue', function() {
    return self.value;
  });
}
util.inherits(ExtensibleFilter, Filter);
module.exports = ExtensibleFilter;


ExtensibleFilter.prototype.toString = function() {
  var str = '(';

  if (this.matchType)
    str += this.matchType;

  str += ':';

  if (this.dnAttributes)
    str += 'dn:';

  if (this.rule)
    str += this.rule + ':';

  return (str + '=' + this.value + ')');
};


/**
 * THIS IS A STUB!
 *
 * ldapjs does not support server side extensible matching. This class exists
 * only for the client to send them.
 *
 * @param {Object} target the target object.
 * @return {Boolean} false always.
 */
ExtensibleFilter.prototype.matches = function(target) {
  if (typeof(target) !== 'object')
    throw new TypeError('target (object) required');

  return false;
};


ExtensibleFilter.prototype.parse = function(ber) {
  throw new Error('ExtensibleFilter not supported');
};


ExtensibleFilter.prototype._toBer = function(ber) {
  assert.ok(ber);

  if (this.rule)
    ber.writeString(this.rule, 0x81);
  if (this.matchType)
    ber.writeString(this.matchType, 0x82);

  ber.writeString(this.value, 0x83);
  if (this.dnAttributes)
    ber.writeBoolean(this.dnAttributes, 0x84);

  return ber;
};

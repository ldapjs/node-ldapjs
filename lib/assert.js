// Copyright 2015 Joyent, Inc.

var assert = require('assert');
var util = require('util');

var isDN = require('./dn').DN.isDN;
var isAttribute = require('./attribute').isAttribute;


///--- Helpers

// Copied from mcavage/node-assert-plus
function _assert(arg, type, name) {
  name = name || type;
  throw new assert.AssertionError({
    message: util.format('%s (%s) required', name, type),
    actual: typeof (arg),
    expected: type,
    operator: '===',
    stackStartFunction: _assert.caller
  });
}


///--- API

function stringDN(input, name) {
  if (isDN(input) || typeof (input) === 'string')
    return;
  _assert(input, 'DN or string', name);
}

function optionalStringDN(input, name) {
  if (input === undefined || isDN(input) || typeof (input) === 'string')
    return;
  _assert(input, 'DN or string', name);
}

function optionalDN(input, name) {
  if (input !== undefined && !isDN(input))
    _assert(input, 'DN', name);
}

function optionalArrayOfAttribute(input, name) {
  if (input === undefined)
    return;
  if (!Array.isArray(input) ||
      input.some(function (v) { return !isAttribute(v); })) {
  _assert(input, 'array of Attribute', name);
  }
}


///--- Exports

module.exports = {
  stringDN: stringDN,
  optionalStringDN: optionalStringDN,
  optionalDN: optionalDN,
  optionalArrayOfAttribute: optionalArrayOfAttribute
};

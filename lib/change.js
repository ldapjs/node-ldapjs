// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');

var Attribute = require('./attribute');
var Protocol = require('./protocol');



///--- API

function Change(options) {
  if (options) {
    if (typeof (options) !== 'object')
      throw new TypeError('options must be an object');
    if (options.operation && typeof (options.operation) !== 'string')
      throw new TypeError('options.operation must be a string');
  } else {
    options = {};
  }

  var self = this;
  this._modification = false;

  this.__defineGetter__('operation', function () {
    switch (self._operation) {
    case 0x00: return 'add';
    case 0x01: return 'delete';
    case 0x02: return 'replace';
    default:
      throw new Error('0x' + self._operation.toString(16) + ' is invalid');
    }
  });
  this.__defineSetter__('operation', function (val) {
    if (typeof (val) !== 'string')
      throw new TypeError('operation must be a string');

    switch (val.toLowerCase()) {
    case 'add':
      self._operation = 0x00;
      break;
    case 'delete':
      self._operation = 0x01;
      break;
    case 'replace':
      self._operation = 0x02;
      break;
    default:
      throw new Error('Invalid operation type: 0x' + val.toString(16));
    }
  });
  this.__defineGetter__('modification', function () {
    return self._modification;
  });
  this.__defineSetter__('modification', function (attr) {
    if (Attribute.isAttribute(attr)) {
      self._modification = attr;
      return;
    }
    // Does it have an attribute-like structure
    if (Object.keys(attr).length == 2 &&
        typeof (attr.type) === 'string' &&
        Array.isArray(attr.vals)) {
      self._modification = new Attribute({
        type: attr.type,
        vals: attr.vals
      });
      return;
    }

    var keys = Object.keys(attr);
    if (keys.length > 1)
      throw new Error('Only one attribute per Change allowed');

    keys.forEach(function (k) {
      var _attr = new Attribute({type: k});
      if (Array.isArray(attr[k])) {
        attr[k].forEach(function (v) {
          _attr.addValue(v.toString());
        });
      } else {
        _attr.addValue(attr[k].toString());
      }
      self._modification = _attr;
    });
  });
  this.__defineGetter__('json', function () {
    return {
      operation: self.operation,
      modification: self._modification ? self._modification.json : {}
    };
  });

  this.operation = options.operation || options.type || 'add';
  this.modification = options.modification || {};
}
module.exports = Change;

Change.isChange = function isChange(change) {
  if (!change || typeof (change) !== 'object') {
    return false;
  }
  if ((change instanceof Change) ||
      ((typeof (change.toBer) === 'function') &&
      (change.modification !== undefined) &&
      (change.operation !== undefined))) {
    return true;
  }
  return false;
};

Change.compare = function (a, b) {
  if (!Change.isChange(a) || !Change.isChange(b))
    throw new TypeError('can only compare Changes');

  if (a.operation < b.operation)
    return -1;
  if (a.operation > b.operation)
    return 1;

  return Attribute.compare(a.modification, b.modification);
};

/**
 * Apply a Change to properties of an object.
 *
 * @param {Object} change the change to apply.
 * @param {Object} obj the object to apply it to.
 * @param {Boolean} scalar convert single-item arrays to scalars. Default: false
 */
Change.apply = function apply(change, obj, scalar) {
  assert.string(change.operation);
  assert.string(change.modification.type);
  assert.ok(Array.isArray(change.modification.vals));
  assert.object(obj);

  var type = change.modification.type;
  var vals = change.modification.vals;
  var data = obj[type];
  if (data !== undefined) {
    if (!Array.isArray(data)) {
      data = [data];
    }
  } else {
    data = [];
  }
  switch (change.operation) {
  case 'replace':
    if (vals.length === 0) {
      // replace empty is a delete
      delete obj[type];
      return obj;
    } else {
      data = vals;
    }
    break;
  case 'add':
    // add only new unique entries
    var newValues = vals.filter(function (entry) {
      return (data.indexOf(entry) === -1);
    });
    data = data.concat(newValues);
    break;
  case 'delete':
    data = data.filter(function (entry) {
      return (vals.indexOf(entry) === -1);
    });
    if (data.length === 0) {
      // Erase the attribute if empty
      delete obj[type];
      return obj;
    }
    break;
  default:
    break;
  }
  if (scalar && data.length === 1) {
    // store single-value outputs as scalars, if requested
    obj[type] = data[0];
  } else {
    obj[type] = data;
  }
  return obj;
};


Change.prototype.parse = function (ber) {
  assert.ok(ber);

  ber.readSequence();
  this._operation = ber.readEnumeration();
  this._modification = new Attribute();
  this._modification.parse(ber);

  return true;
};


Change.prototype.toBer = function (ber) {
  assert.ok(ber);

  ber.startSequence();
  ber.writeEnumeration(this._operation);
  ber = this._modification.toBer(ber);
  ber.endSequence();

  return ber;
};

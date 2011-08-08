// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var fs = require('fs');

var Protocol = require('./protocol');
var errors = require('./errors');



///--- API

module.exports = {

  /**
   *
   * Supports definition of objectclasses like so:
   * {
   *   person: {
   *     required: ['cn', 'sn'],
   *     optional: ['email']
   *   }
   * }
   */
  loadSchema: function(file, callback) {
    if (!file || typeof(file) !== 'string')
      throw new TypeError('file (string) required');
    if (typeof(callback) !== 'function')
      throw new TypeError('callback (function) required');

    return fs.readFile(file, 'utf8', function(err, data) {
      if (err)
        return callback(err);

      try {
        return callback(null, JSON.parse(data));
      } catch (e) {
        return callback(e);
      }
    });
  },

  newInterceptor: function(schema) {
    if (typeof(schema) !== 'object')
      throw new TypeError('schema (object) required');

    // Add/Modify request already have attributes sorted
    return function(req, res, next) {
      switch (req.protocolOp) {
      case Protocol.LDAP_REQ_ADD:
        var ocNdx = req.indexOf('objectclass');
        if (ocNdx === -1)
          return next(new errors.ConstraintViolation('objectclass'));
        var reqOC = req.attributes[ocNdx];

        // First make the "set" of required/optional attributes for all OCs in
        // the union of all OCs. We destroy these arrays after the fact. Note
        // that optional will get the set of attributes also not already in
        // required, since we figure this out by destructively changing the
        // list of attribute names.
        var required = [];
        var optional = [];
        var i, j;

        for (i = 0; i < reqOC.vals.length; i++) {
          var oc = schema[reqOC.vals[i]];
          if (!oc)
            return next(new errors.UndefinedAttributeType(reqOC.vals[i]));

          for (j = 0; j < oc.required.length; j++) {
            if (required.indexOf(oc.required[j]) === -1)
              required.push(oc.required[j]);
          }
          for (j = 0; j < oc.optional.length; j++) {
            if (optional.indexOf(oc.optional[j]) === -1 &&
                required.indexOf(oc.optional[j]) === -1)
              optional.push(oc.optional[j]);
          }
        }

        // Make a copy of just the attribute names
        var attrs = req.attributeNames();
        for (i = 0; i < attrs.length; i++) {
          var ndx = required.indexOf(attrs[i]);
          if (ndx === -1) {
            ndx = optional.indexOf(attrs[i]);
            if (ndx == -1)
              return next(new errors.ConstraintViolation(attrs[i]));
          }
          attrs.splice(i, 1);
        }

        if (attrs.length)
          return next(new errors.ConstraintViolation(attrs.join()));

        break;
      case Protocol.LDAP_REQ_MODIFY:

        break;
      default:
        return next();
      }
    }
  }

};

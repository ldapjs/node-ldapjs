// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');

var dn = require('../dn');
var errors = require('../errors');
var logStub = require('../log_stub');

var getTransformer = require('./transform').getTransformer;



function createSearchHandler(options) {
  if (!options || typeof(options) !== 'object')
    throw new TypeError('options (object) required');
  if (!options.schema || typeof(options.schema) !== 'object')
    throw new TypeError('options.schema (object) required');
  // TODO add a callback mechanism here so objectclass constraints can be
  // enforced

  var log4js = options.log4js || logStub;
  var log = log4js.getLogger('SchemaSearchHandler');
  var schema = options.schema;

  var CVErr = errors.ConstraintViolationError;
  var NSAErr = errors.NoSuchAttributeError;
  var OCVErr = errors.ObjectclassViolationError;

  return function schemaSearchHandler(req, res, next) {
    if (log.isDebugEnabled())
      log.debug('%s running %j against schema', req.logId, req.filter);

    return next();
  }
}

module.exports = createSearchHandler;

// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var util = require('util');

var LDAPResult = require('../messages').LDAPResult;


///--- Globals

var CODES = require('./codes');
var ERRORS = [];



///--- Error Base class

function LDAPError(errorName, errorCode, msg, dn, caller) {
  if (Error.captureStackTrace)
    Error.captureStackTrace(this, caller || LDAPError);

  this.__defineGetter__('dn', function () {
    return (dn ? (dn.toString() || '') : '');
  });
  this.__defineGetter__('code', function () {
    return errorCode;
  });
  this.__defineGetter__('name', function () {
    return errorName;
  });
  this.__defineGetter__('message', function () {
    return msg || errorName;
  });
}
util.inherits(LDAPError, Error);



///--- Exported API
// Some whacky games here to make sure all the codes are exported

module.exports = {};
module.exports.LDAPError = LDAPError;

Object.keys(CODES).forEach(function (code) {
  module.exports[code] = CODES[code];
  if (code === 'LDAP_SUCCESS')
    return;

  var err = '';
  var msg = '';
  var pieces = code.split('_').slice(1);
  for (var i = 0; i < pieces.length; i++) {
    var lc = pieces[i].toLowerCase();
    var key = lc.charAt(0).toUpperCase() + lc.slice(1);
    err += key;
    msg += key + ((i + 1) < pieces.length ? ' ' : '');
  }

  if (!/\w+Error$/.test(err))
    err += 'Error';

  // At this point LDAP_OPERATIONS_ERROR is now OperationsError in $err
  // and 'Operations Error' in $msg
  module.exports[err] = function (message, dn, caller) {
    LDAPError.call(this,
                   err,
                   CODES[code],
                   message || msg,
                   dn || null,
                   caller || module.exports[err]);
  };
  module.exports[err].constructor = module.exports[err];
  util.inherits(module.exports[err], LDAPError);

  ERRORS[CODES[code]] = {
    err: err,
    message: msg
  };
});


module.exports.getError = function (res) {
  if (!(res instanceof LDAPResult))
    throw new TypeError('res (LDAPResult) required');

  var errObj = ERRORS[res.status];
  var E = module.exports[errObj.err];
  return new E(res.errorMessage || errObj.message,
               res.matchedDN || null,
               module.exports.getError);
};


module.exports.getMessage = function (code) {
  if (typeof (code) !== 'number')
    throw new TypeError('code (number) required');

  var errObj = ERRORS[code];
  return (errObj && errObj.message ? errObj.message : '');
};


///--- Custom application errors

function ConnectionError(message) {
  LDAPError.call(this,
                 'ConnectionError',
                 CODES.LDAP_OTHER,
                 message,
                 null,
                 ConnectionError);
}
util.inherits(ConnectionError, LDAPError);
module.exports.ConnectionError = ConnectionError;

function AbandonedError(message) {
  LDAPError.call(this,
                 'AbandonedError',
                 CODES.LDAP_OTHER,
                 message,
                 null,
                 AbandonedError);
}
util.inherits(AbandonedError, LDAPError);
module.exports.AbandonedError = AbandonedError;

function TimeoutError(message) {
  LDAPError.call(this,
                 'TimeoutError',
                 CODES.LDAP_OTHER,
                 message,
                 null,
                 TimeoutError);
}
util.inherits(TimeoutError, LDAPError);
module.exports.TimeoutError = TimeoutError;

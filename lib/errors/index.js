// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var util = require('util');
var assert = require('assert-plus');

var LDAPResult = require('../messages').LDAPResult;


///--- Globals

var CODES = require('./codes');
var ERRORS = [];


///--- Error Base class

function LDAPError(message, dn, caller) {
  if (Error.captureStackTrace)
    Error.captureStackTrace(this, caller || LDAPError);

  this.lde_message = message;
  this.lde_dn = dn;
}
util.inherits(LDAPError, Error);
Object.defineProperties(LDAPError.prototype, {
  name: {
    get: function getName() { return 'LDAPError'; },
    configurable: false
  },
  code: {
    get: function getCode() { return CODES.LDAP_OTHER; },
    configurable: false
  },
  message: {
    get: function getMessage() {
      return this.lde_message || this.name;
    },
    configurable: false
  },
  dn: {
    get: function getDN() {
      return (this.lde_dn ? this.lde_dn.toString() : '');
    },
    configurable: false
  }
});


///--- Exported API

module.exports = {};
module.exports.LDAPError = LDAPError;

// Some whacky games here to make sure all the codes are exported
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
    LDAPError.call(this, message, dn, caller || module.exports[err]);
  };
  module.exports[err].constructor = module.exports[err];
  util.inherits(module.exports[err], LDAPError);
  Object.defineProperties(module.exports[err].prototype, {
    name: {
      get: function getName() { return err; },
      configurable: false
    },
    code: {
      get: function getCode() { return CODES[code]; },
      configurable: false
    }
  });

  ERRORS[CODES[code]] = {
    err: err,
    message: msg
  };
});

module.exports.getError = function (res) {
  assert.ok(res instanceof LDAPResult, 'res (LDAPResult) required');

  var errObj = ERRORS[res.status];
  var E = module.exports[errObj.err];
  return new E(res.errorMessage || errObj.message,
               res.matchedDN || null,
               module.exports.getError);
};

module.exports.getMessage = function (code) {
  assert.number(code, 'code (number) required');

  var errObj = ERRORS[code];
  return (errObj && errObj.message ? errObj.message : '');
};


///--- Custom application errors

function ConnectionError(message) {
  LDAPError.call(this, message, null, ConnectionError);
}
util.inherits(ConnectionError, LDAPError);
module.exports.ConnectionError = ConnectionError;
Object.defineProperties(ConnectionError.prototype, {
  name: {
    get: function () { return 'ConnectionError'; },
    configurable: false
  }
});

function AbandonedError(message) {
  LDAPError.call(this, message, null, AbandonedError);
}
util.inherits(AbandonedError, LDAPError);
module.exports.AbandonedError = AbandonedError;
Object.defineProperties(AbandonedError.prototype, {
  name: {
    get: function () { return 'AbandonedError'; },
    configurable: false
  }
});

function TimeoutError(message) {
  LDAPError.call(this, message, null, TimeoutError);
}
util.inherits(TimeoutError, LDAPError);
module.exports.TimeoutError = TimeoutError;
Object.defineProperties(TimeoutError.prototype, {
  name: {
    get: function () { return 'TimeoutError'; },
    configurable: false
  }
});

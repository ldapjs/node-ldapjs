// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var dtrace = require('dtrace-provider');



///--- Globals

var SERVER_PROVIDER;

/* Args:
 * 0 -> RequestId (<ip>:<src port>:<msgID>)
 * 1 -> remoteIP
 * 2 -> bindDN
 * 3 -> req.dn
 * 4,5 -> op specific
 */
var SERVER_PROBES = {

  // 4: attributes.length
  add: ['char *', 'char *', 'char *', 'char *', 'int'],

  bind: ['char *', 'char *', 'char *', 'char *'],

  // 4: attribute, 5: value
  compare: ['char *', 'char *', 'char *', 'char *', 'char *', 'char *'],

  'delete': ['char *', 'char *', 'char *', 'char *'],

  // 4: requestName, 5: requestValue
  exop: ['char *', 'char *', 'char *', 'char *', 'char *', 'char *'],

  // 4: changes.length
  modify: ['char *', 'char *', 'char *', 'char *', 'int'],

  // 4: newRdn, 5: newSuperior
  modifyDN: ['char *', 'char *', 'char *', 'char *', 'char *', 'char *'],

  // 4: filter, 5: scope
  search: ['char *', 'char *', 'char *', 'char *', 'char *', 'char *'],

  unbind: ['char *', 'char *', 'char *', 'char *'],

  // remote IP
  connection: ['char *'],

  request: ['char *', 'char *', 'char *', 'char *'],

  // requestId, remoteIp, bindDN, request.dn, statusCode, errorMessage
  response: ['char *', 'char *', 'char *', 'char *', 'int', 'char *']
};


///--- API

module.exports = function() {
  if (!SERVER_PROVIDER) {
    SERVER_PROVIDER = dtrace.createDTraceProvider('ldapjs');

    Object.keys(SERVER_PROBES).forEach(function(p) {
      var args = SERVER_PROBES[p].splice(0);
      args.unshift(p);

      dtrace.DTraceProvider.prototype.addProbe.apply(SERVER_PROVIDER, args);
    });

    SERVER_PROVIDER.enable();
  }

  return SERVER_PROVIDER;
}();


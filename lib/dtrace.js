// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var dtrace = require('dtrace-provider');



///--- Globals

var SERVER_PROVIDER;

/* Args:
 * 0 -> remoteIP
 * 1 -> bindDN
 * 2 -> req.dn
 * 3..5 -> op specific
 */
var SERVER_PROBES = {

  // 3: attributes.length
  add: ['char *', 'char *', 'char *', 'int'],

  bind: ['char *', 'char *', 'char *'],

  // 3: attribute, 4: value
  compare: ['char *', 'char *', 'char *', 'char *', 'char *'],

  'delete': ['char *', 'char *', 'char *'],

  // 3: requestName, 4: requestValue
  exop: ['char *', 'char *', 'char *', 'char *', 'char *'],

  // 3: changes.length
  modify: ['char *', 'char *', 'char *', 'int'],

  // 3: newRdn, 4: deleteOldRdn, 5: newSuperior
  modifyDN: ['char *', 'char *', 'char *', 'char *', 'int', 'char *'],

  // 3: filter, 4: scope, 5: attributes.length
  search: ['char *', 'char *', 'char *', 'char *', 'char *', 'int'],

  unbind: ['char *', 'char *', 'char *'],

  // remote IP
  connection: ['char *'],

  // statusCode, matchedDN, error message, remoteAddress, bindDN, req.dn
  result: ['int', 'char *', 'char *', 'char *', 'char *', 'char *']
};


///--- API

module.exports = {

  ServerProbes: SERVER_PROBES,


  serverProvider: function() {
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
  }

};

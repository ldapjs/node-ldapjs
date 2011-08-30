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

  add: ['char "*', 'char *', 'char *'],
  bind: ['char "*', 'char *', 'char *'],
  unbind: ['char "*', 'char *', 'char *'],
  connection: ['char *']

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
        console.log('%j', args);
        dtrace.DTraceProvider.prototype.addProbe.apply(SERVER_PROVIDER, args);
      });

      SERVER_PROVIDER.enable();
    }

    return SERVER_PROVIDER;
  }

};

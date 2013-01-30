// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var Logger = require('bunyan');

var client = require('./client');
var Attribute = require('./attribute');
var Change = require('./change');
var Protocol = require('./protocol');
var Server = require('./server');

var assert = require('assert');
var controls = require('./controls');
var persistentSearch = require('./persistent_search');
var dn = require('./dn');
var errors = require('./errors');
var filters = require('./filters');
var messages = require('./messages');
var url = require('./url');

// Guid formatting

// N specifier, 32 digits:
//  00000000000000000000000000000000
/* JSSTYLED */
var GUID_FORMAT_N = '{3}{2}{1}{0}{5}{4}{7}{6}{8}{9}{10}{11}{12}{13}{14}{15}';

// D specifier, 32 digits separated by hypens:
//  00000000-0000-0000-0000-000000000000
/* JSSTYLED */
var GUID_FORMAT_D = '{3}{2}{1}{0}-{5}{4}-{7}{6}-{8}{9}-{10}{11}{12}{13}{14}{15}';

// B specifier, 32 digits separated by hyphens, enclosed in braces:
//  {00000000-0000-0000-0000-000000000000}
/* JSSTYLED */
var GUID_FORMAT_B = '{{3}{2}{1}{0}-{5}{4}-{7}{6}-{8}{9}-{10}{11}{12}{13}{14}{15}}';

// P specifier, 32 digits separated by hyphens, enclosed in parentheses:
//  (00000000-0000-0000-0000-000000000000)
/* JSSTYLED */
var GUID_FORMAT_P = '({3}{2}{1}{0}-{5}{4}-{7}{6}-{8}{9}-{10}{11}{12}{13}{14}{15})';

// X specifier, Four hexadecimal values enclosed in braces,
// where the fourth value is a subset of eight hexadecimal values that is also
// enclosed in braces:
//  {0x00000000,0x0000,0x0000,{0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00}}
/* JSSTYLED */
var GUID_FORMAT_X = '{0x{3}{2}{1}{0},0x{5}{4},0x{7}{6},{0x{8},0x{9},0x{10},0x{11},0x{12},0x{13},0x{14},0x{15}}}';

/// Hack a few things we need (i.e., "monkey patch" the prototype)

if (!String.prototype.startsWith) {
  String.prototype.startsWith = function (str) {
    var re = new RegExp('^' + str);
    return re.test(this);
  };
}


if (!String.prototype.endsWith) {
  String.prototype.endsWith = function (str) {
    var re = new RegExp(str + '$');
    return re.test(this);
  };
}



///--- API

module.exports = {

  createClient: client.createClient,

  Server: Server,
  createServer: function (options) {
    if (options === undefined)
      options = {};

    if (typeof (options) !== 'object')
      throw new TypeError('options (object) required');

    if (!options.log) {
      options.log = new Logger({
        name: 'ldapjs',
        component: 'client',
        stream: process.stderr
      });
    }

    return new Server(options);
  },

  Attribute: Attribute,
  Change: Change,

  DN: dn.DN,
  PersistentSearchCache: persistentSearch.PersistentSearchCache,
  RDN: dn.RDN,

  parseDN: dn.parse,
  dn: dn,

  persistentSearch: persistentSearch,

  filters: filters,
  parseFilter: filters.parseString,

  parseURL: url.parse,

  url: url,

  GUID_FORMAT_N: GUID_FORMAT_N,
  GUID_FORMAT_D: GUID_FORMAT_D,
  GUID_FORMAT_B: GUID_FORMAT_B,
  GUID_FORMAT_P: GUID_FORMAT_P,
  GUID_FORMAT_X: GUID_FORMAT_X
};



///--- Export all the childrenz

var k;

for (k in Protocol) {
  if (Protocol.hasOwnProperty(k))
    module.exports[k] = Protocol[k];
}

for (k in messages) {
  if (messages.hasOwnProperty(k))
    module.exports[k] = messages[k];
}

for (k in controls) {
  if (controls.hasOwnProperty(k))
    module.exports[k] = controls[k];
}

for (k in filters) {
  if (filters.hasOwnProperty(k)) {
    if (k !== 'parse' && k !== 'parseString')
      module.exports[k] = filters[k];
  }
}

for (k in errors) {
  if (errors.hasOwnProperty(k)) {
    module.exports[k] = errors[k];
  }
}

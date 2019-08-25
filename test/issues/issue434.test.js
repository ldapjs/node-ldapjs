var Logger = require('bunyan');

var test = require('tape').test;
var uuid = require('node-uuid');


///--- Globals

var ldap;
var Change;

test('issue #434', function (t) {
    ldap = require('../../lib/index');
    Change = ldap.Change;
    try {
      var change = new Change({
        type: 'Delete',
        modification: { cn: null }
      });
      t.ok(true);
      t.end();
    } catch (err) {
      t.ifError(err);
      t.end();
    }
  });
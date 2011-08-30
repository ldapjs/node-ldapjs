var assert = require('assert');

var ldap = require('../../lib/index');

var client = ldap.createClient({
  url: 'ldap://localhost:1389'
});


var finished = 0;
var ITERATIONS = 1024;
for (var i = 0; i < ITERATIONS; i++) {
  client.bind('cn=root', 'secret', function(err) {
    assert.ifError(err);
    if (++finished === ITERATIONS)
      client.unbind();
  });
}

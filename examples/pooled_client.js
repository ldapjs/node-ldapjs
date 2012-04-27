var Logger = require('bunyan');

var ldap = require('../lib/index');


///
// Run the "inmemory.js" server in the same directory
///

function ifError(err) {
  if (err) {
    console.error(err.stack);
    process.exit(1);
  }
}

var LOG = new Logger({
  name: 'ldapjs',
  stream: process.stderr,
  level: (process.env.LOG_LEVEL || 'info'),
  serializers: Logger.stdSerializers
});
var MAX_CONNS = process.env.LDAP_MAX_CONNS || 10;

var client = ldap.createClient({
  url: 'ldap://localhost:1389',
  maxConnections: MAX_CONNS,
  log: LOG
});

client.bind('cn=root', 'secret', function (err) {
  ifError(err);

  client.add('o=smartdc', {o: 'smartdc'}, function (err) {
    ifError(err);

    var finished = 0;
    for (var i = 0; i < MAX_CONNS; i++) {
      client.search('o=smartdc', function (err, res) {
        ifError(err);
        res.on('end', function () {
          if (++finished === (MAX_CONNS - 1)) {
            console.error('Go kill the LDAP server and restart it')
            setTimeout(function () {
              console.log('readding suffix');
              client.add('o=smartdc', {o: 'smartdc'}, function (err) {
                ifError(err);
                client.unbind(function () {
                  console.log('All done');
                  process.exit(0);
                });
              });
            }, 15000);
          }
        });
      });
    }
  });

});

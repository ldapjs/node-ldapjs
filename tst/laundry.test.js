// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var test = require('tap').test;
var uuid = require('node-uuid');

var ldap = require('../lib/index');


///--- Globals

var SOCKET = '/tmp/.' + uuid();

var client;
var server;


///--- Tests

test('setup', function(t) {
  server = ldap.createServer();
  t.ok(server);
  server.listen(SOCKET, function() {
    client = ldap.createClient({
      socketPath: SOCKET
    });
    t.ok(client);
    // client.log4js.setLevel('Debug');
    t.end();
  });
});


test('Evolution search filter (GH-3)', function(t) {
  var suffix = 'dc=' + uuid();
  var entry = {
    dn: 'cn=foo, ' + suffix,
    attributes: {
      objectclass: ['person', 'top'],
      cn: 'Pogo Stick',
      sn: 'Stick',
      givenname: 'ogo',
      mail: uuid() + '@pogostick.org'
    }
  };

  server.search(suffix, function(req, res, next) {
    console.log(req.filter.toString());
    if (req.filter.matches(entry.attributes))
      res.send(entry);
    res.end();
  });

  // This is what Evolution sends, when searching for a contact 'ogo'. Wow.
  var filter =
    '(|(cn=ogo*)(givenname=ogo*)(sn=ogo*)(mail=ogo*)(member=ogo*)' +
    '(primaryphone=ogo*)(telephonenumber=ogo*)(homephone=ogo*)(mobile=ogo*)' +
    '(carphone=ogo*)(facsimiletelephonenumber=ogo*)' +
    '(homefacsimiletelephonenumber=ogo*)(otherphone=ogo*)' +
    '(otherfacsimiletelephonenumber=ogo*)(internationalisdnnumber=ogo*)' +
    '(pager=ogo*)(radio=ogo*)(telex=ogo*)(assistantphone=ogo*)' +
    '(companyphone=ogo*)(callbackphone=ogo*)(tty=ogo*)(o=ogo*)(ou=ogo*)' +
    '(roomnumber=ogo*)(title=ogo*)(businessrole=ogo*)(managername=ogo*)' +
    '(assistantname=ogo*)(postaladdress=ogo*)(l=ogo*)(st=ogo*)' +
    '(postofficebox=ogo*)(postalcode=ogo*)(c=ogo*)(homepostaladdress=ogo*)' +
    '(mozillahomelocalityname=ogo*)(mozillahomestate=ogo*)' +
    '(mozillahomepostalcode=ogo*)(mozillahomecountryname=ogo*)' +
    '(otherpostaladdress=ogo*)(jpegphoto=ogo*)(usercertificate=ogo*)' +
    '(labeleduri=ogo*)(displayname=ogo*)(spousename=ogo*)(note=ogo*)' +
    '(anniversary=ogo*)(birthdate=ogo*)(mailer=ogo*)(fileas=ogo*)' +
    '(category=ogo*)(calcaluri=ogo*)(calfburl=ogo*)(icscalendar=ogo*))';

  client.search(suffix, filter, function(err, res) {
    t.ifError(err);
    t.ok(res);
    var found = false;
    res.on('searchEntry', function(entry) {
      t.ok(entry);
      found = true;
    });
    res.on('end', function() {
      t.ok(found);
      t.end();
    });
  });
});


test('shutdown', function(t) {
  client.unbind(function() {
    server.on('close', function() {
      t.end();
    });
    server.close();
  });
});

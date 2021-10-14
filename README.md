# LDAPjs

[![Build Status](https://github.com/ldapjs/node-ldapjs/workflows/Lint%20And%20Test/badge.svg)](https://github.com/ldapjs/node-ldapjs/actions)
[![Coverage Status](https://coveralls.io/repos/github/ldapjs/node-ldapjs/badge.svg)](https://coveralls.io/github/ldapjs/node-ldapjs/)

LDAPjs makes the LDAP protocol a first class citizen in Node.js.

## About this fork

This fork adds an socket API to the client: a way to customize the creation of the connection to the LDAP server. Under most circumstances, it's sufficient to pass a URL to `ldapjs` an allow `ldapjs` to create the TCP/TLS connection based on the URL. At Clever, we have a use case involving an explicit proxy, where we expect a client to connect to the proxy using HTTP CONNECT and then use the resulting TCP connection as the basis for LDAP. To facilitate this, we've added the `createConnection` option to the client constructor. An example usage can be found in [the client documentation](docs/client.md#using-createconnection-to-connect-through-a-proxy).

## Usage

For full docs, head on over to <http://ldapjs.org>.

```javascript
var ldap = require('ldapjs');

var server = ldap.createServer();

server.search('dc=example', function(req, res, next) {
  var obj = {
    dn: req.dn.toString(),
    attributes: {
      objectclass: ['organization', 'top'],
      o: 'example'
    }
  };

  if (req.filter.matches(obj.attributes))
  res.send(obj);

  res.end();
});

server.listen(1389, function() {
  console.log('ldapjs listening at ' + server.url);
});
```

To run that, assuming you've got the [OpenLDAP](http://www.openldap.org/)
client on your system:

    ldapsearch -H ldap://localhost:1389 -x -b dc=example objectclass=*

## Installation

    npm install ldapjs

DTrace support is included in ldapjs. To enable it, `npm install dtrace-provider`.

## License

MIT.

## Bugs

See <https://github.com/ldapjs/node-ldapjs/issues>.

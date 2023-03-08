# LDAPjs

[![Build Status](https://github.com/ldapjs/node-ldapjs/workflows/Lint%20And%20Test/badge.svg)](https://github.com/ldapjs/node-ldapjs/actions)
[![Coverage Status](https://coveralls.io/repos/github/ldapjs/node-ldapjs/badge.svg)](https://coveralls.io/github/ldapjs/node-ldapjs/)

LDAPjs makes the LDAP protocol a first class citizen in Node.js.

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

## Node.js Version Support

As of `ldapjs@3` we only support the active Node.js LTS releases.
See [https://github.com/nodejs/release#release-schedule][schedule] for the LTS
release schedule.

For a definitive list of Node.js version we support, see the version matrix
we test against in our [CI configuration][ci-config].

Note: given the release date of `ldapjs@3`, and the short window of time that
Node.js v14 had remaining on its LTS window, we opted to not support Node.js
v14 with `ldapjs@3` (we released late February 2023 and v14 goes into
maintenance in late April 2023). Also, Node.js v14 will be end-of-life (EOL) on
September 11, 2023; this is a very shortened EOL timeline and makes it even
more reasonable to not support it at this point.

[schedule]: https://github.com/nodejs/release#release-schedule
[ci-config]: https://github.com/ldapjs/node-ldapjs/blob/master/.github/workflows/main.yml

## License

MIT.

## Bugs

See <https://github.com/ldapjs/node-ldapjs/issues>.

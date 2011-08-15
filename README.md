ldapjs makes the LDAP protocol a first class citizen in node.js.

## Usage

For full docs, head on over to <http://ldapjs.org>.

    var ldap = require('ldapjs');

    var server = ldap.createServer();

    server.bind('cn=root', function(req, res, next) {
      if (req.credentials !== 'secret')
        return next(new ldap.InvalidCredentialsError());

      res.end();
    });

    server.search('dc=example', function(req, res, next) {
      var obj = {
        dn: req.dn.toString(),
	attributes: {
	  objectclass: 'helloworld',
	  cn: 'hello',
	  sn: 'world'
	}
      };

      if (req.filter.matches(obj))
        res.send(obj);

      res.end();
    });

    server.listen(1389, function() {
      console.log('ldapjs listening at ' + server.url);
    });

To run that, assuming you've got the [OpenLDAP](http://www.openldap.org/) client on
your system:

    $ ldapsearch -H ldap://localhost:1389 -x -D cn=root -w secret -b dc=example objectclass=*

## Installation

For now this is not published to npm.  Use at your own risk.

## License

MIT.

## Bugs

See <https://github.com/mcavage/node-ldapjs/issues>.

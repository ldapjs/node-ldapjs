# Ldapjs

[!['Build status'][travis_image_url]][travis_page_url]

[travis_image_url]: https://api.travis-ci.org/mcavage/node-ldapjs.png
[travis_page_url]: https://travis-ci.org/mcavage/node-ldapjs

ldapjs makes the LDAP protocol a first class citizen in Node.js.

## Usage

For full docs, head on over to <http://ldapjs.org>.

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

To run that, assuming you've got the [OpenLDAP](http://www.openldap.org/) client
on your system:

    ldapsearch -H ldap://localhost:1389 -x -b dc=example objectclass=*

## Installation

    npm install ldapjs
    
## Formatting objectGUID attribute value

    var ldap = require('ldapjs');
    
    ldap.Attribute.settings.guid_format = ldap.GUID_FORMAT_B;
    
    var client = ldap.createClient({
      url: 'ldap://127.0.0.1/CN=test,OU=Development,DC=Home'
    });
    
    var opts = {
      filter: '(objectclass=user)',
      scope: 'sub',
      attributes: ['objectGUID']
    };
    
    client.bind('username', 'password', function (err) {
      client.search('CN=test,OU=Development,DC=Home', opts, function (err, search) {
        search.on('searchEntry', function (entry) {
          var user = entry.object;
          console.log(user.objectGUID);
        });
      });
    });

_Note: for the sake of simplicity all checks and error handling was removed from the sample above._

The console output may be similar to the following (depending on the amount of users in the directory):

    {a7667bb1-4aee-48ce-9d9d-a1193550deba}
    {8d642ac8-14c6-4f27-ac5-94d39833da88}
    
Available formatting modes:

    GUID_FORMAT_N
        N specifier, 32 digits:
        00000000000000000000000000000000
    GUID_FORMAT_D
        D specifier, 32 digits separated by hypens:
        00000000-0000-0000-0000-000000000000
    GUID_FORMAT_B
        B specifier, 32 digits separated by hyphens, enclosed in braces:
        {00000000-0000-0000-0000-000000000000}
    GUID_FORMAT_P
        P speficier, 32 digits separated by hyphens, enclosed in parentheses:
        (00000000-0000-0000-0000-000000000000)
    GUID_FORMAT_X
        X speficier, four hexadecimal values enclosed in braces,
        where the fourth value is a subset of eight hexadecimal values that is also enclosed in braces:
        {0x00000000,0x0000,0x0000,{0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00}}

Guid formatting is unobtrusive by default. You should explicitly define formatting mode in order to enable it. 

## License

MIT.

## Bugs

See <https://github.com/mcavage/node-ldapjs/issues>.

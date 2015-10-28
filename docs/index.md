---
title: ldapjs
markdown2extras: tables
---

<div id="indextagline">
Reimagining <a href="http://tools.ietf.org/html/rfc4510" id="indextaglink">LDAP</a> for <a id="indextaglink" href="http://nodejs.org">Node.js</a>
</div>

# Overview

ldapjs is a pure JavaScript, from-scratch framework for implementing
[LDAP](http://tools.ietf.org/html/rfc4510) clients and servers in
[Node.js](http://nodejs.org).  It is intended for developers used to interacting
with HTTP services in node and [restify](http://restify.com).

    var ldap = require('ldapjs');

    var server = ldap.createServer();

    server.search('o=example', function(req, res, next) {
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
      console.log('LDAP server listening at %s', server.url);
    });

Try hitting that with:

    $ ldapsearch -H ldap://localhost:1389 -x -b o=example objectclass=*

# Features

ldapjs implements most of the common operations in the LDAP v3 RFC(s), for
both client and server.  It is 100% wire-compatible with the LDAP protocol
itself, and is interoperable with [OpenLDAP](http://openldap.org) and any other
LDAPv3-compliant implementation.  ldapjs gives you a powerful routing and
"intercepting filter" pattern for implementing server(s).  It is intended
that you can build LDAP over anything you want, not just traditional databases.

# Getting started

    $ npm install ldapjs

If you're new to LDAP, check out the [guide](guide.html).  Otherwise, the
API documentation is:


|Section                    |Content                                    |
|---------------------------|-------------------------------------------|
|[Server API](server.html)  |Reference for implementing LDAP servers.   |
|[Client API](client.html)  |Reference for implementing LDAP clients.   |
|[DN API](dn.html)          |API reference for the DN class.            |
|[Filter API](filters.html) |API reference for LDAP search filters.     |
|[Error API](errors.html)   |Listing of all ldapjs Error objects.       |
|[Examples](examples.html)  |Collection of sample/getting started code. |

# More information

- License:[MIT](http://opensource.org/licenses/mit-license.php)
- Code: [mcavage/node-ldapjs](https://github.com/mcavage/node-ldapjs)
- node.js version: >=0.8
- Twitter: [@pfmooney](http://twitter.com/pfmooney)

# What's not in the box?

Since most developers and system(s) adminstrators struggle with some of the
esoteric features of LDAP, not all features in LDAP are implemented here.
Specifically:

* LDIF
* Aliases
* Attributes by OID
* Extensible matching

There are a few others, but those are the "big" ones.



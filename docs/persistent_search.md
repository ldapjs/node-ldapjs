---
titile: Persistent Search Cache API| ldapjs
markdown2extras: wiki-tables
logo-color: green
logo-font-family: google:Aldrich, Verdana, sans-serif
header-font-family: google:Aldrich, Verdana, sans-serif
---

# ldapjs Persistent Search Cache API

This document covers the ldapjs Persistent Search Cache API and assumes you are familiar with LDAP. If you're not, read the [guide](http://ldapjs.org/guide.html) first.

This document also assumes you are familiar with LDAP persistent search. If you're not, read the [rfc](http://tools.ietf.org/id/draft-ietf-ldapext-psearch-03.txt) first.

Note this API is a cache used to store all connected persistent search clients, and does not actually implement persistent search.

# addClient(req, res, callback)

Adds a client to the cache.

# removeClient(req, res, callback)

Removes a client from the cache.
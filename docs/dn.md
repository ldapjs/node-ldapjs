---
title: DN API | ldapjs
---

# ldapjs DN API

<div class="intro">

This document covers the ldapjs DN API and assumes that you are familiar
with LDAP. If you're not, read the [guide](guide.html) first.

</div>

DNs are LDAP distinguished names, and are composed of a set of RDNs (relative
distinguished names).  [RFC2253](http://www.ietf.org/rfc/rfc2253.txt) has the
complete specification, but basically an RDN is an attribute value assertion
with `=` as the seperator, like: `cn=foo` where 'cn' is 'commonName' and 'foo'
is the value.  You can have compound RDNs by using the `+` character:
`cn=foo+sn=bar`.  As stated above, DNs are a set of RDNs, typically separated
with the `,` character, like:  `cn=foo, ou=people, o=example`.  This uniquely
identifies an entry in the tree, and is read "bottom up".

# parseDN(dnString)

The `parseDN` API converts a string representation of a DN into an ldapjs DN
object; in most cases this will be handled for you under the covers of the
ldapjs framework, but if you need it, it's there.

```js
const parseDN = require('ldapjs').parseDN;

const dn = parseDN('cn=foo+sn=bar, ou=people, o=example');
console.log(dn.toString());
```

# DN

The DN object is largely what you'll be interacting with, since all the server
APIs are setup to give you a DN object.

## childOf(dn)

Returns a boolean indicating whether 'this' is a child of the passed in dn. The
`dn` argument can be either a string or a DN.

```js
server.add('o=example', (req, res, next) => {
  if (req.dn.childOf('ou=people, o=example')) {
    ...
  } else {
    ...
  }
});
```

## parentOf(dn)

The inverse of `childOf`; returns a boolean on whether or not `this` is a parent
of the passed in dn.  Like `childOf`, can take either a string or a DN.

```js
server.add('o=example', (req, res, next) => {
  const dn = parseDN('ou=people, o=example');
  if (dn.parentOf(req.dn)) {
    ...
  } else {
    ...
  }
});
```

## equals(dn)

Returns a boolean indicating whether `this` is equivalent to the passed in `dn`
argument. `dn` can be a string or a DN.

```js
server.add('o=example', (req, res, next) => {
  if (req.dn.equals('cn=foo, ou=people, o=example')) {
    ...
  } else {
    ...
  }
});
```

## parent()

Returns a DN object that is the direct parent of `this`.  If there is no parent
this can return `null` (e.g. `parseDN('o=example').parent()` will return null).


## format(options)

Convert a DN object to string according to specified formatting options.  These
options are divided into two types.  Preservation Options use data recorded
during parsing to preserve details of the original DN. Modification options
alter string formatting defaults.  Preservation options _always_ take
precedence over Modification Options.

Preservation Options:

 - `keepOrder`: Order of multi-value RDNs.
 - `keepQuote`: RDN values which were quoted will remain so.
 - `keepSpace`: Leading/trailing spaces will be output.
 - `keepCase`: Parsed attribute name will be output instead of lowercased version.

Modification Options:

- `upperName`: RDN names will be uppercased instead of lowercased.
- `skipSpace`: Disable trailing space after RDN separators

## setFormat(options)

Sets the default `options` for string formatting when `toString` is called.
It accepts the same parameters as `format`.


## toString()

Returns the string representation of `this`.

```js
server.add('o=example', (req, res, next) => {
  console.log(req.dn.toString());
});
```

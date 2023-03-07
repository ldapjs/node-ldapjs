---
title: Client API | ldapjs
---

# ldapjs Client API

<div class="intro">

This document covers the ldapjs client API and assumes that you are familiar
with LDAP. If you're not, read the [guide](guide.html) first.

</div>

# Create a client

The code to create a new client looks like:

```js
const ldap = require('ldapjs');

const client = ldap.createClient({
  url: ['ldap://127.0.0.1:1389', 'ldap://127.0.0.2:1389']
});

client.on('connectError', (err) => {
  // handle connection error
})
```

You can use `ldap://` or `ldaps://`; the latter would connect over SSL (note
that this will not use the LDAP TLS extended operation, but literally an SSL
connection to port 636, as in LDAP v2). The full set of options to create a
client is:

|Attribute      |Description                                                |
|---------------|-----------------------------------------------------------|
|url            |A string or array of valid LDAP URL(s) (proto/host/port)   |
|socketPath     |Socket path if using AF\_UNIX sockets                      |
|log            |A compatible logger instance (Default: no-op logger)       |
|timeout        |Milliseconds client should let operations live for before timing out (Default: Infinity)|
|connectTimeout |Milliseconds client should wait before timing out on TCP connections (Default: OS default)|
|tlsOptions     |Additional options passed to TLS connection layer when connecting via `ldaps://` (See: The TLS docs for node.js)|
|idleTimeout    |Milliseconds after last activity before client emits idle event|
|reconnect      |Try to reconnect when the connection gets lost (Default is false)|

### url
This parameter takes a single connection string or an array of connection strings
as an input. In case an array is provided, the client tries to connect to the
servers in given order. To achieve random server strategy (e.g. to distribute
the load among the servers), please shuffle the array before passing it as an
argument.

### Note On Logger

A passed in logger is expected to conform to the [Bunyan](https://www.npmjs.com/package/bunyan)
API. Specifically, the logger is expected to have a `child()` method. If a logger
is supplied that does not have such a method, then a shim version is added
that merely returns the passed in logger.

Known compatible loggers are:

+ [Bunyan](https://www.npmjs.com/package/bunyan)
+ [Pino](https://www.npmjs.com/package/pino)


### Note On Error Handling

The client is an `EventEmitter`. If you don't register an error handler and
e.g. a connection error occurs, Node.js will print a stack trace and exit the
process ([reference](https://nodejs.org/api/events.html#error-events)).

## Connection management

As LDAP is a stateful protocol (as opposed to HTTP), having connections torn
down from underneath you can be difficult to deal with. Several mechanisms
have been provided to mitigate this trouble.

### Reconnect

You can provide a Boolean option indicating if a reconnect should be tried. For
more sophisticated control, you can provide an Object with the properties
`initialDelay` (default: `100`), `maxDelay` (default: `10000`) and
`failAfter` (default: `Infinity`).
After the reconnect you maybe need to [bind](#bind) again.

## Client events

The client is an `EventEmitter` and can emit the following events:

|Event          |Description                                               |
|---------------|----------------------------------------------------------|
|error          |General error                                             |
|connectRefused |Server refused connection. Most likely bad authentication |
|connectTimeout |Server timeout                                            |
|connectError   |Socket connection error                                   |
|setupError     |Setup error after successful connection                   |
|socketTimeout  |Socket timeout                                            |
|resultError    |Search result error                                       |
|timeout        |Search result timeout                                     |
|destroy        |After client is disconnected                              |
|end            |Socket end event                                          |
|close          |Socket closed                                             |
|connect        |Client connected                                          |
|idle           |Idle timeout reached                                      |

## Common patterns

The last two parameters in every API are `controls` and `callback`. `controls`
can be either a single instance of a `Control` or an array of `Control` objects.
You can, and probably will, omit this option.

Almost every operation has the callback form of `function(err, res)` where err
will be an instance of an `LDAPError` (you can use `instanceof` to switch).
You probably won't need to check the `res` parameter, but it's there if you do.

# bind
`bind(dn, password, controls, callback)`

Performs a bind operation against the LDAP server.

The bind API only allows LDAP 'simple' binds (equivalent to HTTP Basic
Authentication) for now. Note that all client APIs can optionally take an array
of `Control` objects. You probably don't need them though...

Example:

```js
client.bind('cn=root', 'secret', (err) => {
  assert.ifError(err);
});
```

# add
`add(dn, entry, controls, callback)`

Performs an add operation against the LDAP server.

Allows you to add an entry (which is just a plain JS object), and as always,
controls are optional.

Example:

```js
const entry = {
  cn: 'foo',
  sn: 'bar',
  email: ['foo@bar.com', 'foo1@bar.com'],
  objectclass: 'fooPerson'
};
client.add('cn=foo, o=example', entry, (err) => {
  assert.ifError(err);
});
```

# compare
`compare(dn, attribute, value, controls, callback)`

Performs an LDAP compare operation with the given attribute and value against
the entry referenced by dn.

Example:

```js
client.compare('cn=foo, o=example', 'sn', 'bar', (err, matched) => {
  assert.ifError(err);

  console.log('matched: ' + matched);
});
```

# del
`del(dn, controls, callback)`


Deletes an entry from the LDAP server.

Example:

```js
client.del('cn=foo, o=example', (err) => {
  assert.ifError(err);
});
```

# exop
`exop(name, value, controls, callback)`

Performs an LDAP extended operation against an LDAP server. `name` is typically
going to be an OID (well, the RFC says it must be; however, ldapjs has no such
restriction).  `value` is completely arbitrary, and is whatever the exop says it
should be.

Example (performs an LDAP 'whois' extended op):

```js
client.exop('1.3.6.1.4.1.4203.1.11.3', (err, value, res) => {
  assert.ifError(err);

  console.log('whois: ' + value);
});
```

# modify
`modify(name, changes, controls, callback)`

Performs an LDAP modify operation against the LDAP server.  This API requires
you to pass in a `Change` object, which is described below.  Note that you can
pass in a single `Change` or an array of `Change` objects.

Example:

```js
const change = new ldap.Change({
  operation: 'add',
  modification: {
    pets: ['cat', 'dog']
  }
});

client.modify('cn=foo, o=example', change, (err) => {
  assert.ifError(err);
});
```

## Change

A `Change` object maps to the LDAP protocol of a modify change, and requires you
to set the `operation` and `modification`.  The `operation` is a string, and
must be one of:

| Operation | Description |
|-----------|-------------|
| replace   | Replaces the attribute referenced in `modification`.  If the modification has no values, it is equivalent to a delete. |
| add       | Adds the attribute value(s) referenced in `modification`.  The attribute may or may not already exist. |
| delete    | Deletes the attribute (and all values) referenced in `modification`. |

`modification` is just a plain old JS object with the values you want.

# modifyDN
`modifyDN(dn, newDN, controls, callback)`

Performs an LDAP modifyDN (rename) operation against an entry in the LDAP
server.  A couple points with this client API:

* There is no ability to set "keep old dn."  It's always going to flag the old
dn to be purged.
* The client code will automatically figure out if the request is a "new
superior" request ("new superior" means move to a different part of the tree,
as opposed to just renaming the leaf).

Example:

```js
client.modifyDN('cn=foo, o=example', 'cn=bar', (err) => {
  assert.ifError(err);
});
```

# search
`search(base, options, controls, callback)`

Performs a search operation against the LDAP server.

The search operation is more complex than the other operations, so this one
takes an `options` object for all the parameters.  However, ldapjs makes some
defaults for you so that if you pass nothing in, it's pretty much equivalent
to an HTTP GET operation (i.e., base search against the DN, filter set to
always match).

Like every other operation, `base` is a DN string.

Options can be a string representing a valid LDAP filter or an object
containing the following fields:

|Attribute  |Description                                        |
|-----------|---------------------------------------------------|
|scope      |One of `base`, `one`, or `sub`. Defaults to `base`.|
|filter     |A string version of an LDAP filter (see below), or a programatically constructed `Filter` object. Defaults to `(objectclass=*)`.|
|attributes |attributes to select and return (if these are set, the server will return *only* these attributes). Defaults to the empty set, which means all attributes. You can provide a string if you want a single attribute or an array of string for one or many.|
|attrsOnly  |boolean on whether you want the server to only return the names of the attributes, and not their values.  Borderline useless.  Defaults to false.|
|sizeLimit  |the maximum number of entries to return. Defaults to 0 (unlimited).|
|timeLimit  |the maximum amount of time the server should take in responding, in seconds. Defaults to 10.  Lots of servers will ignore this.|
|paged      |enable and/or configure automatic result paging|

Responses inside callback of the `search` method are an `EventEmitter` where you will get a notification for
each `searchEntry` that comes back from the server. You will additionally be able to listen for a `searchRequest`
, `searchReference`, `error` and `end` event.
`searchRequest` is emitted immediately after every `SearchRequest` is sent with a `SearchRequest` parameter. You can do operations
like `client.abandon` with `searchRequest.messageId` to abandon this search request. Note that the `error` event will
only be for client/TCP errors, not LDAP error codes like the other APIs. You'll want to check the LDAP status code
(likely for `0`) on the `end` event to assert success. LDAP search results can give you a lot of status codes, such as
time or size exceeded, busy, inappropriate matching, etc., which is why this method doesn't try to wrap up the code
matching.

Example:

```js
const opts = {
  filter: '(&(l=Seattle)(email=*@foo.com))',
  scope: 'sub',
  attributes: ['dn', 'sn', 'cn']
};

client.search('o=example', opts, (err, res) => {
  assert.ifError(err);

  res.on('searchRequest', (searchRequest) => {
    console.log('searchRequest: ', searchRequest.messageId);
  });
  res.on('searchEntry', (entry) => {
    console.log('entry: ' + JSON.stringify(entry.pojo));
  });
  res.on('searchReference', (referral) => {
    console.log('referral: ' + referral.uris.join());
  });
  res.on('error', (err) => {
    console.error('error: ' + err.message);
  });
  res.on('end', (result) => {
    console.log('status: ' + result.status);
  });
});
```

## Filter Strings

The easiest way to write search filters is to write them compliant with RFC2254,
which is "The string representation of LDAP search filters."  Note that
ldapjs doesn't support extensible matching, since it's one of those features
that almost nobody actually uses in practice.

Assuming you don't really want to read the RFC, search filters in LDAP are
basically are a "tree" of attribute/value assertions, with the tree specified
in prefix notation.  For example, let's start simple, and build up a complicated
filter.  The most basic filter is equality, so let's assume you want to search
for an attribute `email` with a value of `foo@bar.com`.  The syntax would be:

```
(email=foo@bar.com)
```

ldapjs requires all filters to be surrounded by '()' blocks. Ok, that was easy.
Let's now assume that you want to find all records where the email is actually
just anything in the "@bar.com" domain and the location attribute is set to
Seattle:

```
(&(email=*@bar.com)(l=Seattle))
```

Now our filter is actually three LDAP filters.  We have an `and` filter (single
amp `&`), an `equality` filter `(the l=Seattle)`, and a `substring` filter.
Substrings are wildcard filters. They use `*` as the wildcard. You can put more
than one wildcard for a given string. For example you could do `(email=*@*bar.com)`
to match any email of @bar.com or its subdomains like `"example@foo.bar.com"`.

Now, let's say we also want to set our filter to include a
specification that either the employeeType *not* be a manager nor a secretary:

```
(&(email=*@bar.com)(l=Seattle)(!(|(employeeType=manager)(employeeType=secretary))))
```

The `not` character is represented as a `!`, the `or` as a single pipe `|`.
It gets a little bit complicated, but it's actually quite powerful, and lets you
find almost anything you're looking for.

## Paging
Many LDAP server enforce size limits upon the returned result set (commonly
1000).  In order to retrieve results beyond this limit, a `PagedResultControl`
is passed between the client and server to iterate through the entire dataset.
While callers could choose to do this manually via the `controls` parameter to
`search()`, ldapjs has internal mechanisms to easily automate the process.  The
most simple way to use the paging automation is to set the `paged` option to
true when performing a search:

```js
const opts = {
  filter: '(objectclass=commonobject)',
  scope: 'sub',
  paged: true,
  sizeLimit: 200
};
client.search('o=largedir', opts, (err, res) => {
  assert.ifError(err);
  res.on('searchEntry', (entry) => {
    // do per-entry processing
  });
  res.on('page', (result) => {
    console.log('page end');
  });
  res.on('error', (resErr) => {
    assert.ifError(resErr);
  });
  res.on('end', (result) => {
    console.log('done ');
  });
});
```

This will enable paging with a default page size of 199 (`sizeLimit` - 1) and
will output all of the resulting objects via the `searchEntry` event.  At the
end of each result during the operation, a `page` event will be emitted as
well (which includes the intermediate `searchResult` object).

For those wanting more precise control over the process, an object with several
parameters can be provided for the `paged` option.  The `pageSize` parameter
sets the size of result pages requested from the server.  If no value is
specified, it will fall back to the default (100 or `sizeLimit` - 1, to obey
the RFC).  The `pagePause` parameter allows back-pressure to be exerted on the
paged search operation by pausing  at the end of each page.  When enabled, a
callback function is passed as an additional parameter to `page` events.  The
client will wait to request the next page until that callback is executed.

Here is an example where both of those parameters are used:

```js
const queue = new MyWorkQueue(someSlowWorkFunction);
const opts = {
  filter: '(objectclass=commonobject)',
  scope: 'sub',
  paged: {
    pageSize: 250,
    pagePause: true
  },
};
client.search('o=largerdir', opts, (err, res) => {
  assert.ifError(err);
  res.on('searchEntry', (entry) => {
    // Submit incoming objects to queue
    queue.push(entry);
  });
  res.on('page', (result, cb) => {
    // Allow the queue to flush before fetching next page
    queue.cbWhenFlushed(cb);
  });
  res.on('error', (resErr) => {
    assert.ifError(resErr);
  });
  res.on('end', (result) => {
    console.log('done');
  });
});
```

# starttls
`starttls(options, controls, callback)`

Attempt to secure existing LDAP connection via STARTTLS.

Example:

```js
const opts = {
  ca: [fs.readFileSync('mycacert.pem')]
};

client.starttls(opts, (err, res) => {
  assert.ifError(err);

  // Client communication now TLS protected
});
```


# unbind
`unbind(callback)`

Performs an unbind operation against the LDAP server.

Note that unbind operation is not an opposite operation
for bind. Unbinding results in disconnecting the client
regardless of whether a bind operation was performed.

The `callback` argument is optional as unbind does
not have a response.

Example:

```js
client.unbind((err) => {
  assert.ifError(err);
});
```

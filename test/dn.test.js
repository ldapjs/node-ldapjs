'use strict'

const { test } = require('tap')
const { dn } = require('../lib')

test('parse basic', function (t) {
  const DN_STR = 'cn=mark, ou=people, o=joyent'
  const name = dn.parse(DN_STR)
  t.ok(name)
  t.ok(name.rdns)
  t.ok(Array.isArray(name.rdns))
  t.equal(3, name.rdns.length)
  name.rdns.forEach(function (rdn) {
    t.equal('object', typeof (rdn))
  })
  t.equal(name.toString(), DN_STR)
  t.end()
})

test('parse escaped', function (t) {
  const DN_STR = 'cn=m\\,ark, ou=people, o=joyent'
  const name = dn.parse(DN_STR)
  t.ok(name)
  t.ok(name.rdns)
  t.ok(Array.isArray(name.rdns))
  t.equal(3, name.rdns.length)
  name.rdns.forEach(function (rdn) {
    t.equal('object', typeof (rdn))
  })
  t.equal(name.toString(), DN_STR)
  t.end()
})

test('parse compound', function (t) {
  const DN_STR = 'cn=mark+sn=cavage, ou=people, o=joyent'
  const name = dn.parse(DN_STR)
  t.ok(name)
  t.ok(name.rdns)
  t.ok(Array.isArray(name.rdns))
  t.equal(3, name.rdns.length)
  name.rdns.forEach(function (rdn) {
    t.equal('object', typeof (rdn))
  })
  t.equal(name.toString(), DN_STR)
  t.end()
})

test('parse quoted', function (t) {
  const DN_STR = 'cn="mark+sn=cavage", ou=people, o=joyent'
  const ESCAPE_STR = 'cn=mark\\+sn\\=cavage, ou=people, o=joyent'
  const name = dn.parse(DN_STR)
  t.ok(name)
  t.ok(name.rdns)
  t.ok(Array.isArray(name.rdns))
  t.equal(3, name.rdns.length)
  name.rdns.forEach(function (rdn) {
    t.equal('object', typeof (rdn))
  })
  t.equal(name.toString(), ESCAPE_STR)
  t.end()
})

test('equals', function (t) {
  const dn1 = dn.parse('cn=foo,dc=bar')
  t.ok(dn1.equals('cn=foo,dc=bar'))
  t.ok(!dn1.equals('cn=foo1,dc=bar'))
  t.ok(dn1.equals(dn.parse('cn=foo,dc=bar')))
  t.ok(!dn1.equals(dn.parse('cn=foo2,dc=bar')))
  t.end()
})

test('child of', function (t) {
  const dn1 = dn.parse('cn=foo,dc=bar')
  t.ok(dn1.childOf('dc=bar'))
  t.ok(!dn1.childOf('dc=moo'))
  t.ok(!dn1.childOf('dc=foo'))
  t.ok(!dn1.childOf('cn=foo,dc=bar'))

  t.ok(dn1.childOf(dn.parse('dc=bar')))
  t.end()
})

test('parent of', function (t) {
  const dn1 = dn.parse('cn=foo,dc=bar')
  t.ok(dn1.parentOf('cn=moo,cn=foo,dc=bar'))
  t.ok(!dn1.parentOf('cn=moo,cn=bar,dc=foo'))
  t.ok(!dn1.parentOf('cn=foo,dc=bar'))

  t.ok(dn1.parentOf(dn.parse('cn=moo,cn=foo,dc=bar')))
  t.end()
})

test('DN parent', function (t) {
  const _dn = dn.parse('cn=foo,ou=bar')
  const parent1 = _dn.parent()
  const parent2 = parent1.parent()
  t.ok(parent1.equals('ou=bar'))
  t.ok(parent2.equals(''))
  t.equal(parent2.parent(), null)
  t.end()
})

test('empty DNs', function (t) {
  const _dn = dn.parse('')
  const _dn2 = dn.parse('cn=foo')
  t.ok(_dn.isEmpty())
  t.notOk(_dn2.isEmpty())
  t.notOk(_dn.equals('cn=foo'))
  t.notOk(_dn2.equals(''))
  t.ok(_dn.parentOf('cn=foo'))
  t.notOk(_dn.childOf('cn=foo'))
  t.notOk(_dn2.parentOf(''))
  t.ok(_dn2.childOf(''))
  t.end()
})

test('case insensitive attribute names', function (t) {
  const dn1 = dn.parse('CN=foo,dc=bar')
  t.ok(dn1.equals('cn=foo,dc=bar'))
  t.ok(dn1.equals(dn.parse('cn=foo,DC=bar')))
  t.end()
})

test('format', function (t) {
  const DN_ORDER = dn.parse('sn=bar+cn=foo,ou=test')
  const DN_QUOTE = dn.parse('cn="foo",ou=test')
  const DN_QUOTE2 = dn.parse('cn=" foo",ou=test')
  const DN_SPACE = dn.parse('cn=foo,ou=test')
  const DN_SPACE2 = dn.parse('cn=foo ,ou=test')
  const DN_CASE = dn.parse('CN=foo,Ou=test')

  t.equal(DN_ORDER.format({ keepOrder: false }), 'cn=foo+sn=bar, ou=test')
  t.equal(DN_ORDER.format({ keepOrder: true }), 'sn=bar+cn=foo, ou=test')

  t.equal(DN_QUOTE.format({ keepQuote: false }), 'cn=foo, ou=test')
  t.equal(DN_QUOTE.format({ keepQuote: true }), 'cn="foo", ou=test')
  t.equal(DN_QUOTE2.format({ keepQuote: false }), 'cn=" foo", ou=test')
  t.equal(DN_QUOTE2.format({ keepQuote: true }), 'cn=" foo", ou=test')

  t.equal(DN_SPACE.format({ keepSpace: false }), 'cn=foo, ou=test')
  t.equal(DN_SPACE.format({ keepSpace: true }), 'cn=foo,ou=test')
  t.equal(DN_SPACE.format({ skipSpace: true }), 'cn=foo,ou=test')
  t.equal(DN_SPACE2.format({ keepSpace: false }), 'cn=foo, ou=test')
  t.equal(DN_SPACE2.format({ keepSpace: true }), 'cn=foo ,ou=test')
  t.equal(DN_SPACE2.format({ skipSpace: true }), 'cn=foo,ou=test')

  t.equal(DN_CASE.format({ keepCase: false }), 'cn=foo, ou=test')
  t.equal(DN_CASE.format({ keepCase: true }), 'CN=foo, Ou=test')
  t.equal(DN_CASE.format({ upperName: true }), 'CN=foo, OU=test')
  t.end()
})

test('set format', function (t) {
  const _dn = dn.parse('uid="user",  sn=bar+cn=foo, dc=test , DC=com')
  t.equal(_dn.toString(), 'uid=user, cn=foo+sn=bar, dc=test, dc=com')
  _dn.setFormat({ keepOrder: true })
  t.equal(_dn.toString(), 'uid=user, sn=bar+cn=foo, dc=test, dc=com')
  _dn.setFormat({ keepQuote: true })
  t.equal(_dn.toString(), 'uid="user", cn=foo+sn=bar, dc=test, dc=com')
  _dn.setFormat({ keepSpace: true })
  t.equal(_dn.toString(), 'uid=user,  cn=foo+sn=bar, dc=test , dc=com')
  _dn.setFormat({ keepCase: true })
  t.equal(_dn.toString(), 'uid=user, cn=foo+sn=bar, dc=test, DC=com')
  _dn.setFormat({ upperName: true })
  t.equal(_dn.toString(), 'UID=user, CN=foo+SN=bar, DC=test, DC=com')
  t.end()
})

test('format persists across clone', function (t) {
  const _dn = dn.parse('uid="user",  sn=bar+cn=foo, dc=test , DC=com')
  const OUT = 'UID="user", CN=foo+SN=bar, DC=test, DC=com'
  _dn.setFormat({ keepQuote: true, upperName: true })
  const clone = _dn.clone()
  t.equal(_dn.toString(), OUT)
  t.equal(clone.toString(), OUT)
  t.end()
})

test('initialization', function (t) {
  const dn1 = new dn.DN()
  t.ok(dn1)
  t.equal(dn1.toString(), '')
  t.ok(dn1.isEmpty(), 'DN with no initializer defaults to null DN')

  const data = [
    new dn.RDN({ foo: 'bar' }),
    new dn.RDN({ o: 'base' })
  ]
  const dn2 = new dn.DN(data)
  t.ok(dn2)
  t.equal(dn2.toString(), 'foo=bar, o=base')
  t.ok(!dn2.isEmpty())

  t.end()
})

test('array functions', function (t) {
  const dn1 = dn.parse('a=foo, b=bar, c=baz')
  t.ok(dn1)
  t.equal(dn1.toString(), 'a=foo, b=bar, c=baz')

  t.ok(dn1.reverse())
  t.equal(dn1.toString(), 'c=baz, b=bar, a=foo')

  let rdn = dn1.pop()
  t.ok(rdn)
  t.equal(dn1.toString(), 'c=baz, b=bar')

  t.ok(dn1.push(rdn))
  t.equal(dn1.toString(), 'c=baz, b=bar, a=foo')

  rdn = dn1.shift()
  t.ok(rdn)
  t.equal(dn1.toString(), 'b=bar, a=foo')

  t.ok(dn1.unshift(rdn))
  t.equal(dn1.toString(), 'c=baz, b=bar, a=foo')

  t.end()
})

test('isDN duck-testing', function (t) {
  const valid = dn.parse('cn=foo')
  const isDN = dn.DN.isDN
  t.notOk(isDN(null))
  t.notOk(isDN('cn=foo'))
  t.ok(isDN(valid))
  const duck = {
    rdns: [{ look: 'ma' }, { a: 'dn' }],
    toString: function () { return 'look=ma, a=dn' }
  }
  t.ok(isDN(duck))
  t.end()
})

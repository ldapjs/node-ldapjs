'use strict'

const { test } = require('tap')
const { BerReader, BerWriter } = require('asn1')
const { BindResponse } = require('../../lib')
const { LDAP_SASL_BIND_IN_PROGRESS } = require('../../lib/errors/codes')

test('new no args', function (t) {
  t.ok(new BindResponse())
  t.end()
})

test('new with args', function (t) {
  const res = new BindResponse({
    messageID: 123,
    status: 0
  })
  t.ok(res)
  t.equal(res.messageID, 123)
  t.equal(res.status, 0)
  t.end()
})

test('parse', function (t) {
  const ber = new BerWriter()
  ber.writeEnumeration(0)
  ber.writeString('cn=root')
  ber.writeString('foo')

  const res = new BindResponse()
  t.ok(res._parse(new BerReader(ber.buffer)))
  t.equal(res.status, 0)
  t.equal(res.matchedDN, 'cn=root')
  t.equal(res.errorMessage, 'foo')
  t.end()
})

test('toBer', function (t) {
  const res = new BindResponse({
    messageID: 123,
    status: 3,
    matchedDN: 'cn=root',
    errorMessage: 'foo'
  })
  t.ok(res)

  const ber = new BerReader(res.toBer())
  t.ok(ber)
  t.equal(ber.readSequence(), 0x30)
  t.equal(ber.readInt(), 123)
  t.equal(ber.readSequence(), 0x61)
  t.equal(ber.readEnumeration(), 3)
  t.equal(ber.readString(), 'cn=root')
  t.equal(ber.readString(), 'foo')

  t.end()
})

test('parse sasl type2', function (t) {
  // The indentation here is what you'd see in Wireshark
  const saslBuffer = Buffer.from(
    /*     */ '0a010e' + '0400040087820106' +
    'a18201023081ffa0' + '030a0101a10c060a' +
    '2b06010401823702' + '020aa281e90481e6' +
    '4e544c4d53535000' + '020000000c000c00' +
    '38000000058289a2' + '55d832d48f53dc78' +
    '0000000000000000' + 'a200a20044000000' +
    '0a0039380000000f' + '54004c0054004700' +
    '4500530002000c00' + '54004c0054004700' +
    '4500530001001400' + '54004c0030003100' +
    '56002d0044004300' + '3000310004001800' +
    '54004c0054004700' + '450053002e006c00' +
    '6f00630061006c00' + '03002e0054004c00' +
    '3000310056002d00' + '4400430030003100' +
    '2e0054004c005400' + '4700450053002e00' +
    '6c006f0063006100' + '6c00050018005400' +
    '4c00540047004500' + '53002e006c006f00' +
    '630061006c000700' + '080003a77ac1cf16' +
    'd90100000000', 'hex')
  const res = new BindResponse()
  t.ok(res._parse(new BerReader(saslBuffer)))
  t.equal(res.status, LDAP_SASL_BIND_IN_PROGRESS)
  t.equal(res.matchedDN, '')
  t.equal(res.errorMessage, '')
  t.equal(res.saslChallange.length, 230)
  t.end()
})

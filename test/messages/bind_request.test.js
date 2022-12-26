'use strict'

const { test } = require('tap')
const { BerReader, BerWriter } = require('asn1')
const { BindRequest, dn } = require('../../lib')

test('new no args', function (t) {
  t.ok(new BindRequest())
  t.end()
})

test('new with args', function (t) {
  const req = new BindRequest({
    version: 3,
    name: dn.parse('cn=root'),
    credentials: 'secret'
  })
  t.ok(req)
  t.equal(req.version, 3)
  t.equal(req.name.toString(), 'cn=root')
  t.equal(req.credentials, 'secret')
  t.end()
})

test('parse', function (t) {
  const ber = new BerWriter()
  ber.writeInt(3)
  ber.writeString('cn=root')
  ber.writeString('secret', 0x80)

  const req = new BindRequest()
  t.ok(req._parse(new BerReader(ber.buffer)))
  t.equal(req.version, 3)
  t.equal(req.authentication, 'simple')
  t.equal(req.dn.toString(), 'cn=root')
  t.equal(req.credentials, 'secret')
  t.end()
})

test('toBer', function (t) {
  const req = new BindRequest({
    messageID: 123,
    version: 3,
    name: dn.parse('cn=root'),
    credentials: 'secret'
  })
  t.ok(req)

  const ber = new BerReader(req.toBer())
  t.ok(ber)
  t.equal(ber.readSequence(), 0x30)
  t.equal(ber.readInt(), 123)
  t.equal(ber.readSequence(), 0x60)
  t.equal(ber.readInt(), 0x03)
  t.equal(ber.readString(), 'cn=root')
  t.equal(ber.readString(0x80), 'secret')

  t.end()
})

test('parse sasl type1', function (t) {
  // The indentation here is what you'd see in Wireshark
  const saslBuffer = Buffer.from(
    /*                          */ '020103' + //               ...
    '0400a358040a4753' + '532d53504e45474f' + // ...x..GS S-SPNEGO
    '044a604806062b06' + '01050502a03e303c' + // ......+. .....>0<
    'a00e300c060a2b06' + '010401823702020a' + // ..0...+. ....7...
    'a22a04284e544c4d' + '5353500001000000' + // .*.(NTLM SSP.....
    '078208a200000000' + '0000000000000000' + // ........ ........
    '000000000a00614a' + '0000000f', 'hex') //   ......aJ ....
  const req = new BindRequest()
  t.ok(req._parse(new BerReader(saslBuffer)))
  t.equal(req.version, 3)
  t.equal(req.authentication, 'sasl')
  t.equal(req.ldapMechanism, 'GSS-SPNEGO')
  t.equal(req.gssapiOID, '1.3.6.1.5.5.2')
  t.equal(req.spnegoMechType, '1.3.6.1.4.1.311.2.2.10')
  t.equal(req.credentials.length, 40)
  t.end()
})

test('toBer sasl type1', function (t) {
  const token = '0123456789012345678901234567890123456789' // 40 bytes for Type1 token
  const req = new BindRequest({
    messageID: 123,
    version: 3,
    authentication: 'sasl',
    credentials: token
  })
  t.ok(req)

  const ldapmessage = req.toBer()
  const ber = new BerReader(ldapmessage)
  t.ok(ber)
  t.equal(ldapmessage.length, 102)
  t.equal(ber.readSequence(), 0x30)
  t.equal(ber.readInt(), 123)
  t.equal(ber.readSequence(), 0x60)
  t.equal(ber.readInt(), 0x03)
  t.equal(ber.readString(), '')
  t.equal(ber.readSequence(), 0xa3)
  t.equal(ber.readString(), 'GSS-SPNEGO')
  t.equal(ber.readSequence(), 0x04)
  t.equal(ber.readSequence(), 0x60) // sasl type1
  t.equal(ber.readOID(), '1.3.6.1.5.5.2')
  t.equal(ber.readSequence(), 0xa0)
  t.equal(ber.readSequence(), 0x30)
  t.equal(ber.readSequence(), 0xa0)
  t.equal(ber.readSequence(), 0x30)
  t.equal(ber.readOID(), '1.3.6.1.4.1.311.2.2.10')
  t.equal(ber.readSequence(), 0xa2)
  t.equal(ber.readString(), token)
  t.end()
})

test('parse sasl type3', function (t) {
  // The indentation here is what you'd see in Wireshark
  const saslBuffer = Buffer.from(
    '0201030400a382' + '022a040a4753532d' + //    ....... .*..GSS-
    '53504e45474f0482' + '021aa18202163082' + // SPNEGO.. ......0.
    '0212a282020e0482' + '020a4e544c4d5353' + // ........ ..NTLMSS
    '5000030000001800' + '18008a0000006801' + // P....... ......h.
    '6801a20000000c00' + '0c00580000000c00' +
    '0c00640000001a00' + '1a00700000000000' +
    '00000a0200000582' + '88a20a00614a0000' +
    '000fdeb54425491a' + '7704956ffc4a1f13' +
    '475944004f004d00' + '410049004e006d00' + // ..D.O.M. A.I.N.m.
    '7900750073006500' + '720043004f004d00' + // y.u.s.e. r.C.O.M.
    '5000550054004500' + '52002d004e004100' + // P.U.T.E. R.-.N.A.
    '4d00450000000000' + '0000000000000000' + // M.E..... ........
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '0000000000000000' + '0000000000000000' +
    '00000000', 'hex')
  const req = new BindRequest()
  t.ok(req._parse(new BerReader(saslBuffer)))
  t.equal(req.version, 3)
  t.equal(req.authentication, 'sasl')
  t.equal(req.ldapMechanism, 'GSS-SPNEGO')
  t.equal(req.ntlmsspIdentifier, 'NTLMSSP\x00')
  t.equal(req.ntlmsspMessageType, 3) // 3 means NTLMSSP_AUTH
  t.equal(req.ntlmsspDomain, 'DOMAIN')
  t.equal(req.ntlmsspUser, 'myuser')
  t.equal(req.ntlmsspHost, 'COMPUTER-NAME')
  t.equal(req.credentials.length, 522)
  t.end()
})

test('toBer sasl type3', function (t) {
  const token = 'NTLMSSP' + '\x00'.repeat(522 - 'NTLMSSP'.length) // 522 bytes for Type3 token
  const req = new BindRequest({
    messageID: 123,
    version: 3,
    authentication: 'sasl',
    credentials: token
  })
  t.ok(req)

  const ldapmessage = req.toBer()
  const ber = new BerReader(ldapmessage)
  t.ok(ber)
  t.equal(ldapmessage.length, 574)
  t.equal(ber.readSequence(), 0x30)
  t.equal(ber.readInt(), 123)
  t.equal(ber.readSequence(), 0x60)
  t.equal(ber.readInt(), 0x03)
  t.equal(ber.readString(), '')
  t.equal(ber.readSequence(), 0xa3)
  t.equal(ber.readString(), 'GSS-SPNEGO')
  t.equal(ber.readSequence(), 0x04)
  t.equal(ber.readSequence(), 0xa1) // sasl type3
  t.equal(ber.readSequence(), 0x30)
  t.equal(ber.readSequence(), 0xa2)
  t.equal(ber.readString(), token)
  t.end()
})

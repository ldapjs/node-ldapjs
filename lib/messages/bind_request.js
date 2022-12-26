// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')
const util = require('util')

const asn1 = require('asn1')

const LDAPMessage = require('./message')
const Protocol = require('../protocol')

/// --- Globals

const Ber = asn1.Ber
const LDAP_BIND_SIMPLE = 'simple'
const LDAP_BIND_SASL = 'sasl'
const SASL_SEQUENCE = 0xa3
const SASL_SEQUENCE_TYPE1 = 0x60
const SASL_SEQUENCE_TYPE3 = 0xa1
const SASL_TOKENLEN_TYPE1 = 40
const SASL_TOKENLEN_TYPE3 = 522

/// --- API

function BindRequest (options) {
  options = options || {}
  assert.object(options)

  options.protocolOp = Protocol.LDAP_REQ_BIND
  LDAPMessage.call(this, options)

  this.version = options.version || 0x03
  this.name = options.name || null
  this.authentication = options.authentication || LDAP_BIND_SIMPLE
  this.credentials = options.credentials || ''
}
util.inherits(BindRequest, LDAPMessage)
Object.defineProperties(BindRequest.prototype, {
  type: {
    get: function getType () { return 'BindRequest' },
    configurable: false
  },
  _dn: {
    get: function getDN () { return this.name },
    configurable: false
  }
})

BindRequest.prototype._parse = function (ber) {
  assert.ok(ber)

  this.version = ber.readInt()
  this.name = ber.readString()

  const t = ber.peek()

  if (t === SASL_SEQUENCE) {
    this.authentication = LDAP_BIND_SASL
    ber.readSequence(SASL_SEQUENCE)
    this.ldapMechanism = ber.readString(Ber.OctetString)
    ber.readSequence(0x04) // ldapCredentials

    const typeSequence = ber.readSequence() // GSSAPI
    if (typeSequence === SASL_SEQUENCE_TYPE1) {
      this.gssapiOID = ber.readOID(Ber.OID)
      ber.readSequence(0xa0) // SPNEGO
      ber.readSequence(0x30)
      ber.readSequence(0xa0)
      ber.readSequence(0x30)
      this.spnegoMechType = ber.readOID(Ber.OID)
      ber.readSequence(0xa2)
      this.credentials = ber.readString(Ber.OctetString, true)
    }
    else if (typeSequence === SASL_SEQUENCE_TYPE3) {
      ber.readSequence(0x30) // spnego.negTokenTarg
      ber.readSequence(0xa2)
      ber.readSequence(0x04)
      this.credentials = ber.buffer
      this.ntlmsspIdentifier = readByteString(ber, 8)
      this.ntlmsspMessageType = read32bitNumber(ber)
      this.ntlmsspLanManager = extractDataFromToken(this.credentials, ber)
      this.ntlmsspNtlm = extractDataFromToken(this.credentials, ber)
      this.ntlmsspDomain = extractDataFromToken(this.credentials, ber)
      this.ntlmsspUser = extractDataFromToken(this.credentials, ber)
      this.ntlmsspHost = extractDataFromToken(this.credentials, ber)
      this.ntlmsspAuthSessionKey = readByteString(ber, 8)
      const flag4 = ber.readByte()
      const flag3 = ber.readByte()
      const flag2 = ber.readByte()
      const flag1 = ber.readByte()
      this.ntlmsspNegotiateFlags = {
        Negotiate56:                     !!(flag1 & 128),
        NegotiateKeyExchange:            !!(flag1 & 64),
        Negotiate128:                    !!(flag1 & 32),
        Negotiate0x10000000:             !!(flag1 & 16),
        Negotiate0x08000000:             !!(flag1 & 8),
        Negotiate0x04000000:             !!(flag1 & 4),
        NegotiateVersion:                !!(flag1 & 2),
        Negotiate0x01000000:             !!(flag1 & 1),
        NegotiateTargetInfo:             !!(flag2 & 128),
        RequestNonNtSession:             !!(flag2 & 64),
        Negotiate0x00200000:             !!(flag2 & 32),
        NegotiateIdentify:               !!(flag2 & 16),
        NegotiateExtendesSecurity:       !!(flag2 & 8),
        TargetTypeShare:                 !!(flag2 & 4),
        TargetTypeServer:                !!(flag2 & 2),
        TargetTypeDomain:                !!(flag2 & 1),
        NegotiateAlwaysSign:             !!(flag3 & 128),
        Negotiate0x00004000:             !!(flag3 & 64),
        NegotiateOemWorkstationSupplied: !!(flag3 & 32),
        NegotiateOemDomainSupplied:      !!(flag3 & 16),
        NegotiateAnonymous:              !!(flag3 & 8),
        NegotiateNtOnly:                 !!(flag3 & 4),
        NegotiateNtlmKey:                !!(flag3 & 2),
        Negotiate0x00000100:             !!(flag3 & 1),
        NegotiateLanManagerKey:          !!(flag4 & 128),
        NegotiateDatagram:               !!(flag4 & 64),
        NegotiateSeal:                   !!(flag4 & 32),
        NegotiateSign:                   !!(flag4 & 16),
        Request0x00000008:               !!(flag4 & 8),
        RequestTarget:                   !!(flag4 & 4),
        TargetOem:                       !!(flag4 & 2),
        TargetUnicode:                   !!(flag4 & 1),
      }
      this.ntlmsspVersionMajor = ber.readByte()
      this.ntlmsspVersionMinor = ber.readByte()
      this.ntlmsspBuildNumber = read16bitNumber(ber)
      ber.readByte(); ber.readByte(); ber.readByte()
      this.ntlmsspNtlmCurrentRev = ber.readByte()
      this.messageIntegrityCode = readByteString(ber, 16)
    }
    else {
      console.error('SASL sequence %s found, expected %s (for type1) or %s (for type3) found',
        typeSequence.toString(16), SASL_SEQUENCE_TYPE1.toString(16), SASL_SEQUENCE_TYPE3.toString(16))
    }
  }
  else if (t === Ber.Context) {
    this.authentication = LDAP_BIND_SIMPLE
    this.credentials = ber.readString(Ber.Context)
  }
  else {
    throw new Error('authentication 0x' + t.toString(16) + ' not supported')
  }

  return true
}

function extractDataFromToken(buf, ber) {
  const length = read16bitNumber(ber)
  const maxlen = read16bitNumber(ber)
  const offset = read32bitNumber(ber)
  return buf.slice(offset, offset + length).toString('utf16le')
}
function read16bitNumber(ber) { return ber.readByte() + (ber.readByte() << 8) }
function read32bitNumber(ber) { return ber.readByte() + (ber.readByte() << 8) + (ber.readByte() << 16) + (ber.readByte() << 24) }
function readByteString(ber,len) { return String.fromCharCode(...range(0, len - 1).map(function () { return ber.readByte() })) }
function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => i)
}

BindRequest.prototype._toBer = function (ber) {
  assert.ok(ber)

  ber.writeInt(this.version)
  ber.writeString((this.name || '').toString())

  if (this.authentication === 'sasl') {
    ber.startSequence(SASL_SEQUENCE)
    ber.writeString('GSS-SPNEGO', Ber.OctetString)
    ber.startSequence(0x04)

    // Type1 token
    if (this.credentials.length === SASL_TOKENLEN_TYPE1) {
      ber.startSequence(SASL_SEQUENCE_TYPE1)
      ber.writeOID('1.3.6.1.5.5.2', Ber.OID) // gssapiOID
      ber.startSequence(0xa0) // SPNEGO
      ber.startSequence(0x30)
      ber.startSequence(0xa0)
      ber.startSequence(0x30)
      ber.writeOID('1.3.6.1.4.1.311.2.2.10', Ber.OID) // spnegoMechType
      ber.endSequence()
      ber.endSequence()
      ber.startSequence(0xa2)

      // spnegoMechToken
      if (Buffer.isBuffer(this.credentials)) {
        ber.writeBuffer(this.credentials, Ber.OctetString)
      }
      else {
        ber.writeString(this.credentials, Ber.OctetString)
      }

      ber.endSequence()
      ber.endSequence()
      ber.endSequence()
      ber.endSequence()
    }
    // Type 3 token
    else if (this.credentials.length === SASL_TOKENLEN_TYPE3) {
      ber.startSequence(SASL_SEQUENCE_TYPE3)
      ber.startSequence(0x30) // spnego.negTokenTarg
      ber.startSequence(0xa2)

      if (Buffer.isBuffer(this.credentials)) {
        ber.writeBuffer(this.credentials, Ber.OctetString)
      }
      else {
        ber.writeString(this.credentials, Ber.OctetString)
      }

      ber.endSequence()
      ber.endSequence()
      ber.endSequence()
    }
    else {
      console.error('SASL token neither %d (for type1) nor %d (for type3) bytes long, got: %d',
        SASL_TOKENLEN_TYPE1, SASL_TOKENLEN_TYPE3, this.credentials.length)
    }

    ber.endSequence()
    ber.endSequence()
  }
  // Simple authentication
  else {
    ber.writeString((this.credentials || ''), Ber.Context)
  }

  return ber
}

BindRequest.prototype._json = function (j) {
  assert.ok(j)

  j.version = this.version
  j.name = this.name
  j.authenticationType = this.authentication
  j.credentials = this.credentials

  return j
}

/// --- Exports

module.exports = BindRequest

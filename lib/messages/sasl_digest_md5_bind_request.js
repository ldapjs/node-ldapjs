// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var util = require('util');

var asn1 = require('asn1');

var LDAPMessage = require('./message');
var Protocol = require('../protocol');

///--- Globals

var Ber = asn1.Ber;

///--- API

function BindRequest(options) {
  options = options || {}
  assert.object(options)

  options.protocolOp = Protocol.LDAP_REQ_BIND
  LDAPMessage.call(this, options)

  this.version = 0x03
  this.name = options.name || ''
  this.challengeResponse = options.challengeResponse || ''
}

util.inherits(BindRequest, LDAPMessage)

Object.defineProperties(BindRequest.prototype, {
  type: {
    get: function getType() { return 'SaslDigestMd5BindRequest' },
    configurable: false,
  },
  _dn: {
    get: function getDN() { return this.name },
    configurable: false,
  },
})

BindRequest.prototype._parse = function(ber) {
  assert.ok(ber)

  this.version = ber.readInt()
  this.name = ber.readString()

  const t = ber.peek()
  // is this method used by server? - no idea what to do here

  if (t !== Ber.Context) {
    throw new Error('authentication 0x' + t.toString(16) + ' not supported')
  }

  return true
}

BindRequest.prototype._toBer = function(ber) {
  assert.ok(ber)

  ber.writeInt(this.version)
  ber.writeString((this.name || '').toString())
  ber.startSequence(0xa3)
  ber.writeString('DIGEST-MD5')
  if (this.challengeResponse) {
    ber.writeString(this.challengeResponse)
  }
  ber.endSequence()
  return ber
}

BindRequest.prototype._json = function(j) {
  assert.ok(j)

  j.version = this.version
  j.name = this.name
  j.challengeResponse = this.challengeResponse

  return j
}

// very basic example how to generate SASL DIGEST-MD5 challenge response
// you'll probably have to play with your particular LDAP server installation
// this example worked to MS LDAP server (or AD)
// example SASL challenge from this server:
//    qop="auth,auth-int,auth-conf",cipher="3des,rc4",algorithm=md5-sess,nonce="SOMENONCE",charset=utf-8,realm="REALM"
// cipher is ingored
BindRequest.prototype.generate_response = function generate_response(input) {
  // enforce  qop=auth
  const qop = 'auth'
  // any random string
  const cnonce = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 10)

  // host - address of your LDAP server (not sure if it works with plain IP addresses)
  // nonce - SASL nonce from step1
  // realm - you can hardcode it of parse from step1
  const { host, nonce, realm, username, password } = input
  const uri = `ldap/${host}`
  const secret = crypto.createHash('md5').update(username + ':' + realm + ':' + password).digest()
  const ha1 = crypto.createHash('md5').update(secret).update(':' + nonce + ':' + cnonce).digest('hex')
  const ha2 = crypto.createHash('md5').update('AUTHENTICATE:' + uri).digest('hex')
  const nc = '00000001'
  const digest = crypto.createHash('md5').update(ha1 + ':' + nonce + ':' + nc + ':' + cnonce + ':' + qop + ':' + ha2).digest('hex')
  const res = `username="${username}",realm="${realm}",nonce="${nonce}",cnonce="${cnonce}",nc=${nc},qop=${qop},digest-uri="${uri}",response=${digest},charset=utf-8`
  return res
}



///--- Exports

module.exports = BindRequest;

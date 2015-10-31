// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var util = require('util');

var asn1 = require('asn1');

var dtrace = require('../dtrace');
var LDAPMessage = require('./message');
var Protocol = require('../protocol');


///--- Globals

var Ber = asn1.Ber;
var BerWriter = asn1.BerWriter;


///--- API

function LDAPResult(options) {
  options = options || {};
  assert.object(options);
  assert.optionalNumber(options.status);
  assert.optionalString(options.matchedDN);
  assert.optionalString(options.errorMessage);
  assert.optionalArrayOfString(options.referrals);

  LDAPMessage.call(this, options);

  this.status = options.status || 0; // LDAP SUCCESS
  this.matchedDN = options.matchedDN || '';
  this.errorMessage = options.errorMessage || '';
  this.referrals = options.referrals || [];

  this.connection = options.connection || null;
}
util.inherits(LDAPResult, LDAPMessage);
Object.defineProperties(LDAPResult.prototype, {
  type: {
    get: function getType() { return 'LDAPResult'; },
    configurable: false
  }
});

LDAPResult.prototype.end = function (status) {
  assert.ok(this.connection);

  if (typeof (status) === 'number')
    this.status = status;

  var ber = this.toBer();
  if (this.log.debug())
    this.log.debug('%s: sending:  %j', this.connection.ldap.id, this.json);

  try {
    var self = this;
    this.connection.write(ber);

    if (self._dtraceOp && self._dtraceId) {
      dtrace.fire('server-' + self._dtraceOp + '-done', function () {
        var c = self.connection || {ldap: {}};
        return [
          self._dtraceId || 0,
          (c.remoteAddress || ''),
          c.ldap.bindDN ? c.ldap.bindDN.toString() : '',
          (self.requestDN ? self.requestDN.toString() : ''),
          status || self.status,
          self.errorMessage
        ];
      });
    }

  } catch (e) {
    this.log.warn(e, '%s failure to write message %j',
                  this.connection.ldap.id, this.json);
  }

};

LDAPResult.prototype._parse = function (ber) {
  assert.ok(ber);

  this.status = ber.readEnumeration();
  this.matchedDN = ber.readString();
  this.errorMessage = ber.readString();

  var t = ber.peek();

  if (t === Protocol.LDAP_REP_REFERRAL) {
    var end = ber.offset + ber.length;
    while (ber.offset < end)
      this.referrals.push(ber.readString());
  }

  return true;
};

LDAPResult.prototype._toBer = function (ber) {
  assert.ok(ber);

  ber.writeEnumeration(this.status);
  ber.writeString(this.matchedDN || '');
  ber.writeString(this.errorMessage || '');

  if (this.referrals.length) {
    ber.startSequence(Protocol.LDAP_REP_REFERRAL);
    ber.writeStringArray(this.referrals);
    ber.endSequence();
  }

  return ber;
};

LDAPResult.prototype._json = function (j) {
  assert.ok(j);

  j.status = this.status;
  j.matchedDN = this.matchedDN;
  j.errorMessage = this.errorMessage;
  j.referrals = this.referrals;

  return j;
};


///--- Exports

module.exports = LDAPResult;

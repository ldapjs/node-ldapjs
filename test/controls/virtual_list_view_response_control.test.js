var test = require('tape').test;

var asn1 = require('asn1');

var BerReader = asn1.BerReader;
var BerWriter = asn1.BerWriter;
var ldap;
var getControl;
var VLVResponseControl;
var OID = '2.16.840.1.113730.3.4.10';

///--- Tests


test('VLV response - load library', function (t) {
  ldap = require('../../lib');
  VLVResponseControl = ldap.VirtualListViewResponseControl;
  t.ok(VLVResponseControl);
  getControl = ldap.getControl;
  t.ok(getControl);
  t.end();
});

test('VLV response - new no args', function (t) {
  var c = new VLVResponseControl();
  t.ok(c);
  t.equal(c.type, OID);
  t.equal(c.criticality, false);
  t.end();
});

test('VLV response - new with args', function (t) {
  var c = new VLVResponseControl({
    criticality: true,
    value: {
      result: ldap.LDAP_SUCCESS,
      targetPosition: 0,
      contentCount: 10
    }
  });
  t.ok(c);
  t.equal(c.type, OID);
  t.equal(c.criticality, false);
  t.equal(c.value.result, ldap.LDAP_SUCCESS);
  t.equal(c.value.targetPosition, 0);
  t.equal(c.value.contentCount, 10);
  t.end();
});

test('VLV response - toBer', function (t) {
  var vlpc = new VLVResponseControl({
    value: {
	  targetPosition: 0,
      contentCount: 10,
      result: ldap.LDAP_SUCCESS,
  }});

  var ber = new BerWriter();
  vlpc.toBer(ber);

  var c = getControl(new BerReader(ber.buffer));
  t.ok(c);
  t.equal(c.type, OID);
  t.equal(c.criticality, false);
  t.equal(c.value.result, ldap.LDAP_SUCCESS);
  t.equal(c.value.targetPosition, 0);
  t.equal(c.value.contentCount, 10);
  t.end();
});

test('VLV response - toBer - empty', function (t) {
  var vlpc = new VLVResponseControl();
  var ber = new BerWriter();
  vlpc.toBer(ber);

  var c = getControl(new BerReader(ber.buffer));
  t.ok(c);
  t.equal(c.type, OID);
  t.equal(c.criticality, false);
  t.notOk(c.value.result);
  t.end();
});


var test = require('tape').test;

var asn1 = require('asn1');

var BerReader = asn1.BerReader;
var BerWriter = asn1.BerWriter;
var getControl;
var SSSRControl;

///--- Tests


test('VLV request - load library', function (t) {
  VLVRControl = require('../../lib').VirtualListViewRequestControl;
  t.ok(VLVRControl);
  getControl = require('../../lib').getControl;
  t.ok(getControl);
  t.end();
});

test('VLV request - new no args', function (t) {
  t.ok(new VLVRControl());
  t.end();
});

test('VLV request - new with args', function (t) {
  var c = new VLVRControl({
    criticality: true,
    value: {
      beforeCount:0,
      afterCount:3,
	  targetOffset:1,
      contentCount:0
    }
  });
  t.ok(c);
  t.equal(c.type, '2.16.840.1.113730.3.4.9');
  t.ok(c.criticality);
  t.equal(c.value.beforeCount, 0);
  t.equal(c.value.afterCount, 3);
  t.equal(c.value.targetOffset, 1);
  t.equal(c.value.contentCount, 0);

  t.end();
});

test('VLV request - toBer - with offset', function (t) {
  var vlvc = new VLVRControl({
    criticality: true,
    value: {
      beforeCount:0,
      afterCount:3,
      targetOffset:1,
      contentCount:0
    }});

  var ber = new BerWriter();
  vlvc.toBer(ber);

  var c = getControl(new BerReader(ber.buffer));
  t.ok(c);
  t.equal(c.type, '2.16.840.1.113730.3.4.9');
  t.ok(c.criticality);
  t.equal(c.value.beforeCount, 0);
  t.equal(c.value.afterCount, 3);
  t.equal(c.value.targetOffset, 1);
  t.equal(c.value.contentCount, 0);

  t.end();
});

test('VLV request - toBer - with assertion', function (t) {
  var vlvc = new VLVRControl({
    criticality: true,
    value: {
      beforeCount:0,
      afterCount:3,
      greaterThanOrEqual:"*foo*"
    }});

  var ber = new BerWriter();
  vlvc.toBer(ber);

  var c = getControl(new BerReader(ber.buffer));
  t.ok(c);
  t.equal(c.type, '2.16.840.1.113730.3.4.9');
  t.ok(c.criticality);
  t.equal(c.value.beforeCount, 0);
  t.equal(c.value.afterCount, 3);
  t.equal(c.value.greaterThanOrEqual, '*foo*');

  t.end();
});

test('VLV request - toBer - empty', function (t) {
  var vlvc = new VLVRControl();
  var ber = new BerWriter();
  vlvc.toBer(ber);

  var c = getControl(new BerReader(ber.buffer));
  t.ok(c);
  t.equal(c.type, '2.16.840.1.113730.3.4.9');
  t.equal(c.criticality, false);
  t.notOk(c.value.result);
  t.end();
});

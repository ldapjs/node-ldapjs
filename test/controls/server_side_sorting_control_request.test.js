
var test = require('tape').test;

var asn1 = require('asn1');

var BerReader = asn1.BerReader;
var BerWriter = asn1.BerWriter;
var getControl;
var SSSRControl;

///--- Tests


test('load library', function (t) {
  SSSRControl = require('../../lib').ServerSideSortingRequestControl;
  t.ok(SSSRControl);
  getControl = require('../../lib').getControl;
  t.ok(getControl);
  t.end();
});

test('new no args', function (t) {
  t.ok(new SSSRControl());
  t.end();
});

test('new with args', function (t) {
  var c = new SSSRControl({
    criticality: true,
    value: {
      attributeType: 'sn'
    }
  });
  t.ok(c);
  t.equal(c.type, '1.2.840.113556.1.4.473');
  t.ok(c.criticality);
  t.equal(c.value.length, 1);
  t.equal(c.value[0].attributeType, 'sn');

  t.end();
});

test('toBer - object', function (t) {
  var sssc = new SSSRControl({
    criticality: true,
    value: {
      attributeType: 'sn',
      orderingRule: 'caseIgnoreOrderingMatch',
      reverseOrder: true
    }});

  var ber = new BerWriter();
  sssc.toBer(ber);

  var c = getControl(new BerReader(ber.buffer));
  t.ok(c);
  t.equal(c.type, '1.2.840.113556.1.4.473');
  t.ok(c.criticality);
  t.equal(c.value[0].attributeType, 'sn');
  t.equal(c.value[0].orderingRule, 'caseIgnoreOrderingMatch');
  t.equal(c.value[0].reverseOrder, true);

  t.end();
});

test('toBer - array', function (t) {
  var sssc = new SSSRControl({
    criticality: true,
    value: [
      {
        attributeType: 'sn',
        orderingRule: 'caseIgnoreOrderingMatch',
        reverseOrder: true
      },
      {
        attributeType: 'givenName',
        orderingRule: 'caseIgnoreOrderingMatch'
      }
    ]
  });

  var ber = new BerWriter();
  sssc.toBer(ber);

  var c = getControl(new BerReader(ber.buffer));
  t.ok(c);
  t.equal(c.type, '1.2.840.113556.1.4.473');
  t.ok(c.criticality);
  t.equal(c.value.length, 2);
  t.equal(c.value[0].attributeType, 'sn');
  t.equal(c.value[0].orderingRule, 'caseIgnoreOrderingMatch');
  t.equal(c.value[0].reverseOrder, true);
  t.equal(c.value[1].attributeType, 'givenName');
  t.equal(c.value[1].orderingRule, 'caseIgnoreOrderingMatch');

  t.end();
});

test('toBer - empty', function (t) {
  var sssc = new SSSRControl();
  var ber = new BerWriter();
  sssc.toBer(ber);

  var c = getControl(new BerReader(ber.buffer));
  t.ok(c);
  t.equal(c.type, '1.2.840.113556.1.4.473');
  t.equal(c.value.length, 0);
  t.end();
});

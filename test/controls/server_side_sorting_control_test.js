
var test = require('tap').test;

var asn1 = require('asn1');

var BerReader = asn1.BerReader;
var BerWriter = asn1.BerWriter;
var getControl;
var ServerSideSortingControl;

///--- Tests


test('load library', function (t) {
  ServerSideSortingControl =
    require('../../lib').ServerSideSortingControl;
  t.ok(ServerSideSortingControl);
  getControl = require('../../lib').getControl;
  t.ok(getControl);
  t.end();
});


test('new no args', function (t) {
  t.ok(new ServerSideSortingControl());
  t.end();
});


test('new with args', function (t) {
  var c = new ServerSideSortingControl({
    type: '1.2.840.113556.1.4.473',
    criticality: true,
    value: {
      attributeType: 'sn'
    }
  });
  t.ok(c);
  t.equal(c.type, '1.2.840.113556.1.4.473');
  t.ok(c.criticality);
  t.equal(c.value.attributeType, 'sn');

  t.end();
});

test('tober - object', function (t) {
  var sssc = new ServerSideSortingControl({
    type: '1.2.840.113556.1.4.473',
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
  t.equal(c.value.attributeType, 'sn');
  t.equal(c.value.orderingRule, 'caseIgnoreOrderingMatch');
  t.equal(c.value.reverseOrder, true);

  t.end();
});

test('tober - array', function (t) {
  var sssc = new ServerSideSortingControl({
    type: '1.2.840.113556.1.4.473',
    criticality: true,
    value: [{
      attributeType: 'sn',
      orderingRule: 'caseIgnoreOrderingMatch',
      reverseOrder: true
    },
    {
      attributeType: 'givenName',
      orderingRule: 'caseIgnoreOrderingMatch'
      }]
  });

  var ber = new BerWriter();
  sssc.toBer(ber);

  var c = getControl(new BerReader(ber.buffer));
  t.ok(c);
  t.equal(c.type, '1.2.840.113556.1.4.473');
  t.ok(c.criticality);
  t.equal(c.value[0].attributeType, 'sn');
  t.equal(c.value[0].orderingRule, 'caseIgnoreOrderingMatch');
  t.equal(c.value[0].reverseOrder, true);
  t.equal(c.value[1].attributeType, 'givenName');
  t.equal(c.value[1].orderingRule, 'caseIgnoreOrderingMatch');

  t.end();
});

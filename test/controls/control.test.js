'use strict'

const { test } = require('tap')
const { BerReader, BerWriter } = require('asn1')
const { Control, getControl } = require('../../lib')

test('new no args', function (t) {
  t.ok(new Control())
  t.end()
})

test('new with args', function (t) {
  const c = new Control({
    type: '2.16.840.1.113730.3.4.2',
    criticality: true
  })
  t.ok(c)
  t.equal(c.type, '2.16.840.1.113730.3.4.2')
  t.ok(c.criticality)
  t.end()
})

test('parse', function (t) {
  const ber = new BerWriter()
  ber.startSequence()
  ber.writeString('2.16.840.1.113730.3.4.2')
  ber.writeBoolean(true)
  ber.writeString('foo')
  ber.endSequence()

  const c = getControl(new BerReader(ber.buffer))

  t.ok(c)
  t.equal(c.type, '2.16.840.1.113730.3.4.2')
  t.ok(c.criticality)
  t.equal(c.value.toString('utf8'), 'foo')
  t.end()
})

test('parse no value', function (t) {
  const ber = new BerWriter()
  ber.startSequence()
  ber.writeString('2.16.840.1.113730.3.4.2')
  ber.endSequence()

  const c = getControl(new BerReader(ber.buffer))

  t.ok(c)
  t.equal(c.type, '2.16.840.1.113730.3.4.2')
  t.equal(c.criticality, false)
  t.notOk(c.value, null)
  t.end()
})

test('only value getter in sub-class with strict mode', function (t) {
  "use strict"

  function SubControl (options) {
    assert.optionalObject(options)
    options = options || {}
    options.type = SubControl.OID
    if (options.value) {
      this._value = options.value
      options.value = null
    }
    Control.call(this, options)
  }
  util.inherits(SubControl, Control)
  Object.defineProperties(SubControl.prototype, {
    value: {
      get: function () { return this._value || {} },
      configurable: false
    }
  })

  SubControl.OID = '2.16.840.1.113730.3.4.2'
  
  const c = new SubControl({
    value: { size: 3 },
    criticality: true
  })
  t.ok(c)
  t.equal(c.type, '2.16.840.1.113730.3.4.2')
  t.ok(c.criticality)
  t.equal(c.value.size, 3)
  t.end()
})

'use strict'

const { test } = require('tap')
const { BerReader, BerWriter } = require('asn1')
const { ExtendedRequest } = require('../../lib')

test('new no args', function (t) {
  t.ok(new ExtendedRequest())
  t.end()
})

test('new with args', function (t) {
  const req = new ExtendedRequest({
    requestName: '1.2.3.4',
    requestValue: 'test'
  })
  t.ok(req)
  t.equal(req.requestName, '1.2.3.4')
  t.equal(req.requestValue, 'test')
  t.equal(Buffer.compare(req.requestValueBuffer, Buffer.from('test', 'utf8')), 0)
  t.equal(req.value, 'test')
  t.equal(Buffer.compare(req.valueBuffer, Buffer.from('test', 'utf8')), 0)
  t.end()
})

test('new with buffer args', function (t) {
  const req = new ExtendedRequest({
    requestName: '1.2.3.4',
    requestValue: Buffer.from('test', 'utf8')
  })
  t.ok(req)
  t.equal(req.requestName, '1.2.3.4')
  t.equal(req.requestValue, req.requestValueBuffer)
  t.equal(Buffer.compare(req.requestValueBuffer, Buffer.from('test', 'utf8')), 0)
  t.equal(req.value, req.valueBuffer)
  t.equal(Buffer.compare(req.valueBuffer, Buffer.from('test', 'utf8')), 0)
  t.end()
})

test('new no args set args', function (t) {
  const req = new ExtendedRequest()
  t.ok(req)

  req.name = '1.2.3.4'
  t.equal(req.requestName, '1.2.3.4')

  req.value = 'test'
  t.equal(req.requestValue, 'test')
  t.equal(Buffer.compare(req.requestValueBuffer, Buffer.from('test', 'utf8')), 0)
  t.equal(req.value, 'test')
  t.equal(Buffer.compare(req.valueBuffer, Buffer.from('test', 'utf8')), 0)

  t.end()
})

test('new no args set args buffer', function (t) {
  const req = new ExtendedRequest()
  t.ok(req)

  req.name = '1.2.3.4'
  t.equal(req.requestName, '1.2.3.4')

  req.value = Buffer.from('test', 'utf8')
  t.equal(req.requestValue, req.requestValueBuffer)
  t.equal(Buffer.compare(req.requestValueBuffer, Buffer.from('test', 'utf8')), 0)
  t.equal(req.value, req.valueBuffer)
  t.equal(Buffer.compare(req.valueBuffer, Buffer.from('test', 'utf8')), 0)

  t.end()
})

test('parse', function (t) {
  const ber = new BerWriter()
  ber.writeString('1.2.3.4', 0x80)
  ber.writeString('test', 0x81)

  const req = new ExtendedRequest()
  t.ok(req._parse(new BerReader(ber.buffer)))
  t.equal(req.requestName, '1.2.3.4')
  t.equal(req.requestValue, 'test')
  t.equal(Buffer.compare(req.requestValueBuffer, Buffer.from('test', 'utf8')), 0)
  t.equal(req.value, 'test')
  t.equal(Buffer.compare(req.valueBuffer, Buffer.from('test', 'utf8')), 0)
  t.end()
})

test('toBer', function (t) {
  const req = new ExtendedRequest({
    messageID: 123,
    requestName: '1.2.3.4',
    requestValue: 'test'
  })

  t.ok(req)

  const ber = new BerReader(req.toBer())
  t.ok(ber)
  t.equal(ber.readSequence(), 0x30)
  t.equal(ber.readInt(), 123)
  t.equal(ber.readSequence(), 0x77)
  t.equal(ber.readString(0x80), '1.2.3.4')
  t.equal(ber.readString(0x81), 'test')

  t.end()
})

test('toBer from buffer', function (t) {
  const req = new ExtendedRequest({
    messageID: 123,
    requestName: '1.2.3.4',
    requestValue: Buffer.from('test', 'utf8')
  })

  t.ok(req)

  const ber = new BerReader(req.toBer())
  t.ok(ber)
  t.equal(ber.readSequence(), 0x30)
  t.equal(ber.readInt(), 123)
  t.equal(ber.readSequence(), 0x77)
  t.equal(ber.readString(0x80), '1.2.3.4')
  t.equal(ber.readString(0x81), 'test')

  t.end()
})

'use strict'

const tap = require('tap')
const { BerReader } = require('@ldapjs/asn1')
const { EqualityFilter } = require('@ldapjs/filter')
const OrFilter = require('@ldapjs/filter/lib/filters/or')

tap.test('parseSet reads OR filter from BER', async t => {
  const { parse } = require('../../lib/filters/index')
  const expected = Buffer.from([
    0xa1, 0x1b,
    0xa3, 0x07, // eq filter
    0x04, 0x02, 0x63, 0x6e, 0x04, 0x01, 0x31, // string, 2 chars (cn), string 1 char (1)
    0xa3, 0x07, // eq filter
    0x04, 0x02, 0x63, 0x6e, 0x04, 0x01, 0x32, // string, 2 chars (cn), string 1 char (2)
    0xa3, 0x07, // eq filter
    0x04, 0x02, 0x63, 0x6e, 0x04, 0x01, 0x33 // string, 2 chars (cn), string 1 char (3)
  ])

  let f = new OrFilter()
  f.addFilter(new EqualityFilter({ attribute: 'cn', value: '1' }))
  f.addFilter(new EqualityFilter({ attribute: 'cn', value: '2' }))
  f.addFilter(new EqualityFilter({ attribute: 'cn', value: '3' }))

  const filterBuffer = f.toBer().buffer
  t.equal(expected.compare(filterBuffer), 0)

  const reader = new BerReader(filterBuffer)
  f = parse(reader)
  t.ok(f)
  t.equal(f.type, 'OrFilter')
  t.equal(f.filters.length, 3)
  for (let i = 1; i <= 3; i += 1) {
    const filter = f.filters[i - 1]
    t.equal(filter.attribute, 'cn')
    t.equal(filter.value, `${i}`)
  }
})

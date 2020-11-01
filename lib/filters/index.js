// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert')

const asn1 = require('asn1')

const parents = require('ldap-filter')

const Protocol = require('../protocol')

const Filter = require('./filter')
const AndFilter = require('./and_filter')
const ApproximateFilter = require('./approx_filter')
const EqualityFilter = require('./equality_filter')
const ExtensibleFilter = require('./ext_filter')
const GreaterThanEqualsFilter = require('./ge_filter')
const LessThanEqualsFilter = require('./le_filter')
const NotFilter = require('./not_filter')
const OrFilter = require('./or_filter')
const PresenceFilter = require('./presence_filter')
const SubstringFilter = require('./substr_filter')

/// --- Globals

const BerReader = asn1.BerReader

/// --- Internal Parsers

/*
 * A filter looks like this coming in:
 *      Filter ::= CHOICE {
 *              and             [0]     SET OF Filter,
 *              or              [1]     SET OF Filter,
 *              not             [2]     Filter,
 *              equalityMatch   [3]     AttributeValueAssertion,
 *              substrings      [4]     SubstringFilter,
 *              greaterOrEqual  [5]     AttributeValueAssertion,
 *              lessOrEqual     [6]     AttributeValueAssertion,
 *              present         [7]     AttributeType,
 *              approxMatch     [8]     AttributeValueAssertion,
 *              extensibleMatch [9]     MatchingRuleAssertion --v3 only
 *      }
 *
 *      SubstringFilter ::= SEQUENCE {
 *              type               AttributeType,
 *              SEQUENCE OF CHOICE {
 *                      initial          [0] IA5String,
 *                      any              [1] IA5String,
 *                      final            [2] IA5String
 *              }
 *      }
 *
 * The extensibleMatch was added in LDAPv3:
 *
 *      MatchingRuleAssertion ::= SEQUENCE {
 *              matchingRule    [1] MatchingRuleID OPTIONAL,
 *              type            [2] AttributeDescription OPTIONAL,
 *              matchValue      [3] AssertionValue,
 *              dnAttributes    [4] BOOLEAN DEFAULT FALSE
 *      }
 */
function _parse (ber) {
  assert.ok(ber)

  function parseSet (f) {
    const end = ber.offset + ber.length
    while (ber.offset < end) { f.addFilter(_parse(ber)) }
  }

  let f

  const type = ber.readSequence()
  switch (type) {
    case Protocol.FILTER_AND:
      f = new AndFilter()
      parseSet(f)
      break

    case Protocol.FILTER_APPROX:
      f = new ApproximateFilter()
      f.parse(ber)
      break

    case Protocol.FILTER_EQUALITY:
      f = new EqualityFilter()
      f.parse(ber)
      return f

    case Protocol.FILTER_EXT:
      f = new ExtensibleFilter()
      f.parse(ber)
      return f

    case Protocol.FILTER_GE:
      f = new GreaterThanEqualsFilter()
      f.parse(ber)
      return f

    case Protocol.FILTER_LE:
      f = new LessThanEqualsFilter()
      f.parse(ber)
      return f

    case Protocol.FILTER_NOT:
      f = new NotFilter({
        filter: _parse(ber)
      })
      break

    case Protocol.FILTER_OR:
      f = new OrFilter()
      parseSet(f)
      break

    case Protocol.FILTER_PRESENT:
      f = new PresenceFilter()
      f.parse(ber)
      break

    case Protocol.FILTER_SUBSTRINGS:
      f = new SubstringFilter()
      f.parse(ber)
      break

    default:
      throw new Error('Invalid search filter type: 0x' + type.toString(16))
  }

  assert.ok(f)
  return f
}

function cloneFilter (input) {
  let child
  if (input.type === 'and' || input.type === 'or') {
    child = input.filters.map(cloneFilter)
  } else if (input.type === 'not') {
    child = cloneFilter(input.filter)
  }
  switch (input.type) {
    case 'and':
      return new AndFilter({ filters: child })
    case 'or':
      return new OrFilter({ filters: child })
    case 'not':
      return new NotFilter({ filter: child })
    case 'equal':
      return new EqualityFilter(input)
    case 'substring':
      return new SubstringFilter(input)
    case 'ge':
      return new GreaterThanEqualsFilter(input)
    case 'le':
      return new LessThanEqualsFilter(input)
    case 'present':
      return new PresenceFilter(input)
    case 'approx':
      return new ApproximateFilter(input)
    case 'ext':
      return new ExtensibleFilter(input)
    default:
      throw new Error('invalid filter type:' + input.type)
  }
}

function escapedToHex (str) {
  return str.replace(/\\([0-9a-f](?![0-9a-f])|[^0-9a-f]|$)/gi, function (match, p1) {
    if (!p1) {
      return '\\5c'
    }

    const hexCode = p1.charCodeAt(0).toString(16)
    return '\\' + hexCode
  })
}

function parseString (str) {
  const hexStr = escapedToHex(str)
  const generic = parents.parse(hexStr)
  // The filter object(s) return from ldap-filter.parse lack the toBer/parse
  // decoration that native ldapjs filter possess.  cloneFilter adds that back.
  return cloneFilter(generic)
}

/// --- API

module.exports = {
  parse: function (ber) {
    if (!ber || !(ber instanceof BerReader)) { throw new TypeError('ber (BerReader) required') }

    return _parse(ber)
  },

  parseString: parseString,

  isFilter: Filter.isFilter,

  AndFilter: AndFilter,
  ApproximateFilter: ApproximateFilter,
  EqualityFilter: EqualityFilter,
  ExtensibleFilter: ExtensibleFilter,
  GreaterThanEqualsFilter: GreaterThanEqualsFilter,
  LessThanEqualsFilter: LessThanEqualsFilter,
  NotFilter: NotFilter,
  OrFilter: OrFilter,
  PresenceFilter: PresenceFilter,
  SubstringFilter: SubstringFilter
}

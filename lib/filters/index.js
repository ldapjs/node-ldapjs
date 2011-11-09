// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');

var asn1 = require('asn1');

var Protocol = require('../protocol');

var Filter = require('./filter');
var AndFilter = require('./and_filter');
var ApproximateFilter = require('./approx_filter');
var EqualityFilter = require('./equality_filter');
var ExtensibleFilter = require('./ext_filter');
var GreaterThanEqualsFilter = require('./ge_filter');
var LessThanEqualsFilter = require('./le_filter');
var NotFilter = require('./not_filter');
var OrFilter = require('./or_filter');
var PresenceFilter = require('./presence_filter');
var SubstringFilter = require('./substr_filter');



///--- Globals

var BerReader = asn1.BerReader;



///--- Internal Parsers


/*
 * This is a pretty naive approach to parsing, but it's relatively short amount
 * of code. Basically, we just build a stack as we go.
 */
function _filterStringToStack(str) {
  assert.ok(str);

  var tmp = '';
  var esc = false;
  var stack = [];
  var depth = -1;
  var open = false;
  for (var i = 0; i < str.length; i++) {
    var c = str[i];

    if (esc) {
      esc = false;
      tmp += c;
      continue;
    }

    switch (c) {
    case '(':
      open = true;
      tmp = '';
      stack[++depth] = '';
      break;
    case ')':
      if (open) {
        stack[depth].value = tmp;
        tmp = '';
      }
      open = false;
      break;
    case '&':
    case '|':
    case '!':
      stack[depth] = c;
      break;
    case '=':
      stack[depth] = { attribute: tmp, op: c };
      tmp = '';
      break;
    case '>':
    case '<':
    case '~':
      if (!(str[++i] === '='))
        throw new Error('Invalid filter: ' + tmp + c + str[i]);

      stack[depth] = {attribute: tmp, op: c};
      tmp = '';
      break;
    case '\\':
      esc = true;
    default:
      tmp += c;
      break;
    }
  }

  if (open)
    throw new Error('Invalid filter: ' + str);

  return stack;
}


function _parseString(str) {
  assert.ok(str);

  var stack = _filterStringToStack(str);

  if (!stack || !stack.length)
    throw new Error('Invalid filter: ' + str);

  debugger;
  var f;
  var filters = [];
  for (var i = stack.length - 1; i >= 0; i--) {
    if (stack[i] === '&') {
      filters.unshift(new AndFilter({
        filters: filters
      }));
      filters.length = 1;
    } else if (stack[i] === '|') {
      filters.unshift(new OrFilter({
        filters: filters
      }));
      filters.length = 1;
    } else if (stack[i] === '!') {
      filters.push(new NotFilter({
        filter: filters.pop()
      }));
    } else {
      switch (stack[i].op) {
      case '=': // could be presence, equality, substr or ext
        if (stack[i].value === '*') {
          filters.push(new PresenceFilter(stack[i]));
        } else {
          var vals = [''];
          var ndx = 0;
          var esc = false;
          for (var j = 0; j < stack[i].value.length; j++) {
            var c = stack[i].value[j];
            if (c === '\\') {
              if (esc) {
                esc = true;
              } else {
                vals[ndx] += c;
                esc = false;
              }
            } else if (c === '*') {
              if (esc) {
                vals[ndx] = c;
              } else {
                vals[++ndx] = '';
              }
            } else {
              vals[ndx] += c;
            }
          }
          if (vals.length === 1) {
            if (stack[i].attribute.indexOf(':') !== -1) {
              var extTmp = stack[i].attribute.split(':');
              var extOpts = {};
              extOpts.matchType = extTmp[0];
              switch (extTmp.length) {
              case 2:
                break;
              case 3:
                if (extTmp[1].toLowerCase() === 'dn') {
                  extOpts.dnAttributes = true;
                } else {
                  extOpts.rule = extTmp[1];
                }
                break;
              case 4:
                extOpts.dnAttributes = true;
                extOpts.rule = extTmp[2];
                break;
              default:
                throw new Error('Invalid extensible filter');
              }
              extOpts.value = vals[0];
              filters.push(new ExtensibleFilter(extOpts));
            } else {
              filters.push(new EqualityFilter(stack[i]));
            }
          } else {
            filters.push(new SubstringFilter({
              attribute: stack[i].attribute,
              initial: vals.shift() || null,
              'final': vals.pop() || null,
              any: vals || null
            }));
          }
        }
        break;
      case '~':
        filters.push(new ApproximateFilter(stack[i]));
        break;
      case '>':
        filters.push(new GreaterThanEqualsFilter(stack[i]));
        break;
      case '<':
        filters.push(new LessThanEqualsFilter(stack[i]));
        break;
      default:
        throw new Error('Invalid filter (op=' + stack[i].op + '): ' + str);
        }
    }
  }

  if (filters.length !== 1)
    throw new Error('Invalid filter: ' + str);

  return filters.pop();
}


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
function _parse(ber) {
  assert.ok(ber);

  function parseSet(f) {
    var end = ber.offset + ber.length;
    while (ber.offset < end)
      f.addFilter(_parse(ber));
  }

  var f;

  var type = ber.readSequence();
  switch (type) {

  case Protocol.FILTER_AND:
    f = new AndFilter();
    parseSet(f);
    break;

  case Protocol.FILTER_APPROX:
    f = new ApproximateFilter();
    f.parse(ber);
    break;

  case Protocol.FILTER_EQUALITY:
    f = new EqualityFilter();
    f.parse(ber);
    return f;

  case Protocol.FILTER_EXT:
    f = new ExtensibleFilter();
    f.parse(ber);
    return f;

  case Protocol.FILTER_GE:
    f = new GreaterThanEqualsFilter();
    f.parse(ber);
    return f;

  case Protocol.FILTER_LE:
    f = new LessThanEqualsFilter();
    f.parse(ber);
    return f;

  case Protocol.FILTER_NOT:
    var _f = _parse(ber);
    f = new NotFilter({
      filter: _f
    });
    break;

  case Protocol.FILTER_OR:
    f = new OrFilter();
    parseSet(f);
    break;

  case Protocol.FILTER_PRESENT:
    f = new PresenceFilter();
    f.parse(ber);
    break;

  case Protocol.FILTER_SUBSTRINGS:
    f = new SubstringFilter();
    f.parse(ber);
    break;

  default:
    throw new Error('Invalid search filter type: 0x' + type.toString(16));
  }


  assert.ok(f);
  return f;
}



///--- API

module.exports = {

  parse: function(ber) {
    if (!ber || !(ber instanceof BerReader))
      throw new TypeError('ber (BerReader) required');

    return _parse(ber);
  },

  parseString: function(filter) {
    if (!filter || typeof(filter) !== 'string')
      throw new TypeError('filter (string) required');

    return _parseString(filter);
  },

  AndFilter: AndFilter,
  ApproximateFilter: ApproximateFilter,
  EqualityFilter: EqualityFilter,
  ExtensibleFilter: ExtensibleFilter,
  GreaterThanEqualsFilter: GreaterThanEqualsFilter,
  LessThanEqualsFilter: LessThanEqualsFilter,
  NotFilter: NotFilter,
  OrFilter: OrFilter,
  PresenceFilter: PresenceFilter,
  SubstringFilter: SubstringFilter,
  Filter: Filter
};


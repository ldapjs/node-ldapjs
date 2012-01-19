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


//expression parsing
//returns the index of the closing parenthesis matching the open paren specified by openParenIndex
function matchParens(str, openParenIndex){
	var stack = [];
	
	for(var i=openParenIndex || 0;i<str.length;i++){
		if(str.charAt(i)=='('){
			stack.push(1);
		}else if(str.charAt(i) == ')'){
			stack.pop();
			if(stack.length === 0){
				//console.log('[_findMatchingParenthesis]: returning ', i);
				return i;
			}
		}
	}
	//console.log('[_findMatchingParenthesis]: returning ', str.length-1);
	return str.length-1;
};
//recursive function that builds a filter tree from a string expression
//the filter tree is an intermediary step between the incoming expression and the outgoing Dsml.
//see the comments of store.fetch concerning the filter argument for more info
function _buildFilterTree(expr){
	console.log('[buildFilterTree]: expression: ',expr);
	var tree = {};
	if(expr.length === 0){
		return tree;
	}
	console.log(expr);
	
	//remove leading and trailing parenthesis if they are there
	if (expr.charAt(0) == '('){
		expr = expr.substring(1,expr.length-1);
		console.log('substring: '+expr);
	}
	
	//store prefix op
	if(expr.charAt(0) == '&'){
		tree.op = 'and';
		expr = expr.substring(1);
	}else if (expr.charAt(0) == '|'){
		tree.op = 'or';
		expr = expr.substring(1);
	}else if(expr.charAt(0) == '!'){
		tree.op = 'not';
		expr = expr.substring(1);
	}else{
		tree.op = 'expr';
	}
	//if its a logical operator
	if(tree.op != 'expr'){
		var child,i=0;
		tree.children = [];
		
		//logical operators are k-ary, so we go until our expression string runs out 
		//(at least for this recursion level)
		var endParen;
		while (expr.length !== 0){
			endParen = matchParens(expr);
			if (endParen == expr.length-1){
				tree.children[i] = _buildFilterTree(expr);
				expr = "";
			}else{
				child = expr.slice(0,endParen+1);
				expr = expr.substring(endParen+1);
				tree.children[i] = _buildFilterTree(child);
			}
			i++;
		}
	}else{	
		//else its equality expression, parse and return as such
		var operatorStr = "";
		var valueOffset=0;
		tree.name = "";
		tree.value = '';
		if(expr.indexOf('~=') !=-1 ){
			operatorStr  = '~=';
			tree.tag = 'approxMatch';
			valueOffset = 2;
		}else if(expr.indexOf('>=') != -1){
			operatorStr  = '>=';
			tree.tag = 'greaterOrEqual';
			valueOffset = 2;
		}else if(expr.indexOf('<=') != -1){
			operatorStr  = '<=';
			tree.tag = 'lessOrEqual';
			valueOffset = 2;
		}else if(expr.indexOf("=") != -1){
			operatorStr  = '=';
			tree.tag = 'equalityMatch';
			valueOffset = 1;
		}else {
			tree.tag = 'present';	
		}
		console.log('operatorStr: ' + operatorStr + '; valueOffset: ' + valueOffset);
		if (operatorStr == ""){
			tree.name = expr;
		}else{
			//pull out lhs and rhs of equality operator
			//var index = expr.indexOf('=');
			
			var splitAry = expr.split(operatorStr,2);
			tree.name =splitAry[0];
			tree.value = splitAry[1];
			
			if (tree.value.indexOf('*') != -1 && tree.tag == 'equalityMatch'){
				tree.tag = 'substrings';
				var split = tree.value.split("*");
				if(tree.value.indexOf("*") != 0){
					tree.initial = split.shift();
				}else{
					split.shift();
				}
				if(tree.value.lastIndexOf("*") != tree.value.length-1){
					tree['final'] = split.pop();
				}else{
					split.pop();
				}
				tree.any = split;
			}
			if(tree.value.length == 0){
				tree.tag = 'present';
			}
		}
	}
	
	return tree;
};

var treeToObjs = function(tree,filterObj){
	console.log("in treeToObjs");
	if(tree === undefined){
		return filterObj;
	}
	
	if(tree.length === 0){
		return filterObj;
	}
	
	var currentFilter = filterObj;
	if(tree.op != "expr"){
		console.log("adding "+tree.op+" to filters");
		switch (tree.op){
			case "and":
				filterObj.addFilter(currentFilter = new AndFilter({filters:[]}));
			break;
			case "or":
				filterObj.addFilter(currentFilter = new OrFilter({filters:[]}));
			break;
			case "not":
				filterObj.addFilter(currentFilter = new NotFilter({filters:[]}));
			break;
		}
		for(var i = 0,tempFilter,child;i<tree.children.length;i++){
			child = tree.children[i];
			treeToObjs(child,currentFilter);
		}
	}else{
		var tempFilter;
		//console.log("adding "+tree.tag+" to filters");
		switch(tree.tag){
			case "approxMatch":
				tempFilter = new ApproximateFilter({
					attribute: tree.name,
					value: tree.value
				});
				console.log("adding "+tree.tag+"; attr: "+tree.name+"; value: "+tree.value);
			break;
			case "greaterOrEqual":
				tempFilter = new GreaterThanEqualsFilter({
					attribute: tree.name,
					value: tree.value
				});
				console.log("adding "+tree.tag+"; attr: "+tree.name+"; value: "+tree.value);
			break;
			case "lessOrEqual":
				tempFilter = new LessThanEqualsFilter({
					attribute: tree.name,
					value: tree.value
				});
				console.log("adding "+tree.tag+"; attr: "+tree.name+"; value: "+tree.value);
			break;
			case "equalityMatch":
				tempFilter = new EqualityFilter({
					attribute: tree.name,
					value: tree.value
				});
				console.log("adding "+tree.tag+"; attr: "+tree.name+"; value: "+tree.value);
			break;
			case "substrings":
				tempFilter = new SubstringFilter({
					attribute: tree.name,
					initial: tree.initial,
					any: tree.any,
					"final": tree["final"]
				});
				console.log("adding "+tree.tag+"; attr: "+tree.name+"; initial: "+tree.initial+"; any: "+JSON.stringify(tree.any) + "; final: "+tree['final']);
			break;
			case "present":
				tempFilter = new PresenceFilter({
					attribute: tree.name
				});
				console.log("adding "+tree.tag+"; attr: "+tree.name);
			break;
		}
		filterObj.addFilter(tempFilter);
	}
};


function _parseString(str){
	assert.ok(str);
	var filterObj = new AndFilter({
		filters:[]
	});
	
	var tree = _buildFilterTree(str);
	console.log("tree built: ",JSON.stringify(tree));
	treeToObjs(tree,filterObj);
	return filterObj.filters[0];
};

/*
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
*/

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


// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var test = require('tap').test;


///--- Globals

var Filter;


///--- Tests

test('load library', function (t) {
  var filters = require('../../lib/index').filters;
  t.ok(filters);
  Filter = filters.Filter;
  t.ok(Filter);
  t.end();
});


test('multi_test array', function (t) {
  var rule = function (item) {
    return (item == 3);
  };
  t.ok(Filter.multi_test(rule, [1, 2, 3]));
  t.ok(!Filter.multi_test(rule, [1, 2]));
  t.end();
});


test('multi_test value', function (t) {
  var rule = function (item) {
    return (item == 3);
  };
  t.ok(Filter.multi_test(rule, 3));
  t.ok(!Filter.multi_test(rule, 1));
  t.end();
});


test('get_attr_caseless exact match', function (t) {
  var f = Filter.get_attr_caseless;
  t.equal(f({attr: 'testval'}, 'attr'), 'testval');
  t.equal(f({attr: 'testval'}, 'missing'), null);
  t.end();
});


test('get_attr_caseless insensitive match', function (t) {
  var f = Filter.get_attr_caseless;
  var data = {
    lower: 'lower',
    UPPER: 'upper',
    MiXeD: 'mixed'
  };
  t.equal(f(data, 'lower'), 'lower');
  t.equal(f(data, 'upper'), 'upper');
  t.equal(f(data, 'mixed'), 'mixed');
  t.equal(f(data, 'missing'), null);
  t.end();
});

// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var test = require('tap').test;

var parse = require('../../lib/index').parseFilter;



test('GH-48 XML Strings in filter', function(t) {
  var str = '(&(CentralUIEnrollments=\\<mydoc\\>*)(objectClass=User))';
  var f = parse(str);
  t.ok(f);
  t.ok(f.filters);
  t.equal(f.filters.length, 2);
  f.filters.forEach(function(filter) {
    t.ok(filter.attribute);
  });
  t.end();
});

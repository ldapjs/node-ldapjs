// Copyright 2014 Mark Cavage.  All rights reserved.

var assert = require('assert');
var fs = require('fs');
var path = require('path');


function runTests(directory) {
  fs.readdir(directory, function (err, files) {
    assert.ifError(err);

    console.dir(files);
    files.filter(function (f) {
      return (/\.test\.js$/.test(f));
    }).map(function (f) {
      return (path.join(directory, f));
    }).forEach(require);
  });
}

///--- Run All Tests

(function main() {
  runTests(__dirname);
  runTests(path.join(__dirname, 'controls'));
  runTests(path.join(__dirname, 'filters'));
  runTests(path.join(__dirname, 'messages'));
})();

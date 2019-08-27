'use strict';

const os = require('os');
const path = require('path');
const uuid = require('uuid');

function getSock() {
  if (process.platform === 'win32') {
    return '\\\\.\\pipe\\' + uuid();
  } else {
    return path.join(os.tmpdir(), uuid());
  }
}

module.exports = {
  getSock
}

'use strict'

const os = require('os')
const path = require('path')
const crypto = require('crypto')

function uuid () {
  return crypto.randomBytes(16).toString('hex')
}

function getSock () {
  if (process.platform === 'win32') {
    return '\\\\.\\pipe\\' + uuid()
  } else {
    return path.join(os.tmpdir(), uuid())
  }
}

module.exports = {
  getSock,
  uuid
}

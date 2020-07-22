'use strict'

const logger = require('abstract-logging')
logger.child = function () { return logger }

module.exports = logger

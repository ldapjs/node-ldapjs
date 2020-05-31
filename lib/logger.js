'use strict'

const logger = Object.create(require('abstract-logging'))
logger.child = function () { return logger }

module.exports = logger

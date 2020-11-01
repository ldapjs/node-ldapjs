'use strict'

const EventEmitter = require('events').EventEmitter

/**
 * A CorkedEmitter is a variant of an EventEmitter where events emitted
 *  wait for the appearance of the first listener of any kind. That is,
 *  a CorkedEmitter will store all .emit()s it receives, to be replayed
 *  later when an .on() is applied.
 * It is meant for situations where the consumers of the emitter are
 *  unable to register listeners right away, and cannot afford to miss
 *  any events emitted from the start.
 * Note that, whenever the first emitter (for any event) appears,
 *  the emitter becomes uncorked and works as usual for ALL events, and
 *  will not cache anything anymore. This is necessary to avoid
 *  re-ordering emits - either everything is being buffered, or nothing.
 */
function CorkedEmitter () {
  const self = this
  EventEmitter.call(self)
  /**
     * An array of arguments objects (array-likes) to emit on open.
     */
  self._outstandingEmits = []
  /**
     * Whether the normal flow of emits is restored yet.
     */
  self._opened = false
  // When the first listener appears, we enqueue an opening.
  // It is not done immediately, so that other listeners can be
  //  registered in the same critical section.
  self.once('newListener', function () {
    setImmediate(function releaseStoredEvents () {
      self._opened = true
      self._outstandingEmits.forEach(function (args) {
        self.emit.apply(self, args)
      })
    })
  })
}
CorkedEmitter.prototype = Object.create(EventEmitter.prototype)
CorkedEmitter.prototype.emit = function emit (eventName) {
  if (this._opened || eventName === 'newListener') {
    EventEmitter.prototype.emit.apply(this, arguments)
  } else {
    this._outstandingEmits.push(arguments)
  }
}

module.exports = CorkedEmitter

'use strict'

const EventEmitter = require('events').EventEmitter
const util = require('util')
const assert = require('assert-plus')
const { PagedResultsControl } = require('@ldapjs/controls')
const CorkedEmitter = require('../corked_emitter.js')

/// --- API

/**
 * Handler object for paged search operations.
 *
 * Provided to consumers in place of the normal search EventEmitter it adds the
 * following new events:
 * 1. page      - Emitted whenever the end of a result page is encountered.
 *                If this is the last page, 'end' will also be emitted.
 *                The event passes two arguments:
 *                1. The result object (similar to 'end')
 *                2. A callback function optionally used to continue the search
 *                   operation if the pagePause option was specified during
 *                   initialization.
 * 2. pageError - Emitted if the server does not support paged search results
 *                If there are no listeners for this event, the 'error' event
 *                will be emitted (and 'end' will not be).  By listening to
 *                'pageError', a successful search that lacks paging will be
 *                able to emit 'end'.
 */
function SearchPager (opts) {
  assert.object(opts)
  assert.func(opts.callback)
  assert.number(opts.pageSize)
  assert.func(opts.sendRequest)

  CorkedEmitter.call(this, {})

  this.callback = opts.callback
  this.controls = opts.controls
  this.pageSize = opts.pageSize
  this.pagePause = opts.pagePause
  this.sendRequest = opts.sendRequest

  this.controls.forEach(function (control) {
    if (control.type === PagedResultsControl.OID) {
      // The point of using SearchPager is not having to do this.
      // Toss an error if the pagedResultsControl is present
      throw new Error('redundant pagedResultControl')
    }
  })

  this.finished = false
  this.started = false

  const emitter = new EventEmitter()
  emitter.on('searchRequest', this.emit.bind(this, 'searchRequest'))
  emitter.on('searchEntry', this.emit.bind(this, 'searchEntry'))
  emitter.on('end', this._onEnd.bind(this))
  emitter.on('error', this._onError.bind(this))
  this.childEmitter = emitter
}
util.inherits(SearchPager, CorkedEmitter)
module.exports = SearchPager

/**
 * Start the paged search.
 */
SearchPager.prototype.begin = function begin () {
  // Starting first page
  this._nextPage(null)
}

SearchPager.prototype._onEnd = function _onEnd (res) {
  const self = this
  let cookie = null
  res.controls.forEach(function (control) {
    if (control.type === PagedResultsControl.OID) {
      cookie = control.value.cookie
    }
  })
  // Pass a noop callback by default for page events
  const nullCb = function () { }

  if (cookie === null) {
    // paged search not supported
    this.finished = true
    this.emit('page', res, nullCb)
    const err = new Error('missing paged control')
    err.name = 'PagedError'
    if (this.listeners('pageError').length > 0) {
      this.emit('pageError', err)
      // If the consumer as subscribed to pageError, SearchPager is absolved
      // from delivering the fault via the 'error' event.  Emitting an 'end'
      // event after 'error' breaks the contract that the standard client
      // provides, so it's only a possibility if 'pageError' is used instead.
      this.emit('end', res)
    } else {
      this.emit('error', err)
      // No end event possible per explanation above.
    }
    return
  }

  if (cookie.length === 0) {
    // end of paged results
    this.finished = true
    this.emit('page', nullCb)
    this.emit('end', res)
  } else {
    if (this.pagePause) {
      // Wait to fetch next page until callback is invoked
      // Halt page fetching if called with error
      this.emit('page', res, function (err) {
        if (!err) {
          self._nextPage(cookie)
        } else {
          // the paged search has been canceled so emit an end
          self.emit('end', res)
        }
      })
    } else {
      this.emit('page', res, nullCb)
      this._nextPage(cookie)
    }
  }
}

SearchPager.prototype._onError = function _onError (err) {
  this.finished = true
  this.emit('error', err)
}

/**
 * Initiate a search for the next page using the returned cookie value.
 */
SearchPager.prototype._nextPage = function _nextPage (cookie) {
  const controls = this.controls.slice(0)
  controls.push(new PagedResultsControl({
    value: {
      size: this.pageSize,
      cookie
    }
  }))

  this.sendRequest(controls, this.childEmitter, this._sendCallback.bind(this))
}

/**
 * Callback provided to the client API for successful transmission.
 */
SearchPager.prototype._sendCallback = function _sendCallback (err) {
  if (err) {
    this.finished = true
    if (!this.started) {
      // EmitSend error during the first page, bail via callback
      this.callback(err, null)
    } else {
      this.emit('error', err)
    }
  } else {
    // search successfully send
    if (!this.started) {
      this.started = true
      // send self as emitter as the client would
      this.callback(null, this)
    }
  }
}

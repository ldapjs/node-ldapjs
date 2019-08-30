'use strict'

const idGeneratorFactory = require('./id-generator')
const purgeAbandoned = require('./purge-abandoned')

/**
 * Returns a message tracker object that keeps track of which message
 * identifiers correspond to which message handlers. Also handles keeping track
 * of abandoned messages.
 *
 * @param {object} options
 * @param {string} options.id An identifier for the tracker.
 * @param {object} options.parser An object that will be used to parse messages.
 *
 * @returns {MessageTracker}
 */
module.exports = function messageTrackerFactory (options) {
  if (Object.prototype.toString.call(options) !== '[object Object]') {
    throw Error('options object is required')
  }
  if (!options.id || typeof options.id !== 'string') {
    throw Error('options.id string is required')
  }
  if (!options.parser || Object.prototype.toString.call(options.parser) !== '[object Object]') {
    throw Error('options.parser object is required')
  }

  let currentID = 0
  const nextID = idGeneratorFactory()
  const messages = new Map()
  const abandoned = new Map()

  /**
   * @typedef {object} MessageTracker
   * @property {string} id The identifier of the tracker as supplied via the options.
   * @property {object} parser The parser object given by the the options.
   */
  const tracker = {
    id: options.id,
    parser: options.parser
  }

  /**
   * Count of messages awaiting response.
   *
   * @alias pending
   * @memberof! MessageTracker#
   */
  Object.defineProperty(tracker, 'pending', {
    get () {
      return messages.size
    }
  })

  /**
   * Move a specific message to the abanded track.
   *
   * @param {integer} msgID The identifier for the message to move.
   *
   * @memberof MessageTracker
   * @method abandon
   */
  tracker.abandon = function abandonMessage (msgID) {
    if (messages.has(msgID) === false) return false
    abandoned.set(msgID, {
      age: currentID,
      cb: messages.get(msgID)
    })
    return messages.delete(msgID)
  }

  /**
   * Retrieves the message handler for a message. Removes abandoned messages
   * that have been given time to be resolved.
   *
   * @param {integer} msgID The identifier for the message to get the handler for.
   *
   * @memberof MessageTracker
   * @method fetch
   */
  tracker.fetch = function fetchMessage (msgID) {
    const messageCB = messages.get(msgID)
    if (messageCB) {
      purgeAbandoned(msgID, abandoned)
      return messageCB
    }

    // We sent an abandon request but the server either wasn't able to process
    // it or has not received it yet. Therefore, we received a response for the
    // abandoned message. So we must return the abandoned message's callback
    // to be processed normally.
    const abandonedMsg = abandoned.get(msgID)
    if (abandonedMsg) {
      return abandonedMsg.cb
    }

    return null
  }

  /**
   * Removes all message tracks, cleans up the abandoned track, and invokes
   * a callback for each message purged.
   *
   * @param {function} cb A function with the signature `(msgID, handler)`.
   *
   * @memberof MessageTracker
   * @method purge
   */
  tracker.purge = function purgeMessages (cb) {
    messages.forEach((val, key) => {
      purgeAbandoned(key, abandoned)
      tracker.remove(key)
      cb(key, val)
    })
  }

  /**
   * Removes a message from all tracking.
   *
   * @param {integer} msgID The identifier for the message to remove from tracking.
   *
   * @memberof MessageTracker
   * @method remove
   */
  tracker.remove = function removeMessage (msgID) {
    if (messages.delete(msgID) === false) {
      abandoned.delete(msgID)
    }
  }

  /**
   * Add a message handler to be tracked.
   *
   * @param {object} message The message object to be tracked. This object will
   * have a new property added to it: `messageID`.
   * @param {function} callback The handler for the message.
   *
   * @memberof MessageTracker
   * @method track
   */
  tracker.track = function trackMessage (message, callback) {
    currentID = nextID()
    // This side effect is not ideal but the client doesn't attach the tracker
    // to itself until after the `.connect` method has fired. If this can be
    // refactored later, then we can possibly get rid of this side effect.
    message.messageID = currentID
    messages.set(currentID, callback)
  }

  return tracker
}

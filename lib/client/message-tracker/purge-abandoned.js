'use strict'

const { AbandonedError } = require('../../errors')
const geWindow = require('./ge-window')

/**
 * Given a `msgID` and a set of `abandoned` messages, remove any abandoned
 * messages that existed _prior_ to the specified `msgID`. For example, let's
 * assume the server has sent 3 messages:
 *
 * 1. A search message.
 * 2. An abandon message for the search message.
 * 3. A new search message.
 *
 * When the response for message #1 comes in, if it does, it will be processed
 * normally due to the specification. Message #2 will not receive a response, or
 * if the server does send one since the spec sort of allows it, we won't do
 * anything with it because we just discard that listener. Now the response
 * for message #3 comes in. At this point, we will issue a purge of responses
 * by passing in `msgID = 3`. This result is that we will remove the tracking
 * for message #1.
 *
 * @param {integer} msgID An upper bound for the messages to be purged.
 * @param {Map} abandoned A set of abandoned messages. Each message is an object
 * `{ age: <id>, cb: <func> }` where `age` was the current message id when the
 * abandon message was sent.
 */
module.exports = function purgeAbandoned (msgID, abandoned) {
  abandoned.forEach((val, key) => {
    if (geWindow(val.age, msgID) === false) return
    val.cb(new AbandonedError('client request abandoned'))
    abandoned.delete(key)
  })
}

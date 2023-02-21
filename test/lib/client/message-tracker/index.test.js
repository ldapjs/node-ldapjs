'use strict'

const tap = require('tap')
const messageTrackerFactory = require('../../../../lib/client/message-tracker/')

tap.test('options', t => {
  t.test('requires an options object', async t => {
    try {
      messageTrackerFactory()
    } catch (error) {
      t.match(error, /options object is required/)
    }

    try {
      messageTrackerFactory([])
    } catch (error) {
      t.match(error, /options object is required/)
    }

    try {
      messageTrackerFactory('')
    } catch (error) {
      t.match(error, /options object is required/)
    }

    try {
      messageTrackerFactory(42)
    } catch (error) {
      t.match(error, /options object is required/)
    }
  })

  t.test('requires id to be a string', async t => {
    try {
      messageTrackerFactory({ id: {} })
    } catch (error) {
      t.match(error, /options\.id string is required/)
    }

    try {
      messageTrackerFactory({ id: [] })
    } catch (error) {
      t.match(error, /options\.id string is required/)
    }

    try {
      messageTrackerFactory({ id: 42 })
    } catch (error) {
      t.match(error, /options\.id string is required/)
    }
  })

  t.test('requires parser to be an object', async t => {
    try {
      messageTrackerFactory({ id: 'foo', parser: 'bar' })
    } catch (error) {
      t.match(error, /options\.parser object is required/)
    }

    try {
      messageTrackerFactory({ id: 'foo', parser: 42 })
    } catch (error) {
      t.match(error, /options\.parser object is required/)
    }

    try {
      messageTrackerFactory({ id: 'foo', parser: [] })
    } catch (error) {
      t.match(error, /options\.parser object is required/)
    }
  })

  t.end()
})

tap.test('.pending', t => {
  t.test('returns 0 for no messages', async t => {
    const tracker = messageTrackerFactory({ id: 'foo', parser: {} })
    t.equal(tracker.pending, 0)
  })

  t.test('returns 1 for 1 message', async t => {
    const tracker = messageTrackerFactory({ id: 'foo', parser: {} })
    tracker.track({}, () => {})
    t.equal(tracker.pending, 1)
  })

  t.end()
})

tap.test('#abandon', t => {
  t.test('returns false if message does not exist', async t => {
    const tracker = messageTrackerFactory({ id: 'foo', parser: {} })
    const result = tracker.abandon(1)
    t.equal(result, false)
  })

  t.test('returns true if message is abandoned', async t => {
    const tracker = messageTrackerFactory({ id: 'foo', parser: {} })
    tracker.track({}, {})
    const result = tracker.abandon(1)
    t.equal(result, true)
  })

  t.end()
})

tap.test('#fetch', t => {
  t.test('returns handler for fetched message', async t => {
    const tracker = messageTrackerFactory({ id: 'foo', parser: {} })
    tracker.track({}, handler)
    const { callback: fetched } = tracker.fetch(1)
    t.equal(fetched, handler)

    function handler () {}
  })

  t.test('returns handler for fetched abandoned message', async t => {
    const tracker = messageTrackerFactory({ id: 'foo', parser: {} })
    tracker.track({}, handler)
    tracker.track({ abandon: 'message' }, () => {})
    tracker.abandon(1)
    const { callback: fetched } = tracker.fetch(1)
    t.equal(fetched, handler)

    function handler () {}
  })

  t.test('returns null when message does not exist', async t => {
    const tracker = messageTrackerFactory({ id: 'foo', parser: {} })
    const fetched = tracker.fetch(1)
    t.equal(fetched, null)
  })

  t.end()
})

tap.test('#purge', t => {
  t.test('invokes cb for each tracked message', async t => {
    t.plan(4)
    let count = 0
    const tracker = messageTrackerFactory({ id: 'foo', parser: {} })
    tracker.track({}, handler1)
    tracker.track({}, handler2)
    tracker.purge(cb)

    function cb (msgID, handler) {
      if (count === 0) {
        t.equal(msgID, 1)
        t.equal(handler, handler1)
        count += 1
        return
      }
      t.equal(msgID, 2)
      t.equal(handler, handler2)
    }

    function handler1 () {}
    function handler2 () {}
  })

  t.end()
})

tap.test('#remove', t => {
  t.test('removes from the current track', async t => {
    const tracker = messageTrackerFactory({ id: 'foo', parser: {} })
    tracker.track({}, () => {})
    tracker.remove(1)
    t.equal(tracker.pending, 0)
  })

  // Not a great test. It exercises the desired code path, but we probably
  // should expose some insight into the abandoned track.
  t.test('removes from the abandoned track', async t => {
    const tracker = messageTrackerFactory({ id: 'foo', parser: {} })
    tracker.track({}, () => {})
    tracker.track({ abandon: 'message' }, () => {})
    tracker.abandon(1)
    tracker.remove(1)
    t.equal(tracker.pending, 1)
  })

  t.end()
})

tap.test('#track', t => {
  t.test('add messageId and tracks message', async t => {
    const tracker = messageTrackerFactory({ id: 'foo', parser: {} })
    const msg = {}
    tracker.track(msg, handler)

    t.same(msg, { messageId: 1 })
    const { callback: cb } = tracker.fetch(1)
    t.equal(cb, handler)

    function handler () {}
  })

  t.end()
})

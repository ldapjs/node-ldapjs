// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')

const Attribute = require('./attribute')
// var Protocol = require('./protocol')

/// --- API

function Change (options) {
  if (options) {
    assert.object(options)
    assert.optionalString(options.operation)
  } else {
    options = {}
  }

  this._modification = false
  this.operation = options.operation || options.type || 'add'
  this.modification = options.modification || {}
}
Object.defineProperties(Change.prototype, {
  operation: {
    get: function getOperation () {
      switch (this._operation) {
        case 0x00: return 'add'
        case 0x01: return 'delete'
        case 0x02: return 'replace'
        default:
          throw new Error('0x' + this._operation.toString(16) + ' is invalid')
      }
    },
    set: function setOperation (val) {
      assert.string(val)
      switch (val.toLowerCase()) {
        case 'add':
          this._operation = 0x00
          break
        case 'delete':
          this._operation = 0x01
          break
        case 'replace':
          this._operation = 0x02
          break
        default:
          throw new Error('Invalid operation type: 0x' + val.toString(16))
      }
    },
    configurable: false
  },
  modification: {
    get: function getModification () {
      return this._modification
    },
    set: function setModification (val) {
      if (Attribute.isAttribute(val)) {
        this._modification = val
        return
      }
      // Does it have an attribute-like structure
      if (Object.keys(val).length === 2 &&
          typeof (val.type) === 'string' &&
          Array.isArray(val.vals)) {
        this._modification = new Attribute({
          type: val.type,
          vals: val.vals
        })
        return
      }

      const keys = Object.keys(val)
      if (keys.length > 1) {
        throw new Error('Only one attribute per Change allowed')
      } else if (keys.length === 0) {
        return
      }

      const k = keys[0]
      const _attr = new Attribute({ type: k })
      if (Array.isArray(val[k])) {
        val[k].forEach(function (v) {
          _attr.addValue(v.toString())
        })
      } else if (Buffer.isBuffer(val[k])) {
        _attr.addValue(val[k])
      } else if (val[k] !== undefined && val[k] !== null) {
        _attr.addValue(val[k].toString())
      }
      this._modification = _attr
    },
    configurable: false
  },
  json: {
    get: function getJSON () {
      return {
        operation: this.operation,
        modification: this._modification ? this._modification.json : {}
      }
    },
    configurable: false
  }
})

Change.isChange = function isChange (change) {
  if (!change || typeof (change) !== 'object') {
    return false
  }
  if ((change instanceof Change) ||
      ((typeof (change.toBer) === 'function') &&
      (change.modification !== undefined) &&
      (change.operation !== undefined))) {
    return true
  }
  return false
}

Change.compare = function (a, b) {
  if (!Change.isChange(a) || !Change.isChange(b)) { throw new TypeError('can only compare Changes') }

  if (a.operation < b.operation) { return -1 }
  if (a.operation > b.operation) { return 1 }

  return Attribute.compare(a.modification, b.modification)
}

/**
 * Apply a Change to properties of an object.
 *
 * @param {Object} change the change to apply.
 * @param {Object} obj the object to apply it to.
 * @param {Boolean} scalar convert single-item arrays to scalars. Default: false
 */
Change.apply = function apply (change, obj, scalar) {
  assert.string(change.operation)
  assert.string(change.modification.type)
  assert.ok(Array.isArray(change.modification.vals))
  assert.object(obj)

  const type = change.modification.type
  const vals = change.modification.vals
  let data = obj[type]
  if (data !== undefined) {
    if (!Array.isArray(data)) {
      data = [data]
    }
  } else {
    data = []
  }
  switch (change.operation) {
    case 'replace':
      if (vals.length === 0) {
      // replace empty is a delete
        delete obj[type]
        return obj
      } else {
        data = vals
      }
      break
    case 'add': {
    // add only new unique entries
      const newValues = vals.filter(function (entry) {
        return (data.indexOf(entry) === -1)
      })
      data = data.concat(newValues)
      break
    }
    case 'delete':
      data = data.filter(function (entry) {
        return (vals.indexOf(entry) === -1)
      })
      if (data.length === 0) {
      // Erase the attribute if empty
        delete obj[type]
        return obj
      }
      break
    default:
      break
  }
  if (scalar && data.length === 1) {
    // store single-value outputs as scalars, if requested
    obj[type] = data[0]
  } else {
    obj[type] = data
  }
  return obj
}

Change.prototype.parse = function (ber) {
  assert.ok(ber)

  ber.readSequence()
  this._operation = ber.readEnumeration()
  this._modification = new Attribute()
  this._modification.parse(ber)

  return true
}

Change.prototype.toBer = function (ber) {
  assert.ok(ber)

  ber.startSequence()
  ber.writeEnumeration(this._operation)
  ber = this._modification.toBer(ber)
  ber.endSequence()

  return ber
}

/// --- Exports

module.exports = Change

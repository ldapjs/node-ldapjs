// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert-plus')

/// --- Helpers

function invalidDN (name) {
  const e = new Error()
  e.name = 'InvalidDistinguishedNameError'
  e.message = name
  return e
}

function isAlphaNumeric (c) {
  const re = /[A-Za-z0-9]/
  return re.test(c)
}

function isWhitespace (c) {
  const re = /\s/
  return re.test(c)
}

function repeatChar (c, n) {
  let out = ''
  const max = n || 0
  for (let i = 0; i < max; i++) { out += c }
  return out
}

/// --- API

function RDN (obj) {
  const self = this
  this.attrs = {}

  if (obj) {
    Object.keys(obj).forEach(function (k) {
      self.set(k, obj[k])
    })
  }
}

RDN.prototype.set = function rdnSet (name, value, opts) {
  assert.string(name, 'name (string) required')
  assert.string(value, 'value (string) required')

  const self = this
  const lname = name.toLowerCase()
  this.attrs[lname] = {
    value: value,
    name: name
  }
  if (opts && typeof (opts) === 'object') {
    Object.keys(opts).forEach(function (k) {
      if (k !== 'value') { self.attrs[lname][k] = opts[k] }
    })
  }
}

RDN.prototype.equals = function rdnEquals (rdn) {
  if (typeof (rdn) !== 'object') { return false }

  const ourKeys = Object.keys(this.attrs)
  const theirKeys = Object.keys(rdn.attrs)
  if (ourKeys.length !== theirKeys.length) { return false }

  ourKeys.sort()
  theirKeys.sort()

  for (let i = 0; i < ourKeys.length; i++) {
    if (ourKeys[i] !== theirKeys[i]) { return false }
    if (this.attrs[ourKeys[i]].value !== rdn.attrs[ourKeys[i]].value) { return false }
  }
  return true
}

/**
 * Convert RDN to string according to specified formatting options.
 * (see: DN.format for option details)
 */
RDN.prototype.format = function rdnFormat (options) {
  assert.optionalObject(options, 'options must be an object')
  options = options || {}

  const self = this
  let str = ''

  function escapeValue (val, forceQuote) {
    let out = ''
    let cur = 0
    const len = val.length
    let quoted = false
    /* BEGIN JSSTYLED */
    // TODO: figure out what this regex is actually trying to test for and
    // fix it to appease the linter.
    /* eslint-disable-next-line no-useless-escape */
    const escaped = /[\\\"]/
    const special = /[,=+<>#;]/
    /* END JSSTYLED */

    if (len > 0) {
      // Wrap strings with trailing or leading spaces in quotes
      quoted = forceQuote || (val[0] === ' ' || val[len - 1] === ' ')
    }

    while (cur < len) {
      if (escaped.test(val[cur]) || (!quoted && special.test(val[cur]))) {
        out += '\\'
      }
      out += val[cur++]
    }
    if (quoted) { out = '"' + out + '"' }
    return out
  }
  function sortParsed (a, b) {
    return self.attrs[a].order - self.attrs[b].order
  }
  function sortStandard (a, b) {
    const nameCompare = a.localeCompare(b)
    if (nameCompare === 0) {
      // TODO: Handle binary values
      return self.attrs[a].value.localeCompare(self.attrs[b].value)
    } else {
      return nameCompare
    }
  }

  const keys = Object.keys(this.attrs)
  if (options.keepOrder) {
    keys.sort(sortParsed)
  } else {
    keys.sort(sortStandard)
  }

  keys.forEach(function (key) {
    const attr = self.attrs[key]
    if (str.length) { str += '+' }

    if (options.keepCase) {
      str += attr.name
    } else {
      if (options.upperName) { str += key.toUpperCase() } else { str += key }
    }

    str += '=' + escapeValue(attr.value, (options.keepQuote && attr.quoted))
  })

  return str
}

RDN.prototype.toString = function rdnToString () {
  return this.format()
}

// Thank you OpenJDK!
function parse (name) {
  if (typeof (name) !== 'string') { throw new TypeError('name (string) required') }
  else { name = name.toLowerCase() }

  let cur = 0
  const len = name.length

  function parseRdn () {
    const rdn = new RDN()
    let order = 0
    rdn.spLead = trim()
    while (cur < len) {
      const opts = {
        order: order
      }
      const attr = parseAttrType()
      trim()
      if (cur >= len || name[cur++] !== '=') { throw invalidDN(name) }

      trim()
      // Parameters about RDN value are set in 'opts' by parseAttrValue
      const value = parseAttrValue(opts)
      rdn.set(attr, value, opts)
      rdn.spTrail = trim()
      if (cur >= len || name[cur] !== '+') { break }
      ++cur
      ++order
    }
    return rdn
  }

  function trim () {
    let count = 0
    while ((cur < len) && isWhitespace(name[cur])) {
      ++cur
      count++
    }
    return count
  }

  function parseAttrType () {
    const beg = cur
    while (cur < len) {
      const c = name[cur]
      if (isAlphaNumeric(c) ||
          c === '.' ||
          c === '-' ||
          c === ' ') {
        ++cur
      } else {
        break
      }
    }
    // Back out any trailing spaces.
    while ((cur > beg) && (name[cur - 1] === ' ')) { --cur }

    if (beg === cur) { throw invalidDN(name) }

    return name.slice(beg, cur)
  }

  function parseAttrValue (opts) {
    if (cur < len && name[cur] === '#') {
      opts.binary = true
      return parseBinaryAttrValue()
    } else if (cur < len && name[cur] === '"') {
      opts.quoted = true
      return parseQuotedAttrValue()
    } else {
      return parseStringAttrValue()
    }
  }

  function parseBinaryAttrValue () {
    const beg = cur++
    while (cur < len && isAlphaNumeric(name[cur])) { ++cur }

    return name.slice(beg, cur)
  }

  function parseQuotedAttrValue () {
    let str = ''
    ++cur // Consume the first quote

    while ((cur < len) && name[cur] !== '"') {
      if (name[cur] === '\\') { cur++ }
      str += name[cur++]
    }
    if (cur++ >= len) {
      // no closing quote
      throw invalidDN(name)
    }

    return str
  }

  function parseStringAttrValue () {
    const beg = cur
    let str = ''
    let esc = -1

    while ((cur < len) && !atTerminator()) {
      if (name[cur] === '\\') {
        // Consume the backslash and mark its place just in case it's escaping
        // whitespace which needs to be preserved.
        esc = cur++
      }
      if (cur === len) {
        // backslash followed by nothing
        throw invalidDN(name)
      }
      str += name[cur++]
    }

    // Trim off (unescaped) trailing whitespace and rewind cursor to the end of
    // the AttrValue to record whitespace length.
    for (; cur > beg; cur--) {
      if (!isWhitespace(name[cur - 1]) || (esc === (cur - 1))) { break }
    }
    return str.slice(0, cur - beg)
  }

  function atTerminator () {
    return (cur < len &&
            (name[cur] === ',' ||
             name[cur] === ';' ||
             name[cur] === '+'))
  }

  const rdns = []

  // Short-circuit for empty DNs
  if (len === 0) { return new DN(rdns) }

  rdns.push(parseRdn())
  while (cur < len) {
    if (name[cur] === ',' || name[cur] === ';') {
      ++cur
      rdns.push(parseRdn())
    } else {
      throw invalidDN(name)
    }
  }

  return new DN(rdns)
}

function DN (rdns) {
  assert.optionalArrayOfObject(rdns, '[object] required')

  this.rdns = rdns ? rdns.slice() : []
  this._format = {}
}
Object.defineProperties(DN.prototype, {
  length: {
    get: function getLength () { return this.rdns.length },
    configurable: false
  }
})

/**
 * Convert DN to string according to specified formatting options.
 *
 * Parameters:
 * - options: formatting parameters (optional, details below)
 *
 * Options are divided into two types:
 * - Preservation options: Using data recorded during parsing, details of the
 *   original DN are preserved when converting back into a string.
 * - Modification options: Alter string formatting defaults.
 *
 * Preservation options _always_ take precedence over modification options.
 *
 * Preservation Options:
 * - keepOrder: Order of multi-value RDNs.
 * - keepQuote: RDN values which were quoted will remain so.
 * - keepSpace: Leading/trailing spaces will be output.
 * - keepCase: Parsed attr name will be output instead of lowercased version.
 *
 * Modification Options:
 * - upperName: RDN names will be uppercased instead of lowercased.
 * - skipSpace: Disable trailing space after RDN separators
 */
DN.prototype.format = function dnFormat (options) {
  assert.optionalObject(options, 'options must be an object')
  options = options || this._format

  let str = ''
  this.rdns.forEach(function (rdn) {
    const rdnString = rdn.format(options)
    if (str.length !== 0) {
      str += ','
    }
    if (options.keepSpace) {
      str += (repeatChar(' ', rdn.spLead) +
        rdnString + repeatChar(' ', rdn.spTrail))
    } else if (options.skipSpace === true || str.length === 0) {
      str += rdnString
    } else {
      str += ' ' + rdnString
    }
  })
  return str
}

/**
 * Set default string formatting options.
 */
DN.prototype.setFormat = function setFormat (options) {
  assert.object(options, 'options must be an object')

  this._format = options
}

DN.prototype.toString = function dnToString () {
  return this.format()
}

DN.prototype.parentOf = function parentOf (dn) {
  if (typeof (dn) !== 'object') { dn = parse(dn) }

  if (this.rdns.length >= dn.rdns.length) { return false }

  const diff = dn.rdns.length - this.rdns.length
  for (let i = this.rdns.length - 1; i >= 0; i--) {
    const myRDN = this.rdns[i]
    const theirRDN = dn.rdns[i + diff]

    if (!myRDN.equals(theirRDN)) { return false }
  }

  return true
}

DN.prototype.childOf = function childOf (dn) {
  if (typeof (dn) !== 'object') { dn = parse(dn) }
  return dn.parentOf(this)
}

DN.prototype.isEmpty = function isEmpty () {
  return (this.rdns.length === 0)
}

DN.prototype.equals = function dnEquals (dn) {
  if (typeof (dn) !== 'object') { dn = parse(dn) }

  if (this.rdns.length !== dn.rdns.length) { return false }

  for (let i = 0; i < this.rdns.length; i++) {
    if (!this.rdns[i].equals(dn.rdns[i])) { return false }
  }

  return true
}

DN.prototype.parent = function dnParent () {
  if (this.rdns.length !== 0) {
    const save = this.rdns.shift()
    const dn = new DN(this.rdns)
    this.rdns.unshift(save)
    return dn
  }

  return null
}

DN.prototype.clone = function dnClone () {
  const dn = new DN(this.rdns)
  dn._format = this._format
  return dn
}

DN.prototype.reverse = function dnReverse () {
  this.rdns.reverse()
  return this
}

DN.prototype.pop = function dnPop () {
  return this.rdns.pop()
}

DN.prototype.push = function dnPush (rdn) {
  assert.object(rdn, 'rdn (RDN) required')

  return this.rdns.push(rdn)
}

DN.prototype.shift = function dnShift () {
  return this.rdns.shift()
}

DN.prototype.unshift = function dnUnshift (rdn) {
  assert.object(rdn, 'rdn (RDN) required')

  return this.rdns.unshift(rdn)
}

DN.isDN = function isDN (dn) {
  if (!dn || typeof (dn) !== 'object') {
    return false
  }
  if (dn instanceof DN) {
    return true
  }
  if (Array.isArray(dn.rdns)) {
    // Really simple duck-typing for now
    return true
  }
  return false
}

/// --- Exports

module.exports = {
  parse: parse,
  DN: DN,
  RDN: RDN
}

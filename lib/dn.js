// Copyright 2011 Mark Cavage, Inc.  All rights reserved.



function invalidDN(name) {
  var e = new Error();
  e.name = 'InvalidDistinguishedNameError';
  e.message = name;
  return e;
}


function isAlphaNumeric(c) {
  var re = /[A-Za-z0-9]/;
  return re.test(c);
}


function isWhitespace(c) {
  var re = /\s/;
  return re.test(c);
}

function RDN(obj) {
  var self = this;
  this.attrs = {};

  if (obj) {
    Object.keys(obj).forEach(function (k) {
      self.set(k, obj[k]);
    });
  }
}


RDN.prototype.set = function set(name, value, opts) {
  if (typeof (name) !== 'string')
    throw new TypeError('name (string) required');
  if (typeof (value) !== 'string')
    throw new TypeError('value (string) required');
  var self = this;
  var lname = name.toLowerCase();
  this.attrs[lname] = {
    value: value,
    name: name
  };
  if (opts && typeof (opts) === 'object') {
    Object.keys(opts).forEach(function (k) {
      if (k !== 'value')
        self.attrs[lname][k] = opts[k];
    });
  }
};


RDN.prototype.equals = function equals(rdn) {
  if (typeof (rdn) !== 'object')
    return false;

  var ourKeys = Object.keys(this.attrs);
  var theirKeys = Object.keys(rdn.attrs);
  if (ourKeys.length !== theirKeys.length)
    return false;

  ourKeys.sort();
  theirKeys.sort();

  for (var i = 0; i < ourKeys.length; i++) {
    if (ourKeys[i] !== theirKeys[i])
      return false;
    if (this.attrs[ourKeys[i]].value !== rdn.attrs[ourKeys[i]].value)
      return false;
  }
  return true;
};


/**
 * Convert RDN to string according to specified formatting options.
 * (see: DN.format for option details)
 */
RDN.prototype.format = function format(options) {
  if (options) {
    if (typeof (options) !== 'object')
      throw new TypeError('options must be an object');
  } else {
    options = {};
  }
  var self = this;
  var str = '';

  function escapeValue(val, forceQuote) {
    var out = '';
    var cur = 0;
    var len = val.length;
    var quoted = false;
    /* BEGIN JSSTYLED */
    var escaped = /[\\\"]/;
    var special = /[,=+<>#;]/;
    /* END JSSTYLED */

    if (len > 0) {
      // Wrap strings with trailing or leading spaces in quotes
      quoted = forceQuote || (val[0] == ' ' || val[len-1] == ' ');
    }

    while (cur < len) {
      if (escaped.test(val[cur]) || (!quoted && special.test(val[cur]))) {
        out += '\\';
      }
      out += val[cur++];
    }
    if (quoted)
      out = '"' + out + '"';
    return out;
  }
  function sortParsed(a, b) {
    return self.attrs[a].order - self.attrs[b].order;
  }
  function sortStandard(a, b) {
    var nameCompare = a.localeCompare(b);
    if (nameCompare === 0) {
      // TODO: Handle binary values
      return self.attrs[a].value.localeCompare(self.attrs[b].value);
    } else {
      return nameCompare;
    }
  }

  var keys = Object.keys(this.attrs);
  if (options.keepOrder) {
    keys.sort(sortParsed);
  } else {
    keys.sort(sortStandard);
  }

  keys.forEach(function (key) {
    var attr = self.attrs[key];
    if (str.length)
      str += '+';

    if (options.keepCase) {
      str += attr.name;
    } else {
      if (options.upperName)
        str += key.toUpperCase();
      else
        str += key;
    }

    str += '=' + escapeValue(attr.value, (options.keepQuote && attr.quoted));
  });

  return str;
};


RDN.prototype.toString = function toString() {
  return this.format();
};


// Thank you OpenJDK!
function parse(name) {
  if (typeof (name) !== 'string')
    throw new TypeError('name (string) required');

  var cur = 0;
  var len = name.length;

  function parseRdn() {
    var rdn = new RDN();
    var order = 0;
    rdn.spLead = trim();
    while (cur < len) {
      var opts = {
        order: order
      };
      var attr = parseAttrType();
      trim();
      if (cur >= len || name[cur++] !== '=')
        throw invalidDN(name);

      trim();
      // Parameters about RDN value are set in 'opts' by parseAttrValue
      var value = parseAttrValue(opts);
      rdn.set(attr, value, opts);
      rdn.spTrail = trim();
      if (cur >= len || name[cur] !== '+')
        break;
      ++cur;
      ++order;
    }
    return rdn;
  }


  function trim() {
    var count = 0;
    while ((cur < len) && isWhitespace(name[cur])) {
      ++cur;
      count++;
    }
    return count;
  }

  function parseAttrType() {
    var beg = cur;
    while (cur < len) {
      var c = name[cur];
      if (isAlphaNumeric(c) ||
          c == '.' ||
          c == '-' ||
          c == ' ') {
        ++cur;
      } else {
        break;
      }
    }
    // Back out any trailing spaces.
    while ((cur > beg) && (name[cur - 1] == ' '))
      --cur;

    if (beg == cur)
      throw invalidDN(name);

    return name.slice(beg, cur);
  }

  function parseAttrValue(opts) {
    if (cur < len && name[cur] == '#') {
      opts.binary = true;
      return parseBinaryAttrValue();
    } else if (cur < len && name[cur] == '"') {
      opts.quoted = true;
      return parseQuotedAttrValue();
    } else {
      return parseStringAttrValue();
    }
  }

  function parseBinaryAttrValue() {
    var beg = cur++;
    while (cur < len && isAlphaNumeric(name[cur]))
      ++cur;

    return name.slice(beg, cur);
  }

  function parseQuotedAttrValue() {
    var str = '';
    ++cur; // Consume the first quote

    while ((cur < len) && name[cur] != '"') {
      if (name[cur] === '\\')
        cur++;
      str += name[cur++];
    }
    if (cur++ >= len) // no closing quote
      throw invalidDN(name);

    return str;
  }

  function parseStringAttrValue() {
    var beg = cur;
    var str = '';
    var esc = -1;

    while ((cur < len) && !atTerminator()) {
      if (name[cur] === '\\') {
        // Consume the backslash and mark its place just in case it's escaping
        // whitespace which needs to be preserved.
        esc = cur++;
      }
      if (cur === len) // backslash followed by nothing
        throw invalidDN(name);
      str += name[cur++];
    }

    // Trim off (unescaped) trailing whitespace and rewind cursor to the end of
    // the AttrValue to record whitespace length.
    for (; cur > beg; cur--) {
      if (!isWhitespace(name[cur - 1]) || (esc === (cur - 1)))
        break;
    }
    return str.slice(0, cur - beg);
  }

  function atTerminator() {
    return (cur < len &&
            (name[cur] === ',' ||
             name[cur] === ';' ||
             name[cur] === '+'));
  }

  var rdns = [];

  // Short-circuit for empty DNs
  if (len === 0)
    return new DN(rdns);

  rdns.push(parseRdn());
  while (cur < len) {
    if (name[cur] === ',' || name[cur] === ';') {
      ++cur;
      rdns.push(parseRdn());
    } else {
      throw invalidDN(name);
    }
  }

  return new DN(rdns);
}



///--- API


function DN(rdns) {
  if (!Array.isArray(rdns))
    throw new TypeError('rdns ([object]) required');
  rdns.forEach(function (rdn) {
    if (typeof (rdn) !== 'object')
      throw new TypeError('rdns ([object]) required');
  });

  this.rdns = rdns.slice();
  this._format = {};

  this.__defineGetter__('length', function () {
    return this.rdns.length;
  });
}


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
DN.prototype.format = function (options) {
  if (options) {
    if (typeof (options) !== 'object')
      throw new TypeError('options must be an object');
  } else {
    options = this._format;
  }
  var str = '';
  function repeatChar(c, n) {
    var out = '';
    var max = n ? n : 0;
    for (var i = 0; i < max; i++)
      out += c;
    return out;
  }
  this.rdns.forEach(function (rdn) {
    var rdnString = rdn.format(options);
    if (str.length !== 0) {
      str += ',';
    }
    if (options.keepSpace) {
      str += (repeatChar(' ', rdn.spLead) +
        rdnString + repeatChar(' ', rdn.spTrail));
    } else if (options.skipSpace === true || str.length === 0) {
      str += rdnString;
    } else {
      str += ' ' + rdnString;
    }
  });
  return str;
};


/**
 * Set default string formatting options.
 */
DN.prototype.setFormat = function setFormat(options) {
  if (typeof (options) !== 'object')
    throw new TypeError('options must be an object');
  this._format = options;
};


DN.prototype.toString = function () {
  return this.format();
};


DN.prototype.parentOf = function parentOf(dn) {
  if (typeof (dn) !== 'object')
    dn = parse(dn);

  if (this.rdns.length >= dn.rdns.length)
    return false;

  var diff = dn.rdns.length - this.rdns.length;
  for (var i = this.rdns.length - 1; i >= 0; i--) {
    var myRDN = this.rdns[i];
    var theirRDN = dn.rdns[i + diff];

    if (!myRDN.equals(theirRDN))
      return false;
  }

  return true;
};


DN.prototype.childOf = function childOf(dn) {
  if (typeof (dn) !== 'object')
    dn = parse(dn);
  return dn.parentOf(this);
};


DN.prototype.isEmpty = function isEmpty() {
  return (this.rdns.length === 0);
};


DN.prototype.equals = function (dn) {
  if (typeof (dn) !== 'object')
    dn = parse(dn);

  if (this.rdns.length !== dn.rdns.length)
    return false;

  for (var i = 0; i < this.rdns.length; i++) {
    if (!this.rdns[i].equals(dn.rdns[i]))
      return false;
  }

  return true;
};


DN.prototype.parent = function () {
  if (this.rdns.length !== 0) {
    var save = this.rdns.shift();
    var dn = new DN(this.rdns);
    this.rdns.unshift(save);
    return dn;
  }

  return null;
};


DN.prototype.clone = function () {
  var dn = new DN(this.rdns);
  dn._format = this._format;
  return dn;
};


DN.prototype.reverse = function () {
  this.rdns.reverse();
  return this;
};


DN.prototype.pop = function () {
  return this.rdns.pop();
};


DN.prototype.push = function (rdn) {
  if (typeof (rdn) !== 'object')
    throw new TypeError('rdn (RDN) required');

  return this.rdns.push(rdn);
};


DN.prototype.shift = function () {
  return this.rdns.shift();
};


DN.prototype.unshift = function (rdn) {
  if (typeof (rdn) !== 'object')
    throw new TypeError('rdn (RDN) required');

  return this.rdns.unshift(rdn);
};


DN.isDN = function (dn) {
  if (!dn || typeof (dn) !== 'object') {
    return false;
  }
  if (dn instanceof DN) {
    return true;
  }
  if (Array.isArray(dn.rdns)) {
    // Really simple duck-typing for now
    return true;
  }
  return false;
};


///--- Exports

module.exports = {

  parse: parse,

  DN: DN,

  RDN: RDN

};

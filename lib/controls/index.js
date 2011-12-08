// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');

var Control = require('./control');
var PersistentSearchControl = require('./persistent_search_control');



///--- API

module.exports = {

  getControl: function getControl(ber) {
    assert.ok(ber);

    if (ber.readSequence() === null)
      return null;

    var type;
    var critical = false;
    var value;

    if (ber.length) {
      var end = ber.offset + ber.length;

      type = ber.readString();
      if (ber.offset < end) {
        if (ber.peek() === 0x01)
          critical = ber.readBoolean();
      }

      if (ber.offset < end)
        value = ber.readString(0x04, true);
    }

    var control;
    switch (type) {
    case PersistentSearchControl.OID:
      control = new PersistentSearchControl({
        critical: critical,
        value: value
      });
      break;
    default:
      control = new Control({
        type: type,
        critical: critical,
        value: value.toString('utf8')
      });
    }

    return control;
  },

  Control: Control,
  PersistentSearchControl: PersistentSearchControl
};

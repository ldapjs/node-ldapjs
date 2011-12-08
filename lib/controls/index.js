var assert = require('assert');

var Control = require('./control');
var PersistentSearchControl = require('./persistent_search_control');

var OID_PERSISTENT_SEARCH_CONTROL = '2.16.840.1.113730.3.4.3';

///--- API

module.exports = {
  getControl: function(ber) {
    assert.ok(ber);

    if (ber.readSequence() === null)
      return;

    var end = ber.offset + ber.length;
    var options = {};
    if (ber.length) {
      options.type = ber.readString();
      if (ber.offset < end) {
        if (ber.peek() === 0x01) // Boolean, optional
          options.criticality = ber.readBoolean();
      }
      if (ber.offset < end) {
        if (options.type == OID_PERSISTENT_SEARCH_CONTROL) {
          // send the buffer directly to the PSC
          options.value = ber.readString(0x04, true);
          return new PersistentSearchControl(options);
        } else {
          options.value = ber.readString();
          return new Control(options);
        }
      }
    }
  },

  Control: Control,
  PersistentSearchControl: PersistentSearchControl
};

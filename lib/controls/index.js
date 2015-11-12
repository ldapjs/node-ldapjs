// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var Ber = require('asn1').Ber;

var Control = require('./control');
var EntryChangeNotificationControl =
  require('./entry_change_notification_control');
var PersistentSearchControl = require('./persistent_search_control');
var PagedResultsControl = require('./paged_results_control');
var ServerSideSortingRequestControl =
  require('./server_side_sorting_request_control.js');
var ServerSideSortingResponseControl =
  require('./server_side_sorting_response_control.js');



///--- API

module.exports = {

  getControl: function getControl(ber) {
    assert.ok(ber);

    if (ber.readSequence() === null)
      return null;

    var type;
    var opts = {
      criticality: false,
      value: null
    };

    if (ber.length) {
      var end = ber.offset + ber.length;

      type = ber.readString();
      if (ber.offset < end) {
        if (ber.peek() === Ber.Boolean)
          opts.criticality = ber.readBoolean();
      }

      if (ber.offset < end)
        opts.value = ber.readString(Ber.OctetString, true);
    }

    var control;
    switch (type) {
    case PersistentSearchControl.OID:
      control = new PersistentSearchControl(opts);
      break;
    case EntryChangeNotificationControl.OID:
      control = new EntryChangeNotificationControl(opts);
      break;
    case PagedResultsControl.OID:
      control = new PagedResultsControl(opts);
      break;
    case ServerSideSortingRequestControl.OID:
      control = new ServerSideSortingRequestControl(opts);
      break;
    case ServerSideSortingResponseControl.OID:
      control = new ServerSideSortingResponseControl(opts);
      break;
    default:
      opts.type = type;
      control = new Control(opts);
      break;
    }

    return control;
  },

  Control: Control,
  EntryChangeNotificationControl: EntryChangeNotificationControl,
  PagedResultsControl: PagedResultsControl,
  PersistentSearchControl: PersistentSearchControl,
  ServerSideSortingRequestControl: ServerSideSortingRequestControl,
  ServerSideSortingResponseControl: ServerSideSortingResponseControl
};

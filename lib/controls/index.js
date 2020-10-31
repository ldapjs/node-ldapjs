// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const assert = require('assert')
const Ber = require('asn1').Ber

const Control = require('./control')
const EntryChangeNotificationControl =
  require('./entry_change_notification_control')
const PersistentSearchControl = require('./persistent_search_control')
const PagedResultsControl = require('./paged_results_control')
const ServerSideSortingRequestControl =
  require('./server_side_sorting_request_control.js')
const ServerSideSortingResponseControl =
  require('./server_side_sorting_response_control.js')
const VirtualListViewRequestControl =
  require('./virtual_list_view_request_control.js')
const VirtualListViewResponseControl =
  require('./virtual_list_view_response_control.js')

/// --- API

module.exports = {

  getControl: function getControl (ber) {
    assert.ok(ber)

    if (ber.readSequence() === null) { return null }

    let type
    const opts = {
      criticality: false,
      value: null
    }

    if (ber.length) {
      const end = ber.offset + ber.length

      type = ber.readString()
      if (ber.offset < end) {
        if (ber.peek() === Ber.Boolean) { opts.criticality = ber.readBoolean() }
      }

      if (ber.offset < end) { opts.value = ber.readString(Ber.OctetString, true) }
    }

    let control
    switch (type) {
      case PersistentSearchControl.OID:
        control = new PersistentSearchControl(opts)
        break
      case EntryChangeNotificationControl.OID:
        control = new EntryChangeNotificationControl(opts)
        break
      case PagedResultsControl.OID:
        control = new PagedResultsControl(opts)
        break
      case ServerSideSortingRequestControl.OID:
        control = new ServerSideSortingRequestControl(opts)
        break
      case ServerSideSortingResponseControl.OID:
        control = new ServerSideSortingResponseControl(opts)
        break
      case VirtualListViewRequestControl.OID:
        control = new VirtualListViewRequestControl(opts)
        break
      case VirtualListViewResponseControl.OID:
        control = new VirtualListViewResponseControl(opts)
        break
      default:
        opts.type = type
        control = new Control(opts)
        break
    }

    return control
  },

  Control: Control,
  EntryChangeNotificationControl: EntryChangeNotificationControl,
  PagedResultsControl: PagedResultsControl,
  PersistentSearchControl: PersistentSearchControl,
  ServerSideSortingRequestControl: ServerSideSortingRequestControl,
  ServerSideSortingResponseControl: ServerSideSortingResponseControl,
  VirtualListViewRequestControl: VirtualListViewRequestControl,
  VirtualListViewResponseControl: VirtualListViewResponseControl
}

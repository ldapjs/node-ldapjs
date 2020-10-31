// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const LDAPMessage = require('./message')
const LDAPResult = require('./result')
const Parser = require('./parser')

const AbandonRequest = require('./abandon_request')
const AbandonResponse = require('./abandon_response')
const AddRequest = require('./add_request')
const AddResponse = require('./add_response')
const BindRequest = require('./bind_request')
const BindResponse = require('./bind_response')
const CompareRequest = require('./compare_request')
const CompareResponse = require('./compare_response')
const DeleteRequest = require('./del_request')
const DeleteResponse = require('./del_response')
const ExtendedRequest = require('./ext_request')
const ExtendedResponse = require('./ext_response')
const ModifyRequest = require('./modify_request')
const ModifyResponse = require('./modify_response')
const ModifyDNRequest = require('./moddn_request')
const ModifyDNResponse = require('./moddn_response')
const SearchRequest = require('./search_request')
const SearchEntry = require('./search_entry')
const SearchReference = require('./search_reference')
const SearchResponse = require('./search_response')
const UnbindRequest = require('./unbind_request')
const UnbindResponse = require('./unbind_response')

/// --- API

module.exports = {

  LDAPMessage: LDAPMessage,
  LDAPResult: LDAPResult,
  Parser: Parser,

  AbandonRequest: AbandonRequest,
  AbandonResponse: AbandonResponse,
  AddRequest: AddRequest,
  AddResponse: AddResponse,
  BindRequest: BindRequest,
  BindResponse: BindResponse,
  CompareRequest: CompareRequest,
  CompareResponse: CompareResponse,
  DeleteRequest: DeleteRequest,
  DeleteResponse: DeleteResponse,
  ExtendedRequest: ExtendedRequest,
  ExtendedResponse: ExtendedResponse,
  ModifyRequest: ModifyRequest,
  ModifyResponse: ModifyResponse,
  ModifyDNRequest: ModifyDNRequest,
  ModifyDNResponse: ModifyDNResponse,
  SearchRequest: SearchRequest,
  SearchEntry: SearchEntry,
  SearchReference: SearchReference,
  SearchResponse: SearchResponse,
  UnbindRequest: UnbindRequest,
  UnbindResponse: UnbindResponse

}

// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

const messages = require('@ldapjs/messages')

const Parser = require('./parser')

const SearchResponse = require('./search_response')

/// --- API

module.exports = {

  LDAPMessage: messages.LdapMessage,
  LDAPResult: messages.LdapResult,
  Parser,

  AbandonRequest: messages.AbandonRequest,
  AbandonResponse: messages.AbandonResponse,
  AddRequest: messages.AddRequest,
  AddResponse: messages.AddResponse,
  BindRequest: messages.BindRequest,
  BindResponse: messages.BindResponse,
  CompareRequest: messages.CompareRequest,
  CompareResponse: messages.CompareResponse,
  DeleteRequest: messages.DeleteRequest,
  DeleteResponse: messages.DeleteResponse,
  ExtendedRequest: messages.ExtensionRequest,
  ExtendedResponse: messages.ExtensionResponse,
  ModifyRequest: messages.ModifyRequest,
  ModifyResponse: messages.ModifyResponse,
  ModifyDNRequest: messages.ModifyDnRequest,
  ModifyDNResponse: messages.ModifyDnResponse,
  SearchRequest: messages.SearchRequest,
  SearchEntry: messages.SearchResultEntry,
  SearchReference: messages.SearchResultReference,
  SearchResponse,
  UnbindRequest: messages.UnbindRequest

}

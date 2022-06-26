'use strict'

const parents = require('@ldapjs/filter')

const AndFilter = parents.AndFilter
const ApproximateFilter = parents.ApproximateFilter
const EqualityFilter = parents.EqualityFilter
const ExtensibleFilter = parents.ExtensibleFilter
const GreaterThanEqualsFilter = parents.GreaterThanEqualsFilter
const LessThanEqualsFilter = parents.LessThanEqualsFilter
const NotFilter = parents.NotFilter
const OrFilter = parents.OrFilter
const PresenceFilter = parents.PresenceFilter
const SubstringFilter = parents.SubstringFilter

module.exports = {
  parse: parents.parseBer,

  parseString: parents.parseString,

  AndFilter: AndFilter,
  ApproximateFilter: ApproximateFilter,
  EqualityFilter: EqualityFilter,
  ExtensibleFilter: ExtensibleFilter,
  GreaterThanEqualsFilter: GreaterThanEqualsFilter,
  LessThanEqualsFilter: LessThanEqualsFilter,
  NotFilter: NotFilter,
  OrFilter: OrFilter,
  PresenceFilter: PresenceFilter,
  SubstringFilter: SubstringFilter
}

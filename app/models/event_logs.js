"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
;

const dbName = "saas_big_" + coreConstants.SUB_ENVIRONMENT + "_" + coreConstants.ENVIRONMENT
  , QueryDBObj = new QueryDBKlass(dbName)
;

const EventLogKlass = function () {
  ModelBaseKlass.call(this, {dbName: dbName});
};

EventLogKlass.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const EventLogKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'event_logs',

  enums: {}
};

Object.assign(EventLogKlass.prototype, EventLogKlassPrototype);

module.exports = EventLogKlass;
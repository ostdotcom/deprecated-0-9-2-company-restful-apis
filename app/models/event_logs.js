"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
;

const dbName = "saas_big_" + coreConstants.SUB_ENVIRONMENT + "_" + coreConstants.ENVIRONMENT
;

const EventLogModel = function () {
  ModelBaseKlass.call(this, {dbName: dbName});
};

EventLogModel.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const EventLogModelSpecificPrototype = {
  tableName: 'event_logs',

  enums: {}
};

Object.assign(EventLogModel.prototype, EventLogModelSpecificPrototype);

module.exports = EventLogModel;
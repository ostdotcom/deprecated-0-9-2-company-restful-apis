"use strict";

const rootPrefix = '../..'
    , coreConstants = require(rootPrefix + '/config/core_constants')
    , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
    , util = require(rootPrefix + '/lib/util')
    , systemServiceStatusesConst = require(rootPrefix + '/lib/global_constant/system_service_statuses')
    , ModelBaseKlass = require(rootPrefix + '/app/models/base')
;

const dbName = "company_saas_shared_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
    , QueryDBObj = new QueryDBKlass(dbName)
    , statuses = {
      '1':systemServiceStatusesConst.runningStatus,
      '2':systemServiceStatusesConst.downStatus,
    }
    , invertedStatuses = util.invert(statuses)
    , names = {
      '1':systemServiceStatusesConst.saasApiName,
      '2':systemServiceStatusesConst.companyApiName,
    }
    , invertedNames = util.invert(names)
;

const SystemServiceStatusesKlass = function () {
  ModelBaseKlass.call(this, {dbName: dbName});
};

SystemServiceStatusesKlass.prototype = Object.create(ModelBaseKlass.prototype);

const SystemServiceStatusesKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'system_service_statuses',

  enums: {
    'status': {
      val: statuses,
      inverted: invertedStatuses
    },
    'name': {
      val: names,
      inverted: invertedNames
    }
  },

  getAll: function () {
    var oThis = this;
    return oThis.QueryDB.read(
        oThis.tableName,
        [],
        '',
        []
    );
  }

};

Object.assign(SystemServiceStatusesKlass.prototype, SystemServiceStatusesKlassPrototype);

module.exports = SystemServiceStatusesKlass;
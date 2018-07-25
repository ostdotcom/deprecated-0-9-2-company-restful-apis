'use strict';

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  util = require(rootPrefix + '/lib/util'),
  systemServiceStatusesConst = require(rootPrefix + '/lib/global_constant/system_service_statuses'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base');

const dbName = 'company_saas_shared_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT,
  statuses = {
    '1': systemServiceStatusesConst.runningStatus,
    '2': systemServiceStatusesConst.downStatus
  },
  invertedStatuses = util.invert(statuses),
  names = {
    '1': systemServiceStatusesConst.saasApiName,
    '2': systemServiceStatusesConst.companyApiName
  },
  invertedNames = util.invert(names);

const SystemServiceStatusesModel = function() {
  ModelBaseKlass.call(this, { dbName: dbName });
};

SystemServiceStatusesModel.prototype = Object.create(ModelBaseKlass.prototype);

const SystemServiceStatusesKlassPrototype = {
  tableName: 'system_service_statuses',

  enums: {
    status: {
      val: statuses,
      inverted: invertedStatuses
    },
    name: {
      val: names,
      inverted: invertedNames
    }
  }
};

Object.assign(SystemServiceStatusesModel.prototype, SystemServiceStatusesKlassPrototype);

module.exports = SystemServiceStatusesModel;

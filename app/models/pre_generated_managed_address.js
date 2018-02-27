"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , util = require(rootPrefix + '/lib/util')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
  , preGeneratedManagedAddressConst = require(rootPrefix + '/lib/global_constant/pre_generated_managed_address')
;

const dbName = "saas_big_" + coreConstants.SUB_ENVIRONMENT + "_" + coreConstants.ENVIRONMENT
  , QueryDBObj = new QueryDBKlass(dbName)
  , statuses = {'0': preGeneratedManagedAddressConst.unusedStatus, '1': preGeneratedManagedAddressConst.usedStatus}
  , invertedStatuses = util.invert(statuses)
;

const PreGeneratedManagedAddressKlass = function () {
};

PreGeneratedManagedAddressKlass.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const PreGeneratedManagedAddressKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'pre_generated_managed_addresses',

  statuses: statuses,

  invertedStatuses: invertedStatuses,

  enums: {
    'status': {
      val: statuses,
      inverted: invertedStatuses
    }
  },

  getUnusedAddressCount: async function () {
    console.log("==============");
    const oThis = this;
    const result = await oThis.QueryDB.read(
      oThis.tableName,
      ["count(*) as total_unused"],
      'status=?',
      [oThis.invertedStatuses[preGeneratedManagedAddressConst.unusedStatus]]
    );

    return Promise.resolve(result[0].total_unused);
  },

  findById: function (id) {
    var oThis = this;
    return oThis.QueryDB.read(oThis.tableName, [], 'id=?', [id]);
  },

  getUnusedAddresses: async function(count){
    const oThis = this;

    var hrTime = process.hrtime(),
      currentTime = (hrTime[0] * 1000000 + hrTime[1] / 1000);

    await oThis.QueryDB.edit(
      oThis.tableName,
      ['lock_identifier = ?, status = ?'],
      [currentTime, oThis.invertedStatuses[preGeneratedManagedAddressConst.usedStatus]],
      ['status = ? AND lock_identifier IS NULL limit ?'],
      [oThis.invertedStatuses[preGeneratedManagedAddressConst.unusedStatus], count]
    );
    return oThis.QueryDB.read(
      oThis.tableName,
      [],
      'lock_identifier=?',
      [currentTime]
    );
  }

};

Object.assign(PreGeneratedManagedAddressKlass.prototype, PreGeneratedManagedAddressKlassPrototype);

module.exports = PreGeneratedManagedAddressKlass;
"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , util = require(rootPrefix + '/lib/util')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , bitWiseHelperKlass = require(rootPrefix + '/helpers/bitwise_operations')
;

const dbName = "saas_client_economy_" + coreConstants.SUB_ENVIRONMENT + "_" + coreConstants.ENVIRONMENT
  , QueryDBObj = new QueryDBKlass(dbName)
  , statuses = {'1': managedAddressesConst.activeStatus, '2': managedAddressesConst.inactiveStatus}
  , invertedStatuses = util.invert(statuses)
  , addressTypes = {
    '1': managedAddressesConst.userAddressType,
    '2': managedAddressesConst.reserveAddressType,
    '3': managedAddressesConst.workerAddressType,
    '4': managedAddressesConst.airdropHolderAddressType
  }
  , invertedAddressTypes = util.invert(addressTypes)
  , invertedProperties = {
    1: managedAddressesConst.airdropGrantProperty
  }
  , properties = util.invert(invertedProperties)
;

const ManagedAddressKlass = function () {
  const oThis = this;

  bitWiseHelperKlass.call(this);
  ModelBaseKlass.call(this, {dbName: dbName});
};

ManagedAddressKlass.prototype = Object.create(ModelBaseKlass.prototype);
Object.assign(ManagedAddressKlass.prototype, bitWiseHelperKlass.prototype);

//Object.assign(ManagedAddressKlass.prototype, Object.create(ModelBaseKlass.prototype));
//const ModelBaseKlassPrototype = Object.create(ModelBaseKlass.prototype);

const ManagedAddressKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'managed_addresses',

  statuses: statuses,

  invertedStatuses: invertedStatuses,

  addressTypes: addressTypes,

  invertedAddressTypes: invertedAddressTypes,

  properties: properties,

  enums: {
    'status': {
      val: statuses,
      inverted: invertedStatuses
    },
    'address_type': {
      val: addressTypes,
      inverted: invertedAddressTypes
    }
  },

  getByEthAddresses: function (ethAddresses) {
    var oThis = this;
    return oThis.QueryDB.readByInQuery(
      oThis.tableName,
      ['client_id', 'uuid', 'name', 'ethereum_address'],
      ethAddresses, 'ethereum_address');
  },

  getByIds: function (ids) {
    var oThis = this;
    return oThis.QueryDB.readByInQuery(
      oThis.tableName,
      ['id', 'uuid', 'ethereum_address', 'properties', 'passphrase'],
      ids, 'id');
  },

  getActiveUsersByLimitAndOffset: function (params) {
    const oThis = this
      , clientId = params.client_id
      , propertyBitVal =  params.property_set_bit_value
      , options = {limit: params.limit, offset: params.offset, order: "id asc"}
    ;

  var valueFields = [clientId, managedAddressesConst.activeStatus, managedAddressesConst.userAddressType]
    , propertiesWhereClause = ''
    ;
    if (propertyBitVal) {
      propertiesWhereClause = ' AND (properties & ?) = ?';
      valueFields = valueFields.concat([propertyBitVal, propertyBitVal]);
    }

    return oThis.QueryDB.read(
      oThis.tableName,
      ['id'],
      'client_id = ? AND status=? AND address_type=?' + propertiesWhereClause,
      valueFields,
      options
    );
  },

  getActiveUsersCount: function (params) {
    const oThis = this
      , clientId = params.client_id
      , propertyBitVal =  params.property_set_bit_value
    ;

    var propertiesWhereClause = '',
      valueFields = [clientId, oThis.invertedStatuses[managedAddressesConst.activeStatus],
        oThis.invertedAddressTypes[managedAddressesConst.userAddressType]];
    if (propertyBitVal) {
      propertiesWhereClause += ' AND (properties & ?) = ?';
      valueFields = valueFields.concat([propertyBitVal, 0]);
    }

    return oThis.QueryDB.read(
      oThis.tableName,
      ['count(1) as total_count'],
      'client_id = ? AND status=? AND address_type=?' + propertiesWhereClause,
      valueFields
    );
  },

  getByFilterAndPaginationParams: function (params) {

    const oThis = this
      , clientId = params.client_id
      , sortBy = params.sort_by
    ;

    var pageNo = params.page_no
      , orderBy = ''
      , paginationClause = '';

    if (!pageNo) {
      pageNo = 1;
    } else {
      pageNo = parseInt(pageNo);
    }

    if (sortBy == 'creation_time') {
      orderBy = 'id DESC';
    } else {
      orderBy = 'id ASC'
    }

    //paginationClause = `limit ${params.pageSize} offset ${params.pageSize * (pageNo - 1)}`;

    return oThis.QueryDB.read(
      oThis.tableName,
      ['id', 'name', 'uuid'],
      'client_id = ?',
      [clientId],
      {
        order: orderBy,
        limit: params.pageSize,
        offset: params.pageSize * (pageNo - 1)
      }
    );

  },

  getByUuids: function (uuids) {
    var oThis = this;
    return oThis.QueryDB.readByInQuery(
      oThis.tableName,
      ['id', 'client_id', 'uuid', 'name', 'ethereum_address', 'passphrase', 'status', 'properties'],
      uuids, 'uuid');
  },

  /**
   * Set all BitWise columns as hash
   * key would be column name and value would be hash of all bitwise values
   *
   * @return {{}}
   */
  setBitColumns: function () {
    const oThis = this;

    oThis.bitColumns = {'properties': properties};

    return oThis.bitColumns;
  }

};


Object.assign(
  ManagedAddressKlass.prototype,
  ManagedAddressKlassPrototype
);

module.exports = ManagedAddressKlass;
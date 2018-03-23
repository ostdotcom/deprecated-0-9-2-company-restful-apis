"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , util = require(rootPrefix + '/lib/util')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop')
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
    '4': managedAddressesConst.airdropHolderAddressType,
    '5': managedAddressesConst.internalChainIndenpendentAddressType
  }
  , invertedAddressTypes = util.invert(addressTypes)
  , properties = {
    1: managedAddressesConst.airdropGrantProperty,
    2: managedAddressesConst.bTContractApproved
  }
  , invertedProperties = util.invert(properties)
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

  invertedProperties: invertedProperties,

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

  getByEthAddressesSecure: function (ethAddresses) {
    var oThis = this;
    return oThis.QueryDB.readByInQuery(
        oThis.tableName,
        ['ethereum_address', 'managed_address_salt_id', 'private_key'],
        ethAddresses, 'ethereum_address');
  },

  getByIds: function (ids) {
    var oThis = this;
    return oThis.QueryDB.readByInQuery(
      oThis.tableName,
      ['id', 'uuid', 'address_type', 'ethereum_address', 'properties'],
      ids, 'id');
  },

  getFilteredActiveUsersByLimitAndOffset: function (params) {
    const oThis = this
      , clientId = params.client_id
      , propertyUnsetBitVal =  params.property_unset_bit_value
      , options = {limit: params.limit, offset: params.offset, order: "id asc"}
    ;

    var valueFields = [clientId, invertedStatuses[managedAddressesConst.activeStatus], invertedAddressTypes[managedAddressesConst.userAddressType]]
      , propertiesWhereClause = ''
    ;

    if (propertyUnsetBitVal) {
      propertiesWhereClause = ' AND (properties & ?) = 0'
        , valueFields = valueFields.concat([propertyUnsetBitVal])
      ;
    }

    return oThis.QueryDB.read(
      oThis.tableName,
      ['id'],
      'client_id = ? AND status=? AND address_type=?' + propertiesWhereClause,
      valueFields,
      options
    );
  },

  getFilteredActiveUsersCount: function (params) {
    const oThis = this
      , clientId = params.client_id
      , propertyUnsetBitVal =  params.property_unset_bit_value
    ;

    var valueFields = [clientId, invertedStatuses[managedAddressesConst.activeStatus], invertedAddressTypes[managedAddressesConst.userAddressType]]
      , propertiesWhereClause = ''
    ;

    if (propertyUnsetBitVal) {
      propertiesWhereClause = ' AND (properties & ?) = 0'
        , valueFields = valueFields.concat([propertyUnsetBitVal])
      ;
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
      , orderBy = params.order_by
      , orderType = params.order
      , filter = params.filter
    ;

    var pageNo = params.page_no
      , orderByStr = ''
      , paginationClause = '';

    if (!pageNo) {
      pageNo = 1;
    } else {
      pageNo = parseInt(pageNo);
    }

    if (orderBy.toLowerCase() == 'name') {
      orderByStr = 'name';
    } else {
      orderByStr = 'id';
    }

    if (orderType.toLowerCase() == 'asc'){
      orderByStr += ' ASC';
    }else{
      orderByStr += ' DESC';
    }

    var whereClause = 'client_id = ?'
      , whereValues = [clientId];

    if(filter == clientAirdropConst.neverAirdroppedAddressesAirdropListType){
      whereClause += ' AND (properties & ?) = 0';
      whereValues.push(invertedProperties[managedAddressesConst.airdropGrantProperty])
    }

    return oThis.QueryDB.read(
      oThis.tableName,
      ['id', 'name', 'uuid', 'ethereum_address'],
      whereClause,
      whereValues,
      {
        order: orderByStr,
        limit: params.limit,
        offset: params.offset
      }
    );

  },

  getByUuids: function (uuids) {
    var oThis = this;
    return oThis.QueryDB.readByInQuery(
      oThis.tableName,
      ['id', 'client_id', 'uuid', 'name', 'ethereum_address',
        'status', 'properties', 'address_type'],
      uuids, 'uuid');
  },

  getRandomActiveUsers: async function(clientId, numberOfRandomUsers, totalUsers){
    const oThis = this;

    var valueFields = [clientId, invertedStatuses[managedAddressesConst.activeStatus],
      invertedAddressTypes[managedAddressesConst.userAddressType]]
    ;

    var offset = (totalUsers - numberOfRandomUsers + 1);
    offset = ((offset > 0) ? (Math.floor(Math.random() * offset)) : 0);
    return oThis.QueryDB.read(
      oThis.tableName,
      ['id', 'client_id', 'uuid', 'ethereum_address'],
      'client_id = ? AND status=? AND address_type=?',
      valueFields,
      {
        limit: numberOfRandomUsers,
        offset: offset
      }
    );
  },

  /**
   * Set all BitWise columns as hash
   * key would be column name and value would be hash of all bitwise values
   *
   * @return {{}}
   */
  setBitColumns: function () {
    const oThis = this;

    oThis.bitColumns = {'properties': invertedProperties};

    return oThis.bitColumns;
  }

};


Object.assign(
  ManagedAddressKlass.prototype,
  ManagedAddressKlassPrototype
);

module.exports = ManagedAddressKlass;
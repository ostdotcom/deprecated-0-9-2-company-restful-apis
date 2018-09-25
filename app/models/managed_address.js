'use strict';

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  util = require(rootPrefix + '/lib/util'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses'),
  bitWiseHelperKlass = require(rootPrefix + '/helpers/bitwise_operations'),
  commonValidator = require(rootPrefix + '/lib/validators/common');

const dbName = 'saas_client_economy_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT,
  statuses = { '1': managedAddressesConst.activeStatus, '2': managedAddressesConst.inactiveStatus },
  invertedStatuses = util.invert(statuses),
  addressTypes = {
    '1': managedAddressesConst.userAddressType,
    '2': managedAddressesConst.reserveAddressType,
    '3': managedAddressesConst.workerAddressType,
    '4': managedAddressesConst.airdropHolderAddressType,
    '5': managedAddressesConst.internalChainIndenpendentAddressType
  },
  invertedAddressTypes = util.invert(addressTypes),
  properties = {
    1: managedAddressesConst.airdropGrantProperty,
    2: managedAddressesConst.bTContractApproved
  },
  invertedProperties = util.invert(properties);

const ManagedAddressModel = function() {
  const oThis = this;

  bitWiseHelperKlass.call(this);
  ModelBaseKlass.call(this, { dbName: dbName });
};

ManagedAddressModel.prototype = Object.create(ModelBaseKlass.prototype);
Object.assign(ManagedAddressModel.prototype, bitWiseHelperKlass.prototype);

const ManagedAddressKlassPrototype = {
  tableName: 'managed_addresses',

  statuses: statuses,

  invertedStatuses: invertedStatuses,

  addressTypes: addressTypes,

  invertedAddressTypes: invertedAddressTypes,

  properties: properties,

  invertedProperties: invertedProperties,

  enums: {
    status: {
      val: statuses,
      inverted: invertedStatuses
    },
    address_type: {
      val: addressTypes,
      inverted: invertedAddressTypes
    }
  },

  getByEthAddresses: function(ethAddresses) {
    const oThis = this;

    return oThis
      .select(['client_id', 'uuid', 'name', 'ethereum_address'])
      .where(['ethereum_address IN (?)', ethAddresses])
      .fire();
  },

  getByEthAddressesSecure: function(ethAddresses) {
    const oThis = this;

    return oThis
      .select(['ethereum_address', 'managed_address_salt_id', 'private_key', 'client_id'])
      .where(['ethereum_address IN (?)', ethAddresses])
      .fire();
  },

  getByIds: function(ids) {
    const oThis = this;

    return oThis
      .select('*')
      .where(['id IN (?)', ids])
      .fire();
  },

  getFilteredActiveUsersByLimitAndOffset: function(params) {
    const oThis = this,
      clientId = params.client_id,
      propertyUnsetBitVal = params.property_unset_bit_value,
      propertySetBitVal = params.property_set_bit_value,
      uuids = params.uuids,
      addressTypeInt = invertedAddressTypes[managedAddressesConst.userAddressType],
      statusInt = invertedStatuses[managedAddressesConst.activeStatus];

    let query = oThis.select(['id']).where({ client_id: clientId, status: statusInt, address_type: addressTypeInt });

    if (uuids) {
      query.where(['uuid in (?)', uuids]);
    }

    if (propertyUnsetBitVal) {
      query.where(['(properties & ?) = 0', propertyUnsetBitVal]);
    } else if (propertySetBitVal) {
      oThis.where(['(properties & ?) > 0', propertySetBitVal]);
    }

    return query
      .limit(params.limit)
      .offset(params.offset)
      .order_by('id ASC')
      .fire();
  },

  getFilteredActiveUsersCount: async function(params) {
    const oThis = this,
      clientId = params.client_id,
      propertyUnsetBitVal = params.property_unset_bit_value,
      propertySetBitVal = params.property_set_bit_value,
      uuids = params.uuids;

    oThis.select('count(1) as total_count').where({
      client_id: clientId,
      status: invertedStatuses[managedAddressesConst.activeStatus],
      address_type: invertedAddressTypes[managedAddressesConst.userAddressType]
    });

    if (uuids) {
      oThis.where(['uuid in (?)', uuids]);
    }

    if (propertyUnsetBitVal) {
      oThis.where(['(properties & ?) = 0', propertyUnsetBitVal]);
    } else if (propertySetBitVal) {
      oThis.where(['(properties & ?) > 0', propertySetBitVal]);
    }

    return oThis.fire();
  },

  /**
   *
   * Get List by params
   *
   * @param {object} params - this is object with keys.
   * @param {integer} params.client_id - client_id for which users are to be fetched
   * @param {boolean} [params.airdropped] - true / false to filter on users who have (or not) been airdropped
   * @param {string} [params.order_by] - ordereing of results to be done by this column
   * @param {string} [params.order] - ASC / DESC
   * @param {string} [params.limit] - number of results to be returned on this page
   * @param {string} [params.offset] - index to start fetching entries from
   * @param {array} [params.uuids] - index to start fetching entries from
   *
   */
  getByFilterAndPaginationParams: function(params) {
    const oThis = this,
      clientId = params.client_id,
      orderBy = params.order_by,
      orderType = params.order,
      uuidsForFiltering = params.uuids || [];

    let query = oThis.select(['id', 'name', 'uuid', 'ethereum_address']).where({
      client_id: clientId,
      address_type: invertedAddressTypes[managedAddressesConst.userAddressType]
    });

    if (uuidsForFiltering.length > 0) {
      query.where(['uuid IN (?)', uuidsForFiltering]);
    }

    if (!commonValidator.isVarNull(params.airdropped)) {
      if (commonValidator.isVarTrue(params.airdropped)) {
        // filter for those who were airdropped
        query.where(['(properties & ?) > 0', invertedProperties[managedAddressesConst.airdropGrantProperty]]);
      } else if (commonValidator.isVarFalse(params.airdropped)) {
        // filter for those who were never airdropped
        query.where(['(properties & ?) = 0', invertedProperties[managedAddressesConst.airdropGrantProperty]]);
      }
    }

    let orderByStr = orderBy.toLowerCase() == 'name' ? 'name' : 'id';
    orderByStr += orderType.toLowerCase() == 'asc' ? ' ASC' : ' DESC';

    return query
      .order_by(orderByStr)
      .limit(params.limit)
      .offset(params.offset)
      .fire();
  },

  getByUuids: function(uuids) {
    const oThis = this;

    return oThis
      .select(['id', 'client_id', 'uuid', 'name', 'ethereum_address', 'status', 'properties', 'address_type'])
      .where(['uuid IN (?)', uuids])
      .fire();
  },

  getUuidById: function(ids) {
    const oThis = this;

    return oThis
      .select(['id', 'uuid'])
      .where(['id IN (?)', ids])
      .fire();
  },

  getRandomActiveUsers: async function(clientId, numberOfRandomUsers, totalUsers) {
    const oThis = this,
      activeStatusInt = invertedStatuses[managedAddressesConst.activeStatus],
      userAddressTypeInt = invertedAddressTypes[managedAddressesConst.userAddressType];

    let offset = totalUsers - numberOfRandomUsers + 1;
    offset = offset > 0 ? Math.floor(Math.random() * offset) : 0;

    return oThis
      .select(['id', 'client_id', 'uuid', 'ethereum_address'])
      .where({ client_id: clientId, status: activeStatusInt, address_type: userAddressTypeInt })
      .limit(numberOfRandomUsers)
      .offset(offset)
      .fire();
  },

  /**
   * Set all BitWise columns as hash
   * key would be column name and value would be hash of all bitwise values
   *
   * @return {{}}
   */
  setBitColumns: function() {
    const oThis = this;

    oThis.bitColumns = { properties: invertedProperties };

    return oThis.bitColumns;
  }
};

Object.assign(ManagedAddressModel.prototype, ManagedAddressKlassPrototype);

module.exports = ManagedAddressModel;

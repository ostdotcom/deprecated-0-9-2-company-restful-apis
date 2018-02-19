"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , localCipher = require(rootPrefix + '/lib/encryptors/local_cipher')
  , util = require(rootPrefix + '/lib/util')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

const dbName = "saas_client_economy_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
  , QueryDBObj = new QueryDBKlass(dbName)
  , statuses = {'1':'active', '2':'inactive'}
  , invertedStatuses = util.invert(statuses)
;

const ManagedAddressKlass = function () {};

ManagedAddressKlass.prototype = Object.create(ModelBaseKlass.prototype);

const ManagedAddressKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'managed_addresses',

  statuses: statuses,

  invertedStatuses: invertedStatuses,

  enums: {
    'status': {
      val: statuses,
      inverted: invertedStatuses
    }
  },

  getByEthAddress: function (ethAddress) {
    var oThis = this;
    return oThis.QueryDB.read(
      oThis.tableName,
      [],
      'ethereum_address=?',
      [ethAddress]);
  },

  getByIds: function (ids) {
    var oThis = this;
    return oThis.QueryDB.readByIds(
      oThis.tableName,
      ['id', 'ethereum_address'],
      ids);
  },

  getByUuid: function (uuid) {
    var oThis = this;
    return oThis.QueryDB.read(
        oThis.tableName,
        ['client_id', 'name','ethereum_address', 'passphrase', 'status'],
        'uuid=?',
        [uuid]);
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
      orderBy = 'order by id DESC';
    } else {
      orderBy = 'order by id ASC'
    }

    paginationClause = `limit ${params.pageSize} offset ${params.pageSize*(pageNo - 1)}`;

    return oThis.QueryDB.read(
        oThis.tableName,
        ['id','name', 'uuid'],
        'client_id = ?',
        [clientId],
        orderBy,
        paginationClause
    );

  }

};

Object.assign(ManagedAddressKlass.prototype, ManagedAddressKlassPrototype);

module.exports = ManagedAddressKlass;
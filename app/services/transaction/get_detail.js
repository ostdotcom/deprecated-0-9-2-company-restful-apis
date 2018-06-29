"use strict";

/**
 * Get detail for transactiuons having uuids
 *
 * @param {object} params - this is object with keys.
 *                  transaction_uuids - Transaction UUIDs
 *
 * @module app/services/transaction/get_detail
 */

const OSTStorage = require('@openstfoundation/openst-storage');

const rootPrefix = '../../..'
  , ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , UserEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/user')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , ActionEntityFormatterKlass = require(rootPrefix +'/lib/formatter/entities/latest/action')
  , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
  , autoScalingServiceObj = require(rootPrefix + '/lib/auto_scaling_service')
;

const GetTransactionDetailKlass = function (params) {
  params = params || {};

  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.transactionUuids = params.transaction_uuids || [];

  oThis.response = {};
  oThis.transactionTypeMap = {};
  oThis.clientTokenMap = {};
  oThis.economyUserMap = {};
  oThis.transactionUuidToDataMap = {};

};

GetTransactionDetailKlass.prototype = {

  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: function () {
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function (error) {
        if (responseHelper.isCustomResult(error)) {
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);
          return responseHelper.error({
            internal_error_identifier: 's_t_gd_1',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
        }
      })
  },

  /**
   * Async Perform
   *
   * @return {promise<result>}
   */
  asyncPerform: async function () {
    const oThis = this
    ;

    await oThis._getTransactionData();

    await oThis._getClientTokens();

    await oThis._getTransactionTypes();

    await oThis._getEconomyUsers();

    oThis.response.result_type = "transactions";
    oThis.response.transactions = [];

    for (var i = 0; i < oThis.transactionUuids.length; i++) {
      var key = oThis.transactionUuids[i];
      var transactionData = oThis.transactionUuidToDataMap[key];
      if (transactionData) {
        oThis.response.transactions.push(transactionData);
      }
    }

    return Promise.resolve(responseHelper.successWithData(oThis.response))
  },

  /**
   * Fetch transaction data
   *
   * Sets chainMaps, transactionTypeMap, economyUserMap, transactionUuidToDataMap
   *
   * @return {promise}
   */
  _getTransactionData: async function () {
    const oThis = this
    ;

    if (typeof oThis.transactionUuids != (typeof [])) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_gd_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_id'],
        debug_options: {}
      }));
    }

    let transactionFetchResponse = await new OSTStorage.TransactionLogModel({
      client_id: oThis.clientId,
      ddb_service: ddbServiceObj,
      auto_scaling: autoScalingServiceObj,
    }).batchGetItem(oThis.transactionUuids);

    let transactionLogRecordsHash = transactionFetchResponse.data;

    if (!transactionLogRecordsHash || Object.keys(transactionLogRecordsHash).length == 0) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_gd_3',
        api_error_identifier: 'data_not_found',
        debug_options: {}
      }));
    }

    for (var transactionLog in transactionLogRecordsHash) {
      const transactionLogRecord = transactionLogRecordsHash[transactionLog]
      ;

      oThis.transactionTypeMap[transactionLogRecord.action_id] = {};
      oThis.clientTokenMap[transactionLogRecord.client_token_id] = {};

      oThis.economyUserMap[transactionLogRecord.from_uuid] = {};
      oThis.economyUserMap[transactionLogRecord.to_uuid] = {};

      oThis.transactionUuidToDataMap[transactionLogRecord.transaction_uuid] =  transactionLogRecord;

    }

    return Promise.resolve();
  },

  /**
   * Get client tokens
   *
   * Sets clientTokenMap, response
   *
   * @return {promise}
   */
  _getClientTokens: async function () {
    const oThis = this
      , clientTokenIds = Object.keys(oThis.clientTokenMap)
    ;

    if (!clientTokenIds || clientTokenIds.length == 0) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_gd_3',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      }));
    }

    const clientTokenRecords = await new ClientBrandedTokenModel().select('*').where(["id in (?)", clientTokenIds]).fire();

    for (var i = 0; i < clientTokenRecords.length; i++) {
      const currRecord = clientTokenRecords[i]
      ;

      oThis.clientTokenMap[currRecord.id] = {
        id: currRecord.id,
        client_id: currRecord.client_id,
        name: currRecord.name,
        symbol: currRecord.symbol,
        symbol_icon: currRecord.symbol_icon,
        conversion_factor: currRecord.conversion_factor,
        airdrop_contract_addr: currRecord.airdrop_contract_addr,
        uts: Date.now()
      };

    }

    oThis.response.client_tokens = oThis.clientTokenMap;

    return Promise.resolve()
  },

  /**
   * Get transaction types
   *
   * Sets transactionTypeMap, response
   *
   * @return {promise}
   */
  _getTransactionTypes: async function () {
    const oThis = this
      , transactionTypeIds = Object.keys(oThis.transactionTypeMap)
      , transactionTypeRecords = await new ClientTransactionTypeModel().select('*').where(["id IN (?)", transactionTypeIds]).fire()
    ;

    for (var i = 0; i < transactionTypeRecords.length; i++) {
      const currRecord = transactionTypeRecords[i]
      ;

      let actionEntityFormatter = new ActionEntityFormatterKlass(currRecord);

      let actionEntityFormatterRsp = await actionEntityFormatter.perform();

      oThis.transactionTypeMap[currRecord.id] = actionEntityFormatterRsp.data;
    }

    oThis.response.transaction_types = oThis.transactionTypeMap;

    return Promise.resolve();
  },

  /**
   * Get economy users
   *
   * Sets economyUserMap, response
   *
   * @return {promise}
   */
  _getEconomyUsers: async function () {

    const oThis = this
      , userUuids = Object.keys(oThis.economyUserMap)
      , economyUsersRecords = await new ManagedAddressModel().select('*').where(["uuid IN (?)", userUuids]).fire()
    ;

    for (var i = 0; i < economyUsersRecords.length; i++) {

      const currRecord = economyUsersRecords[i]
          , userData = {
            id: currRecord.uuid,
            uuid: currRecord.uuid,
            name: currRecord.name || '',
            address: currRecord.ethereum_address,
            kind: new ManagedAddressModel().addressTypes[currRecord.address_type],
            total_airdropped_tokens: 0,
            token_balance: 0
          }
      ;

      const userEntityFormatter = new UserEntityFormatterKlass(userData)
          , userEntityFormatterRsp = await userEntityFormatter.perform()
      ;

      oThis.economyUserMap[currRecord.uuid] = userEntityFormatterRsp.data;

    }

    oThis.response.users = oThis.economyUserMap;

    return Promise.resolve();

  }

};

module.exports = GetTransactionDetailKlass;
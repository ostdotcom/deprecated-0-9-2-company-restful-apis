"use strict";

/**
 * Get detail for transactiuons having uuids
 *
 * @param {object} params - this is object with keys.
 *                  transaction_uuids - Transaction UUIDs
 *
 * @module app/services/transaction/get_detail
 */

const rootPrefix = '../../..'
  , TransactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , ClientTransactionTypeKlass = require(rootPrefix + '/app/models/client_transaction_type')
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

const GetTransactionDetailKlass = function (params) {
  params = params || {};

  const oThis = this;

  oThis.transactionUuids = params.transaction_uuids || [];

  oThis.response = {};
  oThis.transactionTypeMap = {};
  oThis.clientTokenMap = {};
  oThis.economyUserMap = {};
  oThis.transactionUuidToDataMap = {};
  oThis.chainMaps = {};
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
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)) {
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("s_t_gd_1", "Unhandled result", null, {}, {});
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

    const transactionLogRecords = await new TransactionLogModel()
      .select('*').where(['transaction_uuid in (?)', oThis.transactionUuids]).fire();

    for (var i = 0; i < transactionLogRecords.length; i++) {
      const transactionLogRecord = transactionLogRecords[i]
        , formattedReceipt = JSON.parse(transactionLogRecord.formatted_receipt || '{}')
        , inputParams = JSON.parse(transactionLogRecord.input_params)
        , gasPriceBig = basicHelper.convertToBigNumber(inputParams.gas_price)
      ;

      oThis.chainMaps[transactionLogRecord.transaction_uuid] = new TransactionLogModel().chainTypes[transactionLogRecord.chain_type];

      oThis.transactionTypeMap[inputParams.transaction_kind_id] = {};
      oThis.clientTokenMap[transactionLogRecord.client_token_id] = {};

      oThis.economyUserMap[inputParams.from_uuid] = {};
      oThis.economyUserMap[inputParams.to_uuid] = {};

      const transactionMapObj = {
        id: transactionLogRecord.transaction_uuid,
        transaction_uuid: transactionLogRecord.transaction_uuid,
        from_user_id: inputParams.from_uuid,
        to_user_id: inputParams.to_uuid,
        transaction_type_id: inputParams.transaction_kind_id,
        client_token_id: transactionLogRecord.client_token_id,
        transaction_hash: transactionLogRecord.transaction_hash,
        status: new TransactionLogModel().statuses[transactionLogRecord.status],
        gas_price: inputParams.gas_price,
        transaction_timestamp: Math.floor(new Date(transactionLogRecord.created_at).getTime() / 1000),
        uts: Date.now()
      };

      if (formattedReceipt.gas_used) {
        const gasUsedBig = basicHelper.convertToBigNumber(formattedReceipt.gas_used)
          , gasValue = gasUsedBig.mul(gasPriceBig)
        ;

        transactionMapObj.gas_used = gasUsedBig.toString(10);
        transactionMapObj.transaction_fee = basicHelper.convertToNormal(gasValue).toString(10);
        transactionMapObj.block_number = formattedReceipt.block_number;
        transactionMapObj.bt_transfer_value = basicHelper.convertToNormal(formattedReceipt.bt_transfer_in_wei);
        transactionMapObj.bt_commission_amount = basicHelper.convertToNormal(formattedReceipt.commission_amount_in_wei);
      }

      oThis.transactionUuidToDataMap[transactionLogRecord.transaction_uuid] = transactionMapObj;
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
      , clientTokensObj = new ClientBrandedTokenKlass()
      , clientTokenIds = Object.keys(oThis.clientTokenMap)
    ;

    if(!clientTokenIds || clientTokenIds.length == 0){
      return Promise.reject(responseHelper.error('s_t_gd_2', 'tokens not found for given input', null, [],
        {sendErrorEmail: false}));
    }
    const clientTokenRecords = await clientTokensObj.select('*').where(["id in (?)", clientTokenIds]).fire();

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
      , transactionTypesObj = new ClientTransactionTypeKlass()
      , transactionTypeIds = Object.keys(oThis.transactionTypeMap)
      , transactionTypeRecords = await transactionTypesObj.select('*').where(["id in (?)", transactionTypeIds]).fire()
    ;

    for (var i = 0; i < transactionTypeRecords.length; i++) {
      const currRecord = transactionTypeRecords[i]
      ;

      oThis.transactionTypeMap[currRecord.id] = {
        id: currRecord.id,
        name: currRecord.name || '',
        kind: transactionTypesObj.kinds[currRecord.kind],
        currency_type: transactionTypesObj.currencyTypes[currRecord.currency_type],
        currency_value: transactionTypesObj.getValue(currRecord),
        commission_percent: currRecord.commission_percent,
        status: transactionTypesObj.statuses[currRecord.status],
        uts: Date.now()
      };
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
      , managedAddressObj = new ManagedAddressKlass()
      , userUuids = Object.keys(oThis.economyUserMap)
      , economyUsersRecords = await managedAddressObj.select('*').where(["uuid in (?)", userUuids]).fire()
    ;

    for (var i = 0; i < economyUsersRecords.length; i++) {
      const currRecord = economyUsersRecords[i]
      ;

      oThis.economyUserMap[currRecord.uuid] = {
        id: currRecord.uuid,
        uuid: currRecord.uuid,
        name: currRecord.name || '',
        kind: managedAddressObj.addressTypes[currRecord.address_type],
        uts: Date.now()
      };
    }

    oThis.response.economy_users = oThis.economyUserMap;

    return Promise.resolve();
  }
};

module.exports = GetTransactionDetailKlass;
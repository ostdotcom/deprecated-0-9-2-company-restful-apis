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
  , GetReceiptKlass = require(rootPrefix + '/app/services/transaction/get_receipt')
  , transactionLogKlass = require(rootPrefix + '/app/models/transaction_log')
  , ClientTransactionTypeKlass = require(rootPrefix + '/app/models/client_transaction_type')
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , basicHelper = require(rootPrefix + '/helpers/basic')
;

const GetTransactionDetailKlass = function (params) {
  const oThis = this;

  oThis.transactionUuids = params.transaction_uuids;

  oThis.response = {};
  oThis.transactionUuidToHashMap = {};
  oThis.transactionHashToUuidMap = {};
  oThis.transactionHashToReceiptMap = {};
  oThis.transactionTypeMap = {};
  oThis.clientTokenMap = {};
  oThis.economyUserMap = {};
  oThis.transactionMap = {};
  oThis.chainMaps = {};
};

GetTransactionDetailKlass.prototype = {
  perform: async function () {
    const oThis = this;

    await oThis._getTransactionHashes();

    await oThis._getClientTokens();

    await oThis._getTransactionReceipts();

    await oThis._getTransactionTypes();
    
    await oThis._getEconomyUsers();

    oThis.response.result_type = "transactions";
    oThis.response.transactions = [];
    for(var key in oThis.transactionMap){
      var transactionData = oThis.transactionMap[key];
      oThis.response.transactions.push(transactionData);
    }

    return Promise.resolve(responseHelper.successWithData(oThis.response))
  },

  _getTransactionHashes: async function () {
    const oThis = this;

    const transactionLogObj = new transactionLogKlass()
    ;

    const transactionLogRecords = await transactionLogObj.select(
      'transaction_hash, transaction_uuid, input_params, client_token_id, status, chain_type, created_at').where(
      ['transaction_uuid in (?)', oThis.transactionUuids]).fire();

    for (var i = 0; i < transactionLogRecords.length; i++) {
      const currRecord = transactionLogRecords[i];
      oThis.transactionUuidToHashMap[currRecord.transaction_uuid] = currRecord.transaction_hash;
      oThis.transactionHashToUuidMap[currRecord.transaction_hash] = currRecord.transaction_uuid;
      oThis.chainMaps[currRecord.transaction_uuid] = transactionLogObj.chainTypes[currRecord.chain_type];

      const inputParams = JSON.parse(currRecord.input_params);
      oThis.transactionTypeMap[inputParams.transaction_kind_id] = {};
      oThis.clientTokenMap[currRecord.client_token_id] = {};

      oThis.economyUserMap[inputParams.from_uuid] = {};
      oThis.economyUserMap[inputParams.to_uuid] = {};

      oThis.transactionMap[currRecord.transaction_uuid] = {
        id: currRecord.transaction_uuid,
        transaction_uuid: currRecord.transaction_uuid,
        from_user_id: inputParams.from_uuid,
        to_user_id: inputParams.to_uuid,
        transaction_type_id: inputParams.transaction_kind_id,
        client_token_id: currRecord.client_token_id,
        transaction_hash: currRecord.transaction_hash,
        status: transactionLogObj.statuses[currRecord.status],
        gas_price: inputParams.gas_price,
        transaction_timestamp: Math.floor(new Date(currRecord.created_at).getTime()/1000),
        uts: Date.now()
      };
    }

    return Promise.resolve();
  },

  _getClientTokens: async function () {
    const oThis = this
      , clientTokensObj = new ClientBrandedTokenKlass()
      , clientTokenIds = Object.keys(oThis.clientTokenMap)
      , clientTokenRecords = await clientTokensObj.select('*').where(["id in (?)", clientTokenIds]).fire()
    ;

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

    return Promise.resolve(responseHelper.successWithData({}))
  },

  _getTransactionReceipts: async function () {
    const oThis = this
      , promiseArray = [];

    for (var uuid in oThis.transactionUuidToHashMap) {
      if(!oThis.transactionUuidToHashMap[uuid]){
        continue;
      }
      const transactionHash = oThis.transactionUuidToHashMap[uuid]
        , clientTokenId = oThis.transactionMap[uuid].client_token_id
        , clientToken = oThis.clientTokenMap[clientTokenId]
        , addressToNameMap = {}
      ;

      addressToNameMap[clientToken.airdrop_contract_addr.toLowerCase()] = 'airdrop';
      console.log(addressToNameMap)
      const getReceiptObj = new GetReceiptKlass(
          {
            transaction_hash: transactionHash,
            chain: oThis.chainMaps[uuid],
            address_to_name_map: addressToNameMap
          });

      promiseArray.push(getReceiptObj.perform());
    }

    const promiseResults = await Promise.all(promiseArray);

    for (var i = 0; i < promiseResults.length; i++) {
      const transactionReceiptResponse = promiseResults[i]
        , data = transactionReceiptResponse.data;
      if (transactionReceiptResponse.isFailure()) continue;

      const uuid = oThis.transactionHashToUuidMap[data.rawTransactionReceipt.transactionHash]
        , gasPriceBig = basicHelper.convertToBigNumber(oThis.transactionMap[uuid].gas_price)
        , gasUsedBig = basicHelper.convertToBigNumber(data.rawTransactionReceipt.gasUsed)
        , gasValue = gasUsedBig.mul(gasPriceBig)
      ;

      oThis.transactionMap[uuid].gas_used = gasUsedBig.toString(10);
      oThis.transactionMap[uuid].transaction_fee = basicHelper.convertToNormal(gasValue).toString(10);
      oThis.transactionMap[uuid].block_number = data.rawTransactionReceipt.blockNumber;

      if(data.formattedTransactionReceipt.eventsData.length > 0){
        var ed = data.formattedTransactionReceipt.eventsData[0].events;
        for(var j=0;j<ed.length;j++){
          var ev = ed[j];
          if(ev.name === "_tokenAmount" && ev.type === "uint256"){
            oThis.transactionMap[uuid].bt_transfer_value = basicHelper.convertToNormal(ev.value).toString(10);
          }
          if(ev.name === "_commissionTokenAmount" && ev.type === "uint256"){
            oThis.transactionMap[uuid].bt_commission_amount = basicHelper.convertToNormal(ev.value).toString(10);
          }
        }
      }

      oThis.transactionHashToReceiptMap[data.rawTransactionReceipt.transactionHash] = data;

    }

    // oThis.response.transactionMap = oThis.transactionMap;

    return Promise.resolve();
  },

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

    return Promise.resolve(responseHelper.successWithData({}))
  },

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
  }
};

module.exports = GetTransactionDetailKlass;
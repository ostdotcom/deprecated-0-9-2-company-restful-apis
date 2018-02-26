"use strict";

/**
 * Service to Execute transaction.
 *
 * @module app/services/transaction/execute_transaction
 */
const rootPrefix = '../../..'
  , uuid = require("uuid")
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , clientTransactionTypeCacheKlass = require(rootPrefix + '/lib/cache_management/client_transaction_type')
  , clientTransactionTypeConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , BTSecureCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , transactionLogKlass = require(rootPrefix + '/app/models/transaction_log')
  , transactionLogObj = new transactionLogKlass()
  ;

/**
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id who is performing a transaction.
 * @param {string} params.token_symbol - Token symbol whose transaction would be executed.
 * @param {String} params.from_uuid - UUID of from user's address.
 * @param {String} params.to_uuid - UUID of to user's address.
 * @param {String} params.transaction_kind - Transaction kind to perform on user addresses.
 *
 */
const ExecuteTransactionKlass = function (params){
  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.tokenSymbol = params.token_symbol;
  oThis.fromUuid = params.from_uuid;
  oThis.toUuid = params.to_uuid;
  oThis.transactionKind = params.transaction_kind;
  oThis.transactionTypeRecord = null;
  oThis.userRecords = null;
  oThis.transactionHash = null;
  oThis.transactionUuid = null;
  oThis.clientBrandedToken = null;
};

ExecuteTransactionKlass.prototype = {

  perform: async function(){
    const oThis = this;

    var r1 = await oThis.validateClientToken();
    if(r1.isFailure()){
      return Promise.resolve(r1);
    }

    var r2 = await oThis.validateTransactionKind();
    if(r2.isFailure()){
      return Promise.resolve(r2);
    }

    var r3 = await oThis.validateUsers();
    if(r3.isFailure()){
      return Promise.resolve(r3);
    }

    oThis.createTransactionLog();

    return Promise.resolve(responseHelper.successWithData(
      {transaction_uuid: oThis.transactionUuid, transaction_hash: oThis.transactionHash}))
  },

  /**
   * Validate Users
   *
   * @Sets userRecords
   * @return {Promise<ResultBase>}
   */
  validateUsers: async function(){
    const oThis = this;

    if(!oThis.fromUuid || !oThis.toUuid || oThis.fromUuid == oThis.toUuid){
      return Promise.resolve(responseHelper.error("s_t_et_8", "Invalid users."));
    }

    const managedAddressCache = new ManagedAddressCacheKlass({'uuids': [oThis.fromUuid, oThis.toUuid]});

    const cacheFetchResponse = await managedAddressCache.fetchDecryptedData(['passphrase']);

    if (cacheFetchResponse.isFailure()) {
      return Promise.resolve(responseHelper.error("s_t_et_3", "Invalid user Ids."));
    }

    if(!cacheFetchResponse.data[oThis.fromUuid] || cacheFetchResponse.data[oThis.fromUuid].client_id != oThis.clientId){
      return Promise.resolve(responseHelper.error("s_t_et_4", "Invalid From user."));
    }

    if(!cacheFetchResponse.data[oThis.toUuid] || cacheFetchResponse.data[oThis.toUuid].client_id != oThis.clientId){
      return Promise.resolve(responseHelper.error("s_t_et_5", "Invalid To user."));
    }

    oThis.userRecords = cacheFetchResponse.data;
    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Validate input parameters
   *
   * @Sets transactionTypeRecord
   * @return {Promise<ResultBase>}
   */
  validateTransactionKind: async function(){
    const oThis = this;

    if(!oThis.transactionKind){
      return Promise.resolve(responseHelper.error("s_t_et_1", "Mandatory parameters missing"));
    }

    var cacheObj = new clientTransactionTypeCacheKlass({client_id: oThis.clientId, transaction_kind: oThis.transactionKind});
    var cachedResp = await cacheObj.fetch();
    if(cachedResp.isFailure()){
      return Promise.resolve(cachedResp);
    }
    oThis.transactionTypeRecord = cachedResp.data;

    if(oThis.transactionTypeRecord.status != clientTransactionTypeConst.activeStatus){
      return Promise.resolve(responseHelper.error("s_t_et_2", "Invalid transaction kind."));
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Validate Client Token
   *
   * @Sets clientBrandedToken
   * @return {Promise<ResultBase>}
   */
  validateClientToken: async function(){
    const oThis = this;

    if(!oThis.tokenSymbol){
      return Promise.resolve(responseHelper.error("s_t_et_6", "Invalid Token Symbol"));
    }

    var btSecureCache = new BTSecureCacheKlass({tokenSymbol: oThis.tokenSymbol});
    const cacheRsp = await btSecureCache.fetch();
    if (cacheRsp.isFailure()) {
      return Promise.resolve(cacheRsp);
    }

    if(oThis.clientId != cacheRsp.data.client_id){
      return Promise.resolve(responseHelper.error("s_t_et_7", "Invalid Token Symbol"));
    }

    oThis.clientBrandedToken = cacheRsp.data;

    return Promise.resolve(responseHelper.successWithData({}))
  },

  /**
   * Create Entry in transaction logs
   *
   */
  createTransactionLog: function () {
    const oThis = this;

    var inputParams = JSON.stringify({from_uuid: oThis.fromUuid, to_uuid: oThis.toUuid, transaction_kind: oThis.transactionKind});
    oThis.transactionUuid = uuid.v4();
    oThis.transactionHash = uuid.v4();
    transactionLogObj.create({client_id: oThis.clientId, client_token_id: oThis.clientBrandedToken.id,
                              chain_type: transactionLogConst.utilityChainType, status: transactionLogConst.processingStatus,
                              input_params: inputParams, transaction_uuid: oThis.transactionUuid,
                              transaction_hash: oThis.transactionHash});
  }


};

module.exports = ExecuteTransactionKlass;
"use strict";

/**
 * Simulate Random transaction for client
 *
 * @module /app/services/transaction/simulate_random_transaction
 */
const rootPrefix = "../../.."
  , clientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type')
  , clientTrxTypeObj = new clientTransactionTypeModel()
  , ManagedAdressModelKlass = require(rootPrefix + '/app/models/managed_address')
  , managedAddressObj = new ManagedAdressModelKlass()
  , ClientUsersCntCacheKlass = require(rootPrefix + '/lib/cache_management/client_users_count')
  , ClientTrxTypeCntCacheKlass = require(rootPrefix + '/lib/cache_management/client_transaction_type_count')
  , clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , BTSecureCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
  , executeTransactionKlass = require(rootPrefix + '/app/services/transaction/execute_transaction')
  ;

/**
 * Simulate Random transaction
 *
 * @param {number} params.client_id - client id who is performing a transaction.
 * @param {string} params.token_symbol - Token symbol whose transaction would be executed.
 *
 * @Constructor
 */
const simulateRandomTransactionKlass = function(params){
  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.tokenSymbol = params.token_symbol;

  oThis.randomTrxType = null;
  oThis.randomUsers = [];
};

simulateRandomTransactionKlass.prototype = {

  perform: async function(){
    const oThis = this;

    // Fetch random transaction
    var r = await oThis.fetchRandomTransactionType();
    if(r.isFailure()){
      return Promise.resolve(r);
    }

    var randomCount = 1;
    if(oThis.randomTrxType.kind == clientTxTypesConst.userToUserKind){
      randomCount = 2;
    }

    // Fetch Random users
    var r1 = await oThis.fetchRandomUsers(randomCount);
    if(r1.isFailure()){
      return Promise.resolve(r1);
    }

    var r2 = await oThis.sendTransaction();

    return Promise.resolve(r2);
  },

  /**
   * Fetch Random transaction type for client
   *
   * @return {Promise<any>}
   */
  fetchRandomTransactionType: async function(){
    const oThis = this;
    var countCacheObj = new ClientTrxTypeCntCacheKlass({clientId: oThis.clientId});
    var resp = await countCacheObj.fetch();
    if(resp.isFailure() || parseInt(resp.data) <= 0){
      return Promise.resolve(responseHelper.error('s_tr_srt_4', 'No active transactions for client.'));
    }

    var params = {clientId: oThis.clientId,
                  limit: 1,
                  offset: Math.floor(Math.random() * parseInt(resp.data))};
    var trxTypes = await clientTrxTypeObj.getAll(params);
    if(!trxTypes[0]){
      return Promise.resolve(responseHelper.error('s_tr_srt_5', 'No active transactions for client.'));
    }

    oThis.randomTrxType = trxTypes[0];

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Fetch Random users from database
   *
   * @param numberOfUsers
   * @return {Promise<any>}
   */
  fetchRandomUsers: async function(numberOfUsers){
    const oThis = this;
    var countCacheObj = new ClientUsersCntCacheKlass({client_id: oThis.clientId});
    var resp = await countCacheObj.fetch();
    if(resp.isFailure() || parseInt(resp.data) <= 0){
      return Promise.resolve(responseHelper.error('s_tr_srt_1', 'No active users for client.'));
    }

    var users = await managedAddressObj.getRandomActiveUsers(oThis.clientId, numberOfUsers, parseInt(resp.data));
    if(!users[0]){
      return Promise.resolve(responseHelper.error('s_tr_srt_2', 'No active users for client.'));
    }

    if(users.length < numberOfUsers){
      return Promise.resolve(responseHelper.error('s_tr_srt_3', 'No active users for this type of transaction.'));
    }
    oThis.randomUsers = users;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Execute random transaction
   *
   * @return {Promise<any>}
   */
  sendTransaction: async function(){
    const oThis = this;

    var btSecureCache = new BTSecureCacheKlass({tokenSymbol: oThis.tokenSymbol});
    const cacheRsp = await btSecureCache.fetch();
    if (cacheRsp.isFailure()) {
      return Promise.resolve(responseHelper.error("s_tr_srt_6", "Invalid Token Symbol"));
    }

    if(oThis.clientId != cacheRsp.data.client_id){
      return Promise.resolve(responseHelper.error("s_tr_srt_7", "Invalid Token Symbol"));
    }

    var from_uuid = null,
        to_uuid = null;
    if(oThis.randomTrxType.kind == clientTxTypesConst.userToUserKind){
      from_uuid = oThis.randomUsers[0].uuid;
      to_uuid = oThis.randomUsers[1].uuid;
    } else if(oThis.randomTrxType.kind == clientTxTypesConst.userToCompanyKind){
      from_uuid = oThis.randomUsers[0].uuid;
      to_uuid = cacheRsp.data.reserve_address_uuid;
    } else if(oThis.randomTrxType.kind == clientTxTypesConst.companyToUserKind){
      from_uuid = cacheRsp.data.reserve_address_uuid;
      to_uuid = oThis.randomUsers[0].uuid;
    }

    if(!from_uuid || !to_uuid){
      return Promise.resolve(responseHelper.error("s_tr_srt_8", "Something went wrong."));
    }

    var obj = new executeTransactionKlass({client_id: oThis.clientId, token_symbol: oThis.tokenSymbol,
                                            transaction_kind: oThis.randomTrxType.name,
                                            from_uuid: from_uuid, to_uuid: to_uuid});
    var resp = await obj.perform();
    return Promise.resolve(resp);
  }
};

module.exports = simulateRandomTransactionKlass;
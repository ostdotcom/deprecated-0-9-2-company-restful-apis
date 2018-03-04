"use strict";

/**
 * Service to Execute transaction.
 *
 * @module app/services/transaction/execute_transaction
 */
const rootPrefix = '../../..'
  , uuid = require("uuid")
  , OpenSTPayment = require('@openstfoundation/openst-payments')
  , openStPlatform = require('@openstfoundation/openst-platform')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , clientTransactionTypeCacheKlass = require(rootPrefix + '/lib/cache_management/client_transaction_type')
  , clientTransactionTypeConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , BTSecureCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , transactionLogKlass = require(rootPrefix + '/app/models/transaction_log')
  , transactionLogObj = new transactionLogKlass()
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , ostPriceCacheKlass = require(rootPrefix + '/lib/cache_management/ost_price_points')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , conversionRatesConst = require(rootPrefix + '/lib/global_constant/conversion_rates')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , managedAddressesKlass = require(rootPrefix + '/app/models/managed_address')
  , approveAmount = basicHelper.convertToWei('1000000000')
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
  oThis.gasPrice = '50000000000';
  oThis.transactionTypeRecord = null;
  oThis.userRecords = null;
  oThis.transactionHash = null;
  oThis.transactionUuid = null;
  oThis.clientBrandedToken = null;
  oThis.transactionLogId = null;
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

    // Create main transaction record in transaction logs
    // This transaction uuid would be used throughout as process id too for all the further transactions.
    oThis.transactionUuid = uuid.v4();
    var inputParams = {from_uuid: oThis.fromUuid, to_uuid: oThis.toUuid,
                        transaction_kind: oThis.transactionKind, token_symbol: oThis.tokenSymbol,
                        gas_price: oThis.gasPrice, transaction_kind_id: oThis.transactionTypeRecord.id};
    var insertedRec = await oThis.createTransactionLog(oThis.transactionUuid, inputParams,
                    transactionLogConst.processingStatus, {}, null);
    oThis.transactionLogId = insertedRec.insertId;

    oThis.performTransactionSteps();

    return Promise.resolve(responseHelper.successWithData(
      {transaction_uuid: oThis.transactionUuid, transaction_hash: oThis.transactionHash,
        from_uuid: oThis.fromUuid, to_uuid: oThis.toUuid, transaction_kind: oThis.transactionKind}));
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

    const managedAddressCache = new ManagedAddressCacheKlass({'uuids':
        [oThis.fromUuid, oThis.toUuid, oThis.clientBrandedToken.reserve_address_uuid,
          oThis.clientBrandedToken.worker_address_uuid]});

    const cacheFetchResponse = await managedAddressCache.fetchDecryptedData(['passphrase']);

    if (cacheFetchResponse.isFailure()) {
      return Promise.resolve(responseHelper.error("s_t_et_3", "Invalid user Ids."));
    }

    if(!cacheFetchResponse.data[oThis.fromUuid] || cacheFetchResponse.data[oThis.fromUuid].client_id != oThis.clientId){
      return Promise.resolve(responseHelper.error("s_t_et_4", "Invalid From user."));
    }

    if(oThis.clientBrandedToken.kind == clientTransactionTypeConst.companyToUserKind &&
      oThis.fromUuid != oThis.clientBrandedToken.reserve_address_uuid){
      return Promise.resolve(responseHelper.error("s_t_et_9", "Invalid From Company user."));
    }

    if(!cacheFetchResponse.data[oThis.toUuid] || cacheFetchResponse.data[oThis.toUuid].client_id != oThis.clientId){
      return Promise.resolve(responseHelper.error("s_t_et_5", "Invalid To user."));
    }

    if(oThis.clientBrandedToken.kind == clientTransactionTypeConst.userToCompanyKind &&
      oThis.toUuid != oThis.clientBrandedToken.reserve_address_uuid){
      return Promise.resolve(responseHelper.error("s_t_et_10", "Invalid To Company user."));
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

    if(!cacheRsp.data.worker_address_uuid){
      return Promise.resolve(responseHelper.error("s_t_et_11", "Token not set."));
    }

    oThis.clientBrandedToken = cacheRsp.data;

    return Promise.resolve(responseHelper.successWithData({}))
  },

  /**
   * Create Entry in transaction logs
   *
   * @param uuid
   * @param inputParams
   * @param status
   * @param responseData
   */
  createTransactionLog: function (uuid, inputParams, status, responseData, transactionHash) {
    const oThis = this;

    var ipp = JSON.stringify(inputParams)
      , fpp = JSON.stringify(responseData);
    return transactionLogObj.create({client_id: oThis.clientId, client_token_id: oThis.clientBrandedToken.id, input_params: ipp,
                              chain_type: transactionLogConst.utilityChainType, status: status,
                              transaction_uuid: uuid, process_uuid: oThis.transactionUuid,
                              formatted_receipt: fpp, transaction_hash: transactionHash});
  },

  /**
   * user approving airdrop contract for the transfer of branded token to other user.
   *
   * @param oThis
   * @return {Promise.<void>}
   */
  approveForBrandedToken: async function () {
    const oThis = this;

    const approveBTInput = {
      erc20_address: oThis.clientBrandedToken.token_erc20_address,
      approver_address: oThis.userRecords[oThis.fromUuid].ethereum_address,
      approver_passphrase: oThis.userRecords[oThis.fromUuid].passphrase_d,
      approvee_address: oThis.clientBrandedToken.airdrop_contract_address,
      to_approve_amount: approveAmount,
      options: {returnType: 'txReceipt'}
    };
    const approveForBrandedToken = new openStPlatform.services.approve.brandedToken(approveBTInput);

    var approveResponse = null;
    var approveTransactionHash = null;
    try {
      approveResponse = await approveForBrandedToken.perform();
      approveTransactionHash = approveResponse.data.transactionReceipt.data.rawTransactionReceipt.transactionHash;
    } catch(err) {
      approveResponse = responseHelper.error("t_et_15", err);
    }
    var approveRespData = approveResponse.data;
    var approveStatus = (approveResponse.isFailure() ? transactionLogConst.failedStatus : transactionLogConst.completeStatus);
    delete approveBTInput.approver_passphrase;
    oThis.createTransactionLog(uuid.v4(), approveBTInput, approveStatus,
      approveResponse.err, approveTransactionHash);

    if (approveResponse.isFailure()) {
      approveResponse.data = Object.assign({error: "Failed while approving contract."}, approveResponse.err);
      logger.notify('t_et_15', "Error in Approve app/services/transaction/execute_transaction - ", approveResponse);
      return Promise.resolve(approveResponse);
    }

    // Mark user as approved in database for future transactions.
    var managedAddress = new managedAddressesKlass();
    managedAddress.update(['properties = properties | ?',
      managedAddress.invertedProperties[managedAddressesConst.bTContractApproved]]).where({uuid: oThis.fromUuid}).fire();
    new ManagedAddressCacheKlass({'uuids': [oThis.fromUuid]}).clear();

    return Promise.resolve(responseHelper.successWithData({}))
  },

  /**
   * Refill gas for user if required for approving airdrop contract.
   *
   * @param oThis
   * @return {Promise.<void>}
   */
  refillGasForUser: async function(){
    const oThis = this;
    const estimateGasObj = new openStPlatform.services.transaction.estimateGas({
      contract_name: 'brandedToken',
      contract_address: oThis.clientBrandedToken.token_erc20_address,
      chain: 'utility',
      sender_address: oThis.userRecords[oThis.fromUuid].ethereum_address,
      method_name: 'approve',
      method_arguments: [oThis.userRecords[oThis.fromUuid].ethereum_address, approveAmount]
    });

    const estimateGasResponse = await estimateGasObj.perform();

    const estimatedGasWei = basicHelper.convertToBigNumber(estimateGasResponse.data.gas_to_use).mul(
      basicHelper.convertToBigNumber(chainInteractionConstants.UTILITY_GAS_PRICE));

    const transferSTPrimeInput = {
      sender_address: oThis.userRecords[oThis.clientBrandedToken.reserve_address_uuid].ethereum_address,
      sender_passphrase: oThis.userRecords[oThis.clientBrandedToken.reserve_address_uuid].passphrase_d,
      recipient_address: oThis.userRecords[oThis.fromUuid].ethereum_address,
      amount_in_wei: estimatedGasWei.toString(10),
      options: {returnType: 'txReceipt', tag: 'GasRefill'}
    };
    const transferSTPrimeBalanceObj = new openStPlatform.services.transaction.transfer.simpleTokenPrime(transferSTPrimeInput);

    const transferResponse = await transferSTPrimeBalanceObj.perform();
    var transferRespData = transferResponse.data;
    var transferStatus = (transferResponse.isFailure() ? transactionLogConst.failedStatus : transactionLogConst.completeStatus);
    delete transferSTPrimeInput.sender_passphrase;
    oThis.createTransactionLog(transferRespData.transaction_uuid, transferSTPrimeInput, transferStatus,
      {}, transferRespData.transaction_hash);

    if (transferResponse.isFailure()) {
      transferResponse.data = Object.assign({error: "Failed while transferring gas."}, transferResponse.err);
      logger.notify('t_et_14', "Error in transfer of " + estimatedGasWei + "Wei Eth to Address - " + transferResponse);
      return Promise.resolve(transferResponse);
    }
    return Promise.resolve(responseHelper.successWithData());
  },

  /**
   * Call Airdrop pay method
   *
   */
  sendAirdropPay: async function(){
    const oThis = this;
    const airdropPayment = new OpenSTPayment.airdrop(oThis.clientBrandedToken.airdrop_contract_address,
      chainInteractionConstants.UTILITY_CHAIN_ID);

    var workerUser = oThis.userRecords[oThis.clientBrandedToken.worker_address_uuid];
    var reserveUser = oThis.userRecords[oThis.clientBrandedToken.reserve_address_uuid];
    if(!workerUser || !reserveUser){
      oThis.updateParentTransactionLog(transactionLogConst.failedStatus, {error: "Worker or reserve user not found. "});
      return;
    }

    var ostPrices = await new ostPriceCacheKlass().fetch();
    var ostValue = ostPrices.data[conversionRatesConst.ost_currency()][conversionRatesConst.usd_currency()];

    var currencyType = ((oThis.transactionTypeRecord.currency_type == conversionRatesConst.usd_currency()) ?
      conversionRatesConst.usd_currency() : "");

    var response = await airdropPayment.pay(workerUser.ethereum_address,
      workerUser.passphrase_d,
      oThis.userRecords[oThis.toUuid].ethereum_address,
      basicHelper.convertToWei(oThis.transactionTypeRecord.currency_value).toString(),
      reserveUser.ethereum_address,
      basicHelper.convertToWei(oThis.transactionTypeRecord.commission_percent).toString(),
      currencyType,
      basicHelper.convertToWei(ostValue).toString(),
      oThis.userRecords[oThis.fromUuid].ethereum_address,
      oThis.gasPrice,
      {tag:oThis.transactionTypeRecord.name, returnType: 'txReceipt'});

    if(response.isFailure()){
      oThis.updateParentTransactionLog(transactionLogConst.failedStatus, response.err);
      return;
    }

    oThis.transactionHash = response.data.transaction_hash;
    oThis.updateParentTransactionLog(transactionLogConst.completeStatus);
  },

  /**
   * Update Transaction log.
   *
   * @param transactionHash
   * @param status
   * @param id
   */
  updateParentTransactionLog: function(status, failedResponse) {
    const oThis = this;
    var qParams = {status: status, transaction_hash: oThis.transactionHash};
    if(failedResponse){
      qParams['formatted_receipt'] = JSON.stringify(failedResponse);
    }
    transactionLogObj.edit(
      {
        qParams: qParams,
        whereCondition: {id: oThis.transactionLogId}
      }
    )
  },

  /**
   * Steps to perform when a transaction is executed.
   *
   * @return {Promise<void>}
   */
  performTransactionSteps: async function(){
    const oThis = this;

    // If from user has approved BT once then don't need to approve again
    var needApproveBT = !(oThis.userRecords[oThis.fromUuid].properties.includes(managedAddressesConst.bTContractApproved));

    // If Approval is needed and it failed then don't perform airdrop pay
    if(needApproveBT){
      // Refill gas of user to approve Airdrop contract
      //transfer estimated gas to approver.
      if(oThis.fromUuid != oThis.clientBrandedToken.reserve_address_uuid) {
        var result = await oThis.refillGasForUser();
        if(result.isFailure()){
          oThis.updateParentTransactionLog(transactionLogConst.failedStatus, result.data);
          return;
        }
      }
      var response = await oThis.approveForBrandedToken();
      if(response.isFailure()){
        oThis.updateParentTransactionLog(transactionLogConst.failedStatus, response.data);
        return;
      }
    }

    oThis.sendAirdropPay();
  }


};

module.exports = ExecuteTransactionKlass;
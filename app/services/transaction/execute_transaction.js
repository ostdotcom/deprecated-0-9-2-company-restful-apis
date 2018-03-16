"use strict";

/**
 * Service to Execute transaction.
 *
 * @module app/services/transaction/execute_transaction
 */
const rootPrefix = '../../..'
  , uuid = require("uuid")
  , OpenSTPayment = require('@openstfoundation/openst-payments')
  , openSTNotification = require('@openstfoundation/openst-notification')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , clientTransactionTypeCacheKlass = require(rootPrefix + '/lib/cache_management/client_transaction_type')
  , clientTransactionTypeConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , BTSecureCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
  , BTCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , transactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , ostPriceCacheKlass = require(rootPrefix + '/lib/cache_management/ost_price_points')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , conversionRatesConst = require(rootPrefix + '/lib/global_constant/conversion_rates')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , approveAmount = basicHelper.convertToWei('1000000000000000')
  , ApproveContractKlass = require(rootPrefix + '/lib/transactions/approve_contract')
  , TransferStPrimeKlass = require(rootPrefix + '/lib/transactions/stPrime_transfer')
  ;

/**
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.transactionLogId - transaction log id
 * @param {string} params.transactionUuid - transaction uuid.
 * @param {number} params.client_id - client id who is performing a transaction.
 * @param {string} params.token_symbol - Token symbol whose transaction would be executed.
 * @param {String} params.from_uuid - UUID of from user's address.
 * @param {String} params.to_uuid - UUID of to user's address.
 * @param {String} params.transaction_kind - Transaction kind to perform on user addresses.
 *
 */
const ExecuteTransactionKlass = function (params){
  const oThis = this;

  oThis.transactionLogId = params.transactionLogId;
  oThis.transactionUuid = params.transactionUuid;
  oThis.clientId = params.client_id;
  oThis.fromUuid = params.from_uuid;
  oThis.toUuid = params.to_uuid;
  oThis.transactionKind = params.transaction_kind;
  oThis.gasPrice = chainInteractionConstants.UTILITY_GAS_PRICE;

  oThis.inSync = params.runInSync || 0;
  oThis.tokenSymbol = null;
  oThis.transactionTypeRecord = null;
  oThis.userRecords = null;
  oThis.transactionHash = null;
  oThis.clientBrandedToken = null;
};

ExecuteTransactionKlass.prototype = {

  perform: async function(){
    const oThis = this;

    var r;

    r = await oThis.fetchTransactionLog();
    if(r.isFailure()) return Promise.resolve(r);

    r = await oThis.validateClientToken();
    if(r.isFailure()) return Promise.resolve(r);

    r = await oThis.validateTransactionKind();
    if(r.isFailure()) return Promise.resolve(r);

    r = await oThis.validateUsers();
    if(r.isFailure()) return Promise.resolve(r);

    // Create main transaction record in transaction logs
    // This transaction uuid would be used throughout as process id too for all the further transactions.
    // Don't Create new transaction log if already passed.
    if(!oThis.transactionLogId){
      oThis.transactionUuid = uuid.v4();
      var inputParams = {from_uuid: oThis.fromUuid, to_uuid: oThis.toUuid,
        transaction_kind: oThis.transactionKind, token_symbol: oThis.tokenSymbol,
        gas_price: oThis.gasPrice, transaction_kind_id: oThis.transactionTypeRecord.id};

      var insertedRec = await oThis.createTransactionLog(oThis.transactionUuid, inputParams,
        transactionLogConst.processingStatus, {}, null);
      oThis.transactionLogId = insertedRec.insertId;
    }

    // Transaction would be set in background & response would be returned with uuid.
    await oThis.executeTransaction();

    return Promise.resolve(responseHelper.successWithData(
      {transaction_uuid: oThis.transactionUuid, transaction_hash: oThis.transactionHash,
        from_uuid: oThis.fromUuid, to_uuid: oThis.toUuid, transaction_kind: oThis.transactionKind}));
  },

  /**
   * Get params of transaction from transaction log.
   *
   * @Sets clientId, fromUuid, toUuid, transactionKind, gasPrice
   * @return {Promise<ResultBase>}
   */
  fetchTransactionLog: async function () {
    const oThis = this;
    if(!oThis.transactionLogId) return Promise.resolve(responseHelper.successWithData({}));

    const transactionLogs = await new transactionLogModel().select('*').where(['id=?', oThis.transactionLogId]).fire()
      , transactionLog = transactionLogs[0];

    if(transactionLog.transaction_uuid !== oThis.transactionUuid){
      return Promise.resolve(responseHelper.successWithData({}));
    }
    console.log("transactionLog.status---", transactionLog.status);
    console.log("(new transactionLogModel().statuses[transactionLogConst.processingStatus])",  (new transactionLogModel().statuses[transactionLogConst.processingStatus]));

    if((new transactionLogModel().statuses[transactionLog.status]) != transactionLogConst.processingStatus){
      return Promise.resolve(
        responseHelper.error("s_t_et_1", "Only processing statuses are allowed here.", null, {}, {sendErrorEmail: false})
      )
    }
    const ransaction_params = JSON.parse(transactionLog.input_params);

    oThis.clientId = transactionLog.client_id;
    oThis.fromUuid = ransaction_params.from_uuid;
    oThis.toUuid = ransaction_params.to_uuid;
    oThis.transactionKind = ransaction_params.transaction_kind;
    oThis.gasPrice = ransaction_params.gas_price;

    return Promise.resolve(responseHelper.successWithData({}))
  },

  /**
   * Validate Client Token
   *
   * @Sets clientBrandedToken
   * @return {Promise<ResultBase>}
   */
  validateClientToken: async function(){
    const oThis = this;

    const btCache = new BTCacheKlass({clientId: oThis.clientId})
      , btCacheRsp = await btCache.fetch();

    if (btCacheRsp.isFailure()) {
      return Promise.resolve(cacheRsp);
    }
    oThis.tokenSymbol = btCacheRsp.data.symbol;

    if(!oThis.tokenSymbol){
      return Promise.resolve(responseHelper.error("s_t_et_2", "Invalid Token Symbol", null, {}, {sendErrorEmail: false}));
    }

    var btSecureCache = new BTSecureCacheKlass({tokenSymbol: oThis.tokenSymbol});
    const cacheRsp = await btSecureCache.fetch();
    if (cacheRsp.isFailure()) {
      return Promise.resolve(cacheRsp);
    }

    if(oThis.clientId != cacheRsp.data.client_id){
      return Promise.resolve(responseHelper.error("s_t_et_3", "Invalid Token Symbol", null, {}, {sendErrorEmail: false}));
    }

    // Client Token has not been set if worker uuid or token address or airdrop address not present.
    if(!cacheRsp.data.worker_address_uuid || !cacheRsp.data.token_erc20_address || !cacheRsp.data.airdrop_contract_address){
      return Promise.resolve(responseHelper.error("s_t_et_4", "Token not set", null, {}, {sendErrorEmail: false}));
    }

    oThis.clientBrandedToken = cacheRsp.data;

    return Promise.resolve(responseHelper.successWithData({}))
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
      return Promise.resolve(responseHelper.error("s_t_et_5", "Invalid users.", null, {}, {sendErrorEmail: false}));
    }

    const managedAddressCache = new ManagedAddressCacheKlass({'uuids':
        [oThis.fromUuid, oThis.toUuid, oThis.clientBrandedToken.reserve_address_uuid,
          oThis.clientBrandedToken.worker_address_uuid]});

    const cacheFetchResponse = await managedAddressCache.fetchDecryptedData(['passphrase']);

    if (cacheFetchResponse.isFailure()) {
      return Promise.resolve(responseHelper.error("s_t_et_6", "Invalid user Ids", null, {}, {sendErrorEmail: false}));
    }

    var fromUSer = cacheFetchResponse.data[oThis.fromUuid];
    if(!fromUSer || fromUSer.client_id != oThis.clientId || fromUSer.status != managedAddressesConst.activeStatus){
      return Promise.resolve(responseHelper.error("s_t_et_7", "Invalid From user", null, {}, {sendErrorEmail: false}));
    }

    var toUser = cacheFetchResponse.data[oThis.toUuid];
    if(!toUser || toUser.client_id != oThis.clientId || toUser.status != managedAddressesConst.activeStatus){
      return Promise.resolve(responseHelper.error("s_t_et_8", "Invalid To user", null, {}, {sendErrorEmail: false}));
    }

    if(oThis.transactionTypeRecord.kind === clientTransactionTypeConst.companyToUserKind){
      if(oThis.fromUuid !== oThis.clientBrandedToken.reserve_address_uuid){
        return Promise.resolve(responseHelper.error("s_t_et_9", "Invalid from Company user uuid", null, {}, {sendErrorEmail: false}));
      }
    } else if(oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToCompanyKind){
      if(oThis.toUuid !== oThis.clientBrandedToken.reserve_address_uuid){
        return Promise.resolve(responseHelper.error("s_t_et_10", "Invalid to Company user uuid", null, {}, {sendErrorEmail: false}));
      }
    } else if(oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToUserKind){
      if(oThis.fromUuid === oThis.clientBrandedToken.reserve_address_uuid){
        return Promise.resolve(responseHelper.error("s_t_et_11", "Unexpected uuid in From field", null, {}, {sendErrorEmail: false}));
      }
      if(oThis.toUuid === oThis.clientBrandedToken.reserve_address_uuid){
        return Promise.resolve(responseHelper.error("s_t_et_11", "Unexpected uuid in To field", null, {}, {sendErrorEmail: false}));
      }
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
      return Promise.resolve(responseHelper.error("s_t_et_12", "Mandatory parameters missing", null, {}, {sendErrorEmail: false}));
    }

    var cacheObj = new clientTransactionTypeCacheKlass({client_id: oThis.clientId, transaction_kind: oThis.transactionKind});
    var cachedResp = await cacheObj.fetch();
    if(cachedResp.isFailure()){
      return Promise.resolve(cachedResp);
    }
    oThis.transactionTypeRecord = cachedResp.data;

    if(oThis.transactionTypeRecord.status != clientTransactionTypeConst.activeStatus){
      return Promise.resolve(responseHelper.error("s_t_et_13", "Invalid transaction kind", null, {}, {sendErrorEmail: false}));
    }

    return Promise.resolve(responseHelper.successWithData({}));
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
    return new transactionLogModel().create({client_id: oThis.clientId, client_token_id: oThis.clientBrandedToken.id, input_params: ipp,
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

    var inputParams = {approverUuid: oThis.fromUuid, token_erc20_address: oThis.clientBrandedToken.token_erc20_address,
                  approvee_address: oThis.clientBrandedToken.airdrop_contract_address, return_type: 'txReceipt'};
    var approveResponse = await new ApproveContractKlass(inputParams).perform();

    inputParams = approveResponse.data['input_params'];
    var error = approveResponse.data['error']
      , approveTransactionHash = approveResponse.data['transaction_hash'];
    var approveStatus = (approveResponse.isFailure() ? transactionLogConst.failedStatus : transactionLogConst.completeStatus);
    await oThis.createTransactionLog(uuid.v4(), inputParams, approveStatus,
                            error, approveTransactionHash);
    return Promise.resolve(approveResponse);
  },

  /**
   * Refill gas for user if required for approving airdrop contract.
   *
   * @param oThis
   * @return {Promise.<void>}
   */
  refillGasForUser: async function(){

    const oThis = this;

    var inputParams = {sender_uuid: oThis.clientBrandedToken.reserve_address_uuid,
      token_erc20_address: oThis.clientBrandedToken.token_erc20_address,
      receiver_uuid: oThis.fromUuid, method_args: {name: 'approve', amount: approveAmount}};
    var refillGasResponse = await new TransferStPrimeKlass(inputParams).perform();

    inputParams = refillGasResponse.data['input_params'];
    var error = refillGasResponse.data['error']
      , TransactionHash = refillGasResponse.data['transaction_hash'];
    var refillStatus = (refillGasResponse.isFailure() ? transactionLogConst.failedStatus : transactionLogConst.completeStatus);
    await oThis.createTransactionLog(uuid.v4(), inputParams, refillStatus,
      error, TransactionHash);
    return Promise.resolve(refillGasResponse);
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
      await oThis.updateParentTransactionLog(transactionLogConst.failedStatus, {error: "Worker or reserve user not found. "});
      return Promise.resolve(responseHelper.error('s_t_et_14', "Worker or reserve user not found", null, {}, {sendErrorEmail: false}));
    }

    var ostPrices = await new ostPriceCacheKlass().fetch();
    var ostValue = ostPrices.data[conversionRatesConst.ost_currency()][conversionRatesConst.usd_currency()];

    var currencyType = ((oThis.transactionTypeRecord.currency_type == conversionRatesConst.usd_currency()) ?
      conversionRatesConst.usd_currency() : "");

    var commisionAmount = basicHelper.convertToWei(oThis.transactionTypeRecord.commission_percent).mul(
      basicHelper.convertToWei(oThis.transactionTypeRecord.currency_value)).div(basicHelper.convertToWei('100')).toString(10);

    var response = null;
    try {
      response = await airdropPayment.pay(workerUser.ethereum_address,
        workerUser.passphrase_d,
        oThis.userRecords[oThis.toUuid].ethereum_address,
        basicHelper.convertToWei(oThis.transactionTypeRecord.currency_value).toString(10),
        reserveUser.ethereum_address,
        commisionAmount,
        currencyType,
        basicHelper.convertToWei(ostValue).toString(10),
        oThis.userRecords[oThis.fromUuid].ethereum_address,
        oThis.gasPrice,
        {tag:oThis.transactionTypeRecord.name, returnType: 'txReceipt'});
    } catch(err) {
      response = responseHelper.error("s_t_et_15", err);
    }

    if(response.isFailure()){
      await oThis.updateParentTransactionLog(transactionLogConst.failedStatus, response.err);
      return Promise.resolve(response);
    }

    oThis.transactionHash = response.data.transaction_hash;
    await oThis.updateParentTransactionLog(transactionLogConst.completeStatus);
    return Promise.resolve(responseHelper.successWithData({}));
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
    new transactionLogModel().edit(
      {
        qParams: qParams,
        whereCondition: {id: oThis.transactionLogId}
      }
    )
  },

  executeTransaction: async function () {
    const oThis = this;

    try{

      if (oThis.inSync == 1) {
        await oThis.performTransactionSteps();
      } else {
        //set in RMQ
        var t1 = new Date();
        console.log("---setToRMQ---------------------------------------------------", t1);
        const setToRMQ = await openSTNotification.publishEvent.perform(
          {
            topics: ['transaction.execute'],
            publisher: 'OST',
            message: {
              kind: 'execute_transaction',
              payload: {
                transactionLogId: oThis.transactionLogId,
                transactionUuid: oThis.transactionUuid
              }
            }
          }
        );
        var t2 = new Date();
        console.log("---setToRMQ---------------------------------------------------", setToRMQ, '---', t2, '-diff-', (t2 - t1), 'ms');
        //if could not set to RMQ run in async.
        if (setToRMQ.isFailure() || setToRMQ.data.publishedToRmq == 0) {
          oThis.performTransactionSteps();
        }
      }
    } catch (err) {
      await oThis.updateParentTransactionLog(transactionLogConst.failedStatus, err);
      logger.error("executeTransaction Caught in Error catch..", err);
    }

    return Promise.resolve(responseHelper.successWithData({}))
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
          await oThis.updateParentTransactionLog(transactionLogConst.failedStatus, result.data['error']);
          return Promise.resolve(result);
        }
      }
      var response = await oThis.approveForBrandedToken();
      if(response.isFailure()){
        await oThis.updateParentTransactionLog(transactionLogConst.failedStatus, response.data['error']);
        return Promise.resolve(response);
      }
    }

    var resp = await oThis.sendAirdropPay();
    return Promise.resolve(resp);
  }


};

module.exports = ExecuteTransactionKlass;
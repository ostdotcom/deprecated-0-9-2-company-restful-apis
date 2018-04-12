"use strict";

/**
 * Service to Execute transaction.
 *
 * @module app/services/transaction/execute_transaction
 */

const openStPayments = require('@openstfoundation/openst-payments')
  , AirdropManagerPayKlass = openStPayments.services.airdropManager.pay
  , openSTNotification = require('@openstfoundation/openst-notification')
  , uuid = require("uuid")
;

const rootPrefix = '../../..'
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
  , ApproveContractKlass = require(rootPrefix + '/lib/transactions/approve_contract')
  , TransferStPrimeKlass = require(rootPrefix + '/lib/transactions/stPrime_transfer')
  , ClientTrxRateCacheKlass = require(rootPrefix + '/lib/cache_management/client_transactions_rate_limit')
  , ClientWorkerManagedAddressIdsKlass = require(rootPrefix + '/app/models/client_worker_managed_address_id')
  , clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id')
  , ClientActiveWorkerUuidCacheKlass = require(rootPrefix + '/lib/cache_management/client_active_worker_uuid')
  ;

const approveAmount = basicHelper.convertToWei('1000000000000000')
;

/**
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.transactionLogId - transaction log id
 * @param {string} params.transactionUuid - transaction uuid.
 * @param {number} params.client_id - client id who is performing a transaction.
 * @param {number} params.rateLimitCount - count which was used to check if tx should go into slow / fast queue.
 * @param {string} params.token_symbol - Token symbol whose transaction would be executed.
 * @param {String} params.from_uuid - UUID of from user's address.
 * @param {String} params.to_uuid - UUID of to user's address.
 * @param {String} params.transaction_kind - Transaction kind to perform on user addresses.
 *
 */
const ExecuteTransactionKlass = function (params) {
  const oThis = this;

  oThis.transactionLogId = params.transactionLogId;
  oThis.transactionUuid = params.transactionUuid;
  oThis.rateLimitCount = params.rateLimitCount;

  oThis.clientId = params.client_id;
  oThis.fromUuid = params.from_uuid;
  oThis.toUuid = params.to_uuid;
  oThis.transactionKind = params.transaction_kind;
  oThis.inSync = params.runInSync || 0;

  oThis.gasPrice = chainInteractionConstants.UTILITY_GAS_PRICE;
  oThis.tokenSymbol = null;
  oThis.transactionTypeRecord = null;
  oThis.userRecords = null;
  oThis.transactionHash = null;
  oThis.clientBrandedToken = null;
  oThis.availableWorkerUuids = null;
  oThis.workerUser = null;

};

ExecuteTransactionKlass.prototype = {

  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("s_t_et_22", "Unhandled result", null, {}, {});
        }
      });
  },

  /**
   * Async perform
   *
   * @return {promise<result>}
   */
  asyncPerform: async function () {
    const oThis = this
    ;

    const fetchTransactionLogResponse = await oThis.fetchTransactionLog();
    if (fetchTransactionLogResponse.isFailure()) return Promise.resolve(fetchTransactionLogResponse);

    const validateClientTokenResponse = await oThis.validateClientToken();
    if (validateClientTokenResponse.isFailure()) return Promise.resolve(validateClientTokenResponse);

    const validateTransactionKindResponse = await oThis.validateTransactionKind();
    if (validateTransactionKindResponse.isFailure()) return Promise.resolve(validateTransactionKindResponse);

    const validateUsersResponse = await oThis.validateUsers();
    if (validateUsersResponse.isFailure()) return Promise.resolve(validateUsersResponse);

    // Create main transaction record in transaction logs
    // This transaction uuid would be used throughout as process id too for all the further transactions.
    // Don't Create new transaction log if already passed.
    if (!oThis.transactionLogId) {

      oThis.transactionUuid = uuid.v4();

      var inputParams = {
        from_uuid: oThis.fromUuid, to_uuid: oThis.toUuid,
        transaction_kind: oThis.transactionKind, token_symbol: oThis.tokenSymbol,
        transaction_kind_id: oThis.transactionTypeRecord.id
      };

      var insertedRec = await oThis.createTransactionLog(oThis.transactionUuid, inputParams, oThis.gasPrice);

      oThis.transactionLogId = insertedRec.insertId;

    }

    // Transaction would be set in background & response would be returned with uuid.
    const executeTransactionResponse = await oThis.executeTransaction()
      .catch(function (error) {
        logger.error('app/services/transaction/execute_transaction.js::executeTransaction::catch');
        logger.error(error);

        return Promise.resolve(responseHelper.error("s_t_et_21", "Inside catch block", null, {}, {sendErrorEmail: false})
        );
      });

    if (executeTransactionResponse.isFailure()) return Promise.resolve(executeTransactionResponse);

    return Promise.resolve(responseHelper.successWithData(
      {
        transaction_uuid: oThis.transactionUuid, transaction_hash: oThis.transactionHash,
        from_uuid: oThis.fromUuid, to_uuid: oThis.toUuid, transaction_kind: oThis.transactionKind
      }));
  },

  /**
   * Fetch transaction log from db
   *
   * @return {promise<result>}
   */
  fetchTransactionLog: async function () {
    const oThis = this
    ;

    if (!oThis.transactionLogId) return Promise.resolve(responseHelper.successWithData({}));

    const transactionLogs = await new transactionLogModel()
      .getById([oThis.transactionLogId]);

    const transactionLog = transactionLogs[0];

    // check if the transaction log uuid is same as that passed in the params, otherwise error out
    if (transactionLog.transaction_uuid !== oThis.transactionUuid) {
      return Promise.resolve(
        responseHelper.error("s_t_et_18", "Invalid params.", null, {}, {sendErrorEmail: false})
      );
    }

    // check if the transaction log status is processing, otherwise error out
    if ((new transactionLogModel().statuses[transactionLog.status]) != transactionLogConst.processingStatus) {
      return Promise.resolve(
        responseHelper.error("s_t_et_1", "Only processing statuses are allowed here.", null, {}, {sendErrorEmail: false})
      )
    }
    const transaction_params = transactionLog.input_params;

    oThis.clientId = transactionLog.client_id;
    oThis.fromUuid = transaction_params.from_uuid;
    oThis.toUuid = transaction_params.to_uuid;
    oThis.transactionKind = transaction_params.transaction_kind;
    oThis.gasPrice = basicHelper.convertToHex(transactionLog.gas_price);
    oThis.inputParams = transaction_params;

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Validate Client Token
   *
   * @Sets clientBrandedToken
   * @return {Promise<ResultBase>}
   */
  validateClientToken: async function() {

    const oThis = this;

    const btCache = new BTCacheKlass({clientId: oThis.clientId})
      , btCacheRsp = await btCache.fetch();

    if (btCacheRsp.isFailure()) {
      return Promise.resolve(cacheRsp);
    }
    oThis.tokenSymbol = btCacheRsp.data.symbol;

    if (!oThis.tokenSymbol) {
      return Promise.resolve(responseHelper.error("s_t_et_2", "Invalid Token Symbol", null, {}, {sendErrorEmail: false}));
    }

    var btSecureCache = new BTSecureCacheKlass({tokenSymbol: oThis.tokenSymbol});
    const cacheRsp = await btSecureCache.fetch();
    if (cacheRsp.isFailure()) {
      return Promise.resolve(cacheRsp);
    }

    if (oThis.clientId != cacheRsp.data.client_id) {
      return Promise.resolve(responseHelper.error("s_t_et_3", "Invalid Token Symbol", null, {}, {sendErrorEmail: false}));
    }

    // Client Token has not been set if worker uuid or token address or airdrop address not present.
    if(!cacheRsp.data.token_erc20_address || !cacheRsp.data.airdrop_contract_address){
      return Promise.resolve(responseHelper.error("s_t_et_4", "Token not set", null, {}, {sendErrorEmail: false}));
    }

    oThis.clientBrandedToken = cacheRsp.data;

    const clientUuidCacheRsp = await new ClientActiveWorkerUuidCacheKlass({client_id: oThis.clientId}).fetch();
    if (clientUuidCacheRsp.isFailure() || clientUuidCacheRsp.data.length == 0) {
      return Promise.resolve(responseHelper.error("s_t_et_5", "no workers to process", null, {}, {sendErrorEmail: false}));
    }
    oThis.availableWorkerUuids = clientUuidCacheRsp.data.workerUuids;

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Validate Users
   *
   * @Sets userRecords
   * @return {Promise<ResultBase>}
   */
  validateUsers: async function () {
    const oThis = this;

    if (!oThis.fromUuid || !oThis.toUuid || oThis.fromUuid == oThis.toUuid) {
      return Promise.resolve(responseHelper.error("s_t_et_5", "Invalid users.", null, {}, {sendErrorEmail: false}));
    }

    const uuidsToFetch = [oThis.fromUuid, oThis.toUuid, oThis.clientBrandedToken.reserve_address_uuid];
    const managedAddressCache = new ManagedAddressCacheKlass({'uuids': uuidsToFetch});

    const cacheFetchResponse = await managedAddressCache.fetch();

    if (cacheFetchResponse.isFailure()) {
      return Promise.resolve(responseHelper.error("s_t_et_6", "Invalid user Ids", null, {}, {sendErrorEmail: false}));
    }

    var fromUSer = cacheFetchResponse.data[oThis.fromUuid];
    if (!fromUSer || fromUSer.client_id != oThis.clientId || fromUSer.status != managedAddressesConst.activeStatus) {
      return Promise.resolve(responseHelper.error("s_t_et_7", "Invalid From user", null, {}, {sendErrorEmail: false}));
    }

    var toUser = cacheFetchResponse.data[oThis.toUuid];
    if (!toUser || toUser.client_id != oThis.clientId || toUser.status != managedAddressesConst.activeStatus) {
      return Promise.resolve(responseHelper.error("s_t_et_8", "Invalid To user", null, {}, {sendErrorEmail: false}));
    }

    if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.companyToUserKind) {
      if (oThis.fromUuid !== oThis.clientBrandedToken.reserve_address_uuid) {
        return Promise.resolve(responseHelper.error("s_t_et_9", "Invalid from Company user uuid", null, {}, {sendErrorEmail: false}));
      }
    } else if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToCompanyKind) {
      if (oThis.toUuid !== oThis.clientBrandedToken.reserve_address_uuid) {
        return Promise.resolve(responseHelper.error("s_t_et_10", "Invalid to Company user uuid", null, {}, {sendErrorEmail: false}));
      }
    } else if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToUserKind) {
      if (oThis.fromUuid === oThis.clientBrandedToken.reserve_address_uuid) {
        return Promise.resolve(responseHelper.error("s_t_et_11", "Unexpected uuid in From field", null, {}, {sendErrorEmail: false}));
      }
      if (oThis.toUuid === oThis.clientBrandedToken.reserve_address_uuid) {
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
  validateTransactionKind: async function () {
    const oThis = this;

    if (!oThis.transactionKind) {
      return Promise.resolve(responseHelper.error("s_t_et_12", "Mandatory parameters missing", null, {}, {sendErrorEmail: false}));
    }

    var cacheObj = new clientTransactionTypeCacheKlass({
      client_id: oThis.clientId,
      transaction_kind: oThis.transactionKind
    });
    var cachedResp = await cacheObj.fetch();
    if (cachedResp.isFailure()) {
      return Promise.resolve(cachedResp);
    }
    oThis.transactionTypeRecord = cachedResp.data;

    if (oThis.transactionTypeRecord.status != clientTransactionTypeConst.activeStatus) {
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
   */
  createTransactionLog: function (uuid, inputParams, hexGasPrice) {

    const oThis = this;

    return new transactionLogModel().insertRecord({
      client_id: oThis.clientId,
      client_token_id: oThis.clientBrandedToken.id,
      transaction_type: new transactionLogModel().invertedTransactionTypes[transactionLogConst.tokenTransferTransactionType],
      input_params: inputParams,
      chain_type: new transactionLogModel().invertedChainTypes[transactionLogConst.utilityChainType],
      status: new transactionLogModel().invertedStatuses[transactionLogConst.processingStatus],
      transaction_uuid: uuid,
      gas_price: basicHelper.convertToBigNumber(hexGasPrice).toString(10) // converting hex to base 10
    });

  },

  /**
   * user approving airdrop contract for the transfer of branded token to other user.
   *
   * @param oThis
   * @return {Promise.<void>}
   */
  approveForBrandedToken: async function () {
    const oThis = this;

    var inputParams = {
      approverUuid: oThis.fromUuid, token_erc20_address: oThis.clientBrandedToken.token_erc20_address,
      approvee_address: oThis.clientBrandedToken.airdrop_contract_address, return_type: 'txReceipt'
    };

    var approveResponse = await new ApproveContractKlass(inputParams).perform();

    var approveStatus = (approveResponse.isFailure() ? transactionLogConst.failedStatus : transactionLogConst.completeStatus);

    if(approveResponse.isFailure()) {
      oThis.updateParentTransactionLog(transactionLogConst.failedStatus, approveResponse.data['error']);
    }

    return Promise.resolve(approveResponse);

  },

  /**
   * Refill gas for user if required for approving airdrop contract.
   *
   * @return {promise<result>}
   */
  refillGasForUser: async function () {

    const oThis = this
    ;

    var inputParams = {
      sender_uuid: oThis.clientBrandedToken.reserve_address_uuid,
      token_erc20_address: oThis.clientBrandedToken.token_erc20_address,
      receiver_uuid: oThis.fromUuid, method_args: {name: 'approve', amount: approveAmount}
    };
    var refillGasResponse = await new TransferStPrimeKlass(inputParams).perform();

    var refillStatus = (refillGasResponse.isFailure() ? transactionLogConst.failedStatus : transactionLogConst.completeStatus);

    if (refillGasResponse.isFailure()) {
      oThis.updateParentTransactionLog(transactionLogConst.failedStatus, refillGasResponse.data['error']);
    }

    return Promise.resolve(refillGasResponse);

  },

  /**
   * Call Airdrop pay method
   *
   */
  sendAirdropPay: async function () {

    const oThis = this
      , reserveUser = oThis.userRecords[oThis.clientBrandedToken.reserve_address_uuid]
    ;

    if(!oThis.workerUser || !reserveUser){
      await oThis.updateParentTransactionLog(transactionLogConst.failedStatus, {msg: "Worker or reserve user not found. "});
      return Promise.resolve(responseHelper.error('s_t_et_14', "Worker or reserve user not found", null, {}, {sendErrorEmail: false}));
    }

    var ostPrices = await new ostPriceCacheKlass().fetch();
    var ostValue = ostPrices.data[conversionRatesConst.ost_currency()][conversionRatesConst.usd_currency()];

    var currencyType = ((oThis.transactionTypeRecord.currency_type == conversionRatesConst.usd_currency()) ?
      conversionRatesConst.usd_currency() : "");

    var commisionAmount = basicHelper.convertToWei(oThis.transactionTypeRecord.commission_percent).mul(
      basicHelper.convertToWei(oThis.transactionTypeRecord.currency_value)).div(basicHelper.convertToWei('100')).toString();

    const payMethodParams = {
      airdrop_contract_address: oThis.clientBrandedToken.airdrop_contract_address,
      chain_id: chainInteractionConstants.UTILITY_CHAIN_ID,
      sender_worker_address: oThis.workerUser.ethereum_address,
      sender_worker_passphrase: oThis.workerUser.passphrase_d,
      beneficiary_address: oThis.userRecords[oThis.toUuid].ethereum_address,
      transfer_amount: basicHelper.convertToWei(oThis.transactionTypeRecord.currency_value).toString(),
      commission_beneficiary_address: reserveUser.ethereum_address,
      commission_amount: commisionAmount,
      currency: currencyType,
      intended_price_point: basicHelper.convertToWei(ostValue).toString(),
      spender: oThis.userRecords[oThis.fromUuid].ethereum_address,
      gas_price: oThis.gasPrice,
      options: {tag: oThis.transactionTypeRecord.name, returnType: 'txHash', shouldHandlePostPay:0 }
    };

    const payObject = new AirdropManagerPayKlass(payMethodParams);

    const payResponse = await payObject.perform()
      .catch(function (error) {
        logger.error('app/services/transaction/execute_transaction.js::airdropPayment.pay::catch');
        logger.error(error);
        return Promise.resolve(responseHelper.error("s_t_et_15", "Inside catch block", null, {}, {sendErrorEmail: true})
      );
    });

    if (payResponse.isFailure()) {

      //Mark ST Prime balance is low for worker for future transactions.
      if(payResponse.err.code.includes("l_ci_h_pse_gas_low")){

        // Mark ST Prime balance is low for worker for future transactions.

        const dbObject = await new ClientWorkerManagedAddressIdsKlass().select('id, properties')
            .where(['client_id=? AND managed_address_id=?', oThis.clientId, oThis.workerUser.id]).fire()[0];

        await new ClientWorkerManagedAddressIdsKlass()
            .update({properties: new ClientWorkerManagedAddressIdsKlass().unsetBit(clientWorkerManagedAddressConst.hasStPrimeBalanceProperty, dbObject.properties)})
            .where({id: dbObject.id}).fire();

        // Flush worker uuids cache
        new ClientActiveWorkerUuidCacheKlass({client_id: oThis.clientId}).clear();

      }

      oThis.updateParentTransactionLog(transactionLogConst.failedStatus, payResponse.err);
      return Promise.resolve(payResponse);

    }

    oThis.transactionHash = payResponse.data.transaction_hash;

    oThis.inputParams.postAirdropParams = payResponse.data.post_pay_params;
    oThis.updateParentTransactionLog(transactionLogConst.waitingForMiningStatus);

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Update Transaction log.
   *
   * @param transactionHash
   * @param status
   * @param id
   */
  updateParentTransactionLog: function (statusString, failedResponse) {
    const oThis = this
        , statusInt = new transactionLogModel().invertedStatuses[statusString];
    var dataToUpdate = {status: statusInt, transaction_hash: oThis.transactionHash, input_params: oThis.inputParams};
    if (failedResponse) {
      dataToUpdate['formatted_receipt'] = failedResponse;
    }
    return new transactionLogModel().updateRecord(oThis.transactionLogId, dataToUpdate);
  },

  executeTransaction: async function () {

    const oThis = this;

    try {

      if (oThis.inSync == 1) {
        await oThis.performTransactionSteps();
      } else {

        var topicName = 'transaction.execute';
        const rateLimitCrossed = await new ClientTrxRateCacheKlass({client_id: oThis.clientId}).transactionRateLimitCrossed();
        if (rateLimitCrossed.isSuccess() && rateLimitCrossed.data.limitCrossed) {
          topicName = 'slow.transaction.execute'
        }
        if (!oThis.rateLimitCount) {
          oThis.rateLimitCount = rateLimitCrossed.data.rateLimitCount;
        }
        const setToRMQ = await openSTNotification.publishEvent.perform(
          {
            topics: [topicName],
            publisher: 'OST',
            message: {
              kind: 'execute_transaction',
              payload: {
                transactionLogId: oThis.transactionLogId,
                transactionUuid: oThis.transactionUuid,
                rateLimitCount: oThis.rateLimitCount
              }
            }
          }
        );

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
  performTransactionSteps: async function () {
    const oThis = this
    ;

    // If from user has approved BT once then don't need to approve again
    var needApproveBT = !(oThis.userRecords[oThis.fromUuid].properties.includes(managedAddressesConst.bTContractApproved));

    // If Approval is needed and it failed then don't perform airdrop pay
    if (needApproveBT) {
      // Refill gas of user to approve Airdrop contract
      //transfer estimated gas to approver.
      if (oThis.fromUuid != oThis.clientBrandedToken.reserve_address_uuid) {
        const refillGasForUserResponse = await oThis.refillGasForUser();
        if (refillGasForUserResponse.isFailure()) return Promise.resolve(refillGasForUserResponse);
      }

      const approveForBrandedTokenResponse = await oThis.approveForBrandedToken();

      if (approveForBrandedTokenResponse.isFailure()) return Promise.resolve(approveForBrandedTokenResponse);
    }

    const setWorkerUserResponse = await oThis.setWorkerUser();
    if (setWorkerUserResponse.isFailure()) {
      return Promise.resolve(setWorkerUserResponse);
    }

    const sendAirdropPayResponse = await oThis.sendAirdropPay();
    return Promise.resolve(sendAirdropPayResponse);

  },

  setWorkerUser: async function() {

    const oThis = this
    ;

    var index = oThis.rateLimitCount % oThis.availableWorkerUuids.length
        , workerUuid = oThis.availableWorkerUuids[index];

    const managedAddressCache = new ManagedAddressCacheKlass({'uuids': [workerUuid]})
        , cacheFetchResponse = await managedAddressCache.fetch();

    if (cacheFetchResponse.isFailure()) {
      return Promise.resolve(responseHelper.error("s_t_et_16", "Couldn't fetch data for worker uuid", null, {}, {sendErrorEmail: false}));
    }

    oThis.workerUser = cacheFetchResponse.data[workerUuid];

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

module.exports = ExecuteTransactionKlass;
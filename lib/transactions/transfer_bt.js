"use strict";

/**
 * Service to Execute transfer BT transaction.
 */
const openStPayments = require('@openstfoundation/openst-payments')
  , AirdropManagerPayKlass = openStPayments.services.airdropManager.pay
;

const rootPrefix = '../..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ClientTransactionTypeFromNameCache = require(rootPrefix + '/lib/cache_management/client_transaction_type/by_name')
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
  , ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id')
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
const TransferBt = function (params) {
  const oThis = this
  ;

  oThis.transactionLogId = params.transactionLogId;
  oThis.transactionUuid = params.transactionUuid;
  oThis.rateLimitCount = params.rateLimitCount;

  oThis.clientId = null;
  oThis.fromUuid = null;
  oThis.toUuid = null;
  oThis.transactionKind = null;
  oThis.gasPrice = null;
  oThis.tokenSymbol = null;
  oThis.transactionTypeRecord = null;
  oThis.userRecords = null;
  oThis.transactionHash = null;
  oThis.clientBrandedToken = null;
  oThis.availableWorkerUuids = null;
  oThis.workerUser = null;
};

TransferBt.prototype = {

  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: function () {
    const oThis = this
    ;

    return oThis.asyncPerform()
      .catch(function (error) {
        if (responseHelper.isCustomResult(error)) {
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);
          return responseHelper.error({
            internal_error_identifier: 's_t_et_22',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
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

    await oThis._fetchTransactionLog();

    await oThis._validateClientToken();

    await oThis._validateTransactionKind();

    await oThis._validateOptionallyMandatoryParams();

    await oThis._validateUsers();

    await oThis._execute();

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
  _fetchTransactionLog: async function () {
    const oThis = this
    ;

    const transactionLog = await new transactionLogModel()
      .getById([oThis.transactionLogId])[0];

    // check if the transaction log uuid is same as that passed in the params, otherwise error out
    if (transactionLog.transaction_uuid !== oThis.transactionUuid) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_et_18',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      }));
    }

    // check if the transaction log status is processing, otherwise error out
    if ((new transactionLogModel().statuses[transactionLog.status]) != transactionLogConst.processingStatus) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_et_1',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      }));
    }

    const transactionParams = transactionLog.input_params;

    oThis.clientId = transactionLog.client_id;
    oThis.fromUuid = transactionParams.from_uuid;
    oThis.toUuid = transactionParams.to_uuid;
    oThis.transactionKind = transactionParams.transaction_kind;
    oThis.gasPrice = basicHelper.convertToHex(transactionLog.gas_price);
    oThis.inputParams = transactionParams;

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Validate Client Token
   *
   * @Sets clientBrandedToken
   * @return {Promise<result>}
   */
  _validateClientToken: async function () {
    const oThis = this
    ;

    const btCacheRsp = await (new BTCacheKlass({clientId: oThis.clientId})).fetch();

    if (btCacheRsp.isFailure()) return Promise.reject(btCacheRsp);

    oThis.tokenSymbol = btCacheRsp.data.symbol;

    if (!oThis.tokenSymbol) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_et_2',
        api_error_identifier: 'missing_token_symbol',
        debug_options: {}
      }));
    }

    var btSecureCache = new BTSecureCacheKlass({tokenSymbol: oThis.tokenSymbol});
    const cacheRsp = await btSecureCache.fetch();
    if (cacheRsp.isFailure()) {
      return Promise.reject(cacheRsp);
    }

    if (oThis.clientId != cacheRsp.data.client_id) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_et_2',
        api_error_identifier: 'unauthorized_for_other_client',
        debug_options: {}
      }));
    }

    // Client Token has not been set if worker uuid or token address or airdrop address not present.
    if (!cacheRsp.data.token_erc20_address || !cacheRsp.data.airdrop_contract_address) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_et_3',
        api_error_identifier: 'token_not_setup',
        debug_options: {}
      }));
    }

    oThis.clientBrandedToken = cacheRsp.data;

    const clientUuidCacheRsp = await new ClientActiveWorkerUuidCacheKlass({client_id: oThis.clientId}).fetch();
    if (clientUuidCacheRsp.isFailure() || clientUuidCacheRsp.data.length == 0) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_et_4',
        api_error_identifier: 'token_not_setup',
        debug_options: {}
      }));
    }
    oThis.availableWorkerUuids = clientUuidCacheRsp.data.workerUuids;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Validate the commission percent and amount.
   *
   * Sets oThis.transactionTypeRecord
   *
   * @return {promise<result>}
   */
  _validateOptionallyMandatoryParams: async function () {
    const oThis = this
    ;

    // in case of arbitrary amount, amount should be passed in the params.
    if (oThis.transactionTypeRecord.arbitrary_amount && !(oThis.amount >= 0)) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_e_6',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_amount'],
        debug_options: {}
      }));
    }

    // in case of arbitrary commission percent, commission percent should be passed in the params.
    if (oThis.transactionTypeRecord.arbitrary_commission_percent && !(oThis.commissionPercent >= 0)) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_e_7',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_commission_percent'],
        debug_options: {}
      }));
    }

    // in case of non arbitrary amount, amount should NOT be passed in the params.
    if (!oThis.transactionTypeRecord.arbitrary_amount && (oThis.amount >= 0)) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_e_8',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_amount'],
        debug_options: {}
      }));
    }

    // in case of arbitrary commission percent, commission percent should be passed in the params.
    if (!oThis.transactionTypeRecord.arbitrary_commission_percent && (oThis.commissionPercent >= 0)) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_e_9',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_commission_percent'],
        debug_options: {}
      }));
    }

    return responseHelper.successWithData({});
  },

  /**
   * Validate Users
   *
   * @Sets userRecords
   * @return {Promise<result>}
   */
  _validateUsers: async function () {
    const oThis = this;

    if (!oThis.fromUuid || !oThis.toUuid || oThis.fromUuid == oThis.toUuid) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_et_3',
        api_error_identifier: 'invalid_api_params',
        debug_options: {}
      }));
    }

    const uuidsToFetch = [oThis.fromUuid, oThis.toUuid, oThis.clientBrandedToken.reserve_address_uuid];
    const managedAddressCache = new ManagedAddressCacheKlass({'uuids': uuidsToFetch});

    const cacheFetchResponse = await managedAddressCache.fetch();

    if (cacheFetchResponse.isFailure()) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_et_6',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      }));
    }

    var fromUSer = cacheFetchResponse.data[oThis.fromUuid];
    if (!fromUSer || fromUSer.client_id != oThis.clientId || fromUSer.status != managedAddressesConst.activeStatus) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_et_7',
        api_error_identifier: 'invalid_from_user_uuid',
        debug_options: {}
      }));
    }

    var toUser = cacheFetchResponse.data[oThis.toUuid];
    if (!toUser || toUser.client_id != oThis.clientId || toUser.status != managedAddressesConst.activeStatus) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_et_8',
        api_error_identifier: 'invalid_to_user_uuid',
        debug_options: {}
      }));
    }

    if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.companyToUserKind) {
      if (oThis.fromUuid !== oThis.clientBrandedToken.reserve_address_uuid) {
        return Promise.reject(responseHelper.error({
          internal_error_identifier: 's_t_et_9',
          api_error_identifier: 'invalid_from_user_uuid',
          debug_options: {}
        }));
      }
    } else if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToCompanyKind) {
      if (oThis.toUuid !== oThis.clientBrandedToken.reserve_address_uuid) {
        return Promise.reject(responseHelper.error({
          internal_error_identifier: 's_t_et_10',
          api_error_identifier: 'invalid_to_user_uuid',
          debug_options: {}
        }));
      }
    } else if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToUserKind) {
      if (oThis.fromUuid === oThis.clientBrandedToken.reserve_address_uuid) {
        return Promise.reject(responseHelper.error({
          internal_error_identifier: 's_t_et_11',
          api_error_identifier: 'invalid_from_user_uuid',
          debug_options: {}
        }));
      }
      if (oThis.toUuid === oThis.clientBrandedToken.reserve_address_uuid) {
        return Promise.reject(responseHelper.error({
          internal_error_identifier: 's_t_et_12',
          api_error_identifier: 'invalid_to_user_uuid',
          debug_options: {}
        }));
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
  _validateTransactionKind: async function () {
    const oThis = this;

    if (!oThis.transactionKind) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_et_12',
        api_error_identifier: 'invalid_api_params',
        debug_options: {}
      }));
    }

    var cacheObj = new ClientTransactionTypeFromNameCache({
      client_id: oThis.clientId,
      transaction_kind: oThis.transactionKind
    });
    var cachedResp = await cacheObj.fetch();
    if (cachedResp.isFailure()) {
      return Promise.reject(cachedResp);
    }
    oThis.transactionTypeRecord = cachedResp.data;

    if (oThis.transactionTypeRecord.status != clientTransactionTypeConst.activeStatus) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_et_13',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_transactionkind'],
        debug_options: {}
      }));
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

  /**
   * Execute
   *
   * @return {promise<void>}
   */
  _execute: async function () {
    const oThis = this
    ;

    await oThis.performTransactionSteps().catch(async function (err) {
      await oThis.updateParentTransactionLog(transactionLogConst.failedStatus, err);
      logger.error("executeTransaction Caught in Error catch..", err);
    });

    return Promise.resolve(responseHelper.successWithData({}))
  },

  /**
   * Steps to perform when a transaction is executed.
   *
   * @return {promise<result>}
   */
  performTransactionSteps: async function () {
    const oThis = this
    ;

    // If from user has approved BT once then don't need to approve again
    const needApproveBT = !(oThis.userRecords[oThis.fromUuid].properties.includes(
      managedAddressesConst.bTContractApproved));

    // If Approval is needed and it failed then don't perform airdrop pay
    if (needApproveBT) {
      // Refill gas of user to approve Airdrop contract
      //transfer estimated gas to approver.
      if (oThis.fromUuid != oThis.clientBrandedToken.reserve_address_uuid) {
        const refillGasForUserResponse = await oThis.refillGasForUser();
        if (refillGasForUserResponse.isFailure()) return Promise.reject(refillGasForUserResponse);
      }

      const approveForBrandedTokenResponse = await oThis.approveForBrandedToken();
      if (approveForBrandedTokenResponse.isFailure()) return Promise.reject(approveForBrandedTokenResponse);
    }

    const setWorkerUserResponse = await oThis.setWorkerUser();
    if (setWorkerUserResponse.isFailure()) return Promise.reject(setWorkerUserResponse);

    const sendAirdropPayResponse = await oThis.sendAirdropPay();
    if (sendAirdropPayResponse.isFailure()) return Promise.reject(sendAirdropPayResponse);

    return Promise.resolve(responseHelper.successWithData({}));
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
   * user approving airdrop contract for the transfer of branded token to other user.
   *
   * @param oThis
   * @return {Promise.<void>}
   */
  approveForBrandedToken: async function () {
    const oThis = this
    ;

    let inputParams = {
      approverUuid: oThis.fromUuid, token_erc20_address: oThis.clientBrandedToken.token_erc20_address,
      approvee_address: oThis.clientBrandedToken.airdrop_contract_address, return_type: 'txReceipt'
    };

    let approveResponse = await new ApproveContractKlass(inputParams).perform();

    if (approveResponse.isFailure()) {
      oThis.updateParentTransactionLog(transactionLogConst.failedStatus, approveResponse.data['error']);
    }

    return Promise.resolve(approveResponse);
  },

  /**
   * Set worker user
   *
   * @return {promise<result>}
   */
  setWorkerUser: async function () {
    const oThis = this
    ;

    let index = oThis.rateLimitCount % oThis.availableWorkerUuids.length
      , workerUuid = oThis.availableWorkerUuids[index];

    const managedAddressCache = new ManagedAddressCacheKlass({'uuids': [workerUuid]})
      , cacheFetchResponse = await managedAddressCache.fetch();

    if (cacheFetchResponse.isFailure()) {
      return Promise.resolve(responseHelper.error({
        internal_error_identifier: 's_t_et_16',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      }));
    }

    oThis.workerUser = cacheFetchResponse.data[workerUuid];

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Call Airdrop pay method
   *
   */
  sendAirdropPay: async function () {
    const oThis = this
      , reserveUser = oThis.userRecords[oThis.clientBrandedToken.reserve_address_uuid]
    ;

    if (!oThis.workerUser || !reserveUser) {
      await oThis.updateParentTransactionLog(transactionLogConst.failedStatus, {msg: "Worker or reserve user not found. "});
      return Promise.resolve(responseHelper.error({
        internal_error_identifier: 's_t_et_14',
        api_error_identifier: 'token_not_setup',
        debug_options: {}
      }));
    }

    let ostPrices = await new ostPriceCacheKlass().fetch();
    let ostValue = ostPrices.data[conversionRatesConst.ost_currency()][conversionRatesConst.usd_currency()];

    let currencyType = ((oThis.transactionTypeRecord.currency_type == conversionRatesConst.usd_currency()) ?
      conversionRatesConst.usd_currency() : "");

    let commissionPercent = oThis.transactionTypeRecord.arbitrary_commission_percent ?
      oThis.inputParams.commission_percent :
      oThis.transactionTypeRecord.commission_percent;

    let currencyValue = oThis.transactionTypeRecord.arbitrary_amount ?
      oThis.inputParams.amount :
      oThis.transactionTypeRecord.currency_value;

    let commisionAmount = basicHelper.convertToWei(commissionPercent).mul(
      basicHelper.convertToWei(currencyValue)).div(basicHelper.convertToWei('100')).toString(10);

    const payMethodParams = {
      airdrop_contract_address: oThis.clientBrandedToken.airdrop_contract_address,
      chain_id: chainInteractionConstants.UTILITY_CHAIN_ID,
      sender_worker_address: oThis.workerUser.ethereum_address,
      sender_worker_passphrase: oThis.workerUser.passphrase_d,
      beneficiary_address: oThis.userRecords[oThis.toUuid].ethereum_address,
      transfer_amount: basicHelper.convertToWei(currencyValue).toString(10),
      commission_beneficiary_address: reserveUser.ethereum_address,
      commission_amount: commisionAmount,
      currency: currencyType,
      intended_price_point: basicHelper.convertToWei(ostValue).toString(10),
      spender: oThis.userRecords[oThis.fromUuid].ethereum_address,
      gas_price: oThis.gasPrice,
      options: {tag: oThis.transactionTypeRecord.name, returnType: 'txHash', shouldHandlePostPay: 0}
    };

    const payObject = new AirdropManagerPayKlass(payMethodParams);

    const payResponse = await payObject.perform()
      .catch(function (error) {
        logger.error('execute_transaction.js::airdropPayment.pay::catch');
        logger.error(error);
        return Promise.resolve(responseHelper.error({
          internal_error_identifier: 's_t_et_15',
          api_error_identifier: 'token_not_setup',
          debug_options: {}
        }));
      });

    if (payResponse.isFailure()) {

      const payResponseData = payResponse.toHash();

      //Mark ST Prime balance is low for worker for future transactions.
      if (payResponseData.err.code.includes("l_ci_h_pse_gas_low")) {

        // Mark ST Prime balance is low for worker for future transactions.

        const dbObject = (await new ClientWorkerManagedAddressIdModel().select('id, properties')
          .where({client_id: oThis.clientId, managed_address_id: oThis.workerUser.id}).fire())[0];

        let newPropertiesValue = new ClientWorkerManagedAddressIdModel().unsetBit(
          clientWorkerManagedAddressConst.hasStPrimeBalanceProperty, dbObject.properties);

        await new ClientWorkerManagedAddressIdModel()
          .update({properties: newPropertiesValue})
          .where({id: dbObject.id})
          .fire();

        // Flush worker uuids cache
        new ClientActiveWorkerUuidCacheKlass({client_id: oThis.clientId}).clear();
      }

      oThis.updateParentTransactionLog(transactionLogConst.failedStatus, payResponseData.err);
      return Promise.reject(payResponse);
    }

    oThis.transactionHash = payResponse.data.transaction_hash;

    oThis.inputParams.postReceiptProcessParams = payResponse.data.post_receipt_process_params;
    oThis.updateParentTransactionLog(transactionLogConst.waitingForMiningStatus);

    return Promise.resolve(responseHelper.successWithData({}));
  }

};

module.exports = TransferBt;
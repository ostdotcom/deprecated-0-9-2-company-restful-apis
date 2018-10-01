'use strict';

/**
 * Service to Execute transfer BT transaction.
 */

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  clientTransactionTypeConst = require(rootPrefix + '/lib/global_constant/client_transaction_types'),
  transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  conversionRatesConst = require(rootPrefix + '/lib/global_constant/conversion_rates'),
  managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses'),
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id'),
  commonValidator = require(rootPrefix + '/lib/validators/common'),
  TransactionMetaModel = require(rootPrefix + '/app/models/transaction_meta'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/lib/providers/payments');
require(rootPrefix + '/app/models/transaction_log');
require(rootPrefix + '/lib/cache_management/ost_price_points');
require(rootPrefix + '/lib/cache_management/client_transaction_type/by_id');
require(rootPrefix + '/lib/cache_multi_management/managedAddresses');
require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure');
require(rootPrefix + '/lib/cache_management/client_branded_token');
require(rootPrefix + '/lib/transactions/approve_contract');
require(rootPrefix + '/lib/transactions/stPrime_transfer_for_approve');
require(rootPrefix + '/lib/cache_management/client_active_worker_uuid');
require(rootPrefix + '/lib/cache_management/process_queue_association');

const approveAmount = basicHelper.convertToWei('1000000000000000');

/**
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.transactionLogId - transaction log id
 * @param {string} params.transactionUuid - transaction uuid.
 * @param {number} params.clientId - client id who is performing a transaction.
 * @param {String} params.workerUuid - UUID of worker to be used.
 * @param {string} params.token_symbol - Token symbol whose transaction would be executed.
 * @param {String} params.from_uuid - UUID of from user's address.
 * @param {String} params.to_uuid - UUID of to user's address.
 * @param {String} params.transaction_kind - Transaction kind to perform on user addresses.
 *
 */
const TransferBt = function(params) {
  const oThis = this;

  oThis.transactionUuid = params.transactionUuid;
  oThis.clientId = params.clientId;
  oThis.workerUuid = params.workerUuid;

  oThis.fromUuid = null;
  oThis.toUuid = null;
  oThis.gasPrice = null;
  oThis.tokenSymbol = null;
  oThis.transactionTypeRecord = null;
  oThis.userRecords = null;
  oThis.transactionHash = null;
  oThis.clientBrandedToken = null;
  oThis.workingProcesses = null;
  oThis.workerUser = null;
};

TransferBt.prototype = {
  /**
   * Perform
   *
   * @return {Promise<result>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
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
   * @return {Promise<result>}
   */
  asyncPerform: async function() {
    const oThis = this;

    await oThis._fetchTransactionLog();

    await oThis._validateClientToken();

    await oThis._validateAction();

    await oThis._validateOptionallyMandatoryParams();

    await oThis._validateUsers();

    await oThis._execute();

    return Promise.resolve(
      responseHelper.successWithData({
        transaction_uuid: oThis.transactionUuid,
        transaction_hash: oThis.transactionHash,
        from_uuid: oThis.fromUuid,
        to_uuid: oThis.toUuid,
        transaction_kind: oThis.transactionTypeRecord.name
      })
    );
  },

  /**
   * Fetch transaction log from db
   *
   * @return {Promise<result>}
   */
  _fetchTransactionLog: async function() {
    const oThis = this,
      transactionLogModel = oThis.ic().getTransactionLogModel();

    let transactionFetchResponse = await new transactionLogModel({
      client_id: oThis.clientId,
      shard_name: oThis.ic().configStrategy.TRANSACTION_LOG_SHARD_NAME
    }).batchGetItem([oThis.transactionUuid]);

    // check if the transaction log uuid is same as that passed in the params, otherwise error out
    if (transactionFetchResponse.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_et_21',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    let transactionLog = transactionFetchResponse.data[oThis.transactionUuid];

    // check if the transaction log uuid is same as that passed in the params, otherwise error out
    if (!transactionLog) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_et_18',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    // check if the transaction log status is processing, otherwise error out
    if (transactionLogConst.statuses[transactionLog.status] !== transactionLogConst.processingStatus) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_et_1',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    oThis.clientId = transactionLog.client_id;
    oThis.fromUuid = transactionLog.from_uuid;
    oThis.toUuid = transactionLog.to_uuid;
    oThis.actionId = transactionLog.action_id;
    oThis.gasPrice = basicHelper.convertToHex(transactionLog.gas_price);
    oThis.amount = transactionLog.amount;
    oThis.commissionPercent = transactionLog.commission_percent;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Validate Client Token
   *
   * @Sets clientBrandedToken
   * @return {Promise<result>}
   */
  _validateClientToken: async function() {
    const oThis = this,
      BTSecureCacheKlass = oThis.ic().getClientBrandedTokenSecureCache(),
      BTCacheKlass = oThis.ic().getClientBrandedTokenCache(),
      ProcessQueueAssociationCacheKlass = oThis.ic().getProcessQueueAssociationCache();

    const btCacheRsp = await new BTCacheKlass({ clientId: oThis.clientId }).fetch();

    if (btCacheRsp.isFailure()) return Promise.reject(btCacheRsp);

    oThis.tokenSymbol = btCacheRsp.data.symbol;

    if (!oThis.tokenSymbol) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_et_2',
          api_error_identifier: 'missing_token_symbol',
          debug_options: {}
        })
      );
    }

    let btSecureCache = new BTSecureCacheKlass({ tokenSymbol: oThis.tokenSymbol });
    const cacheRsp = await btSecureCache.fetch();
    if (cacheRsp.isFailure()) {
      return Promise.reject(cacheRsp);
    }

    if (oThis.clientId !== cacheRsp.data.client_id) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_et_2',
          api_error_identifier: 'unauthorized_for_other_client',
          debug_options: {}
        })
      );
    }

    // Client Token has not been set if worker uuid or token address or airdrop address not present.
    if (!cacheRsp.data.token_erc20_address || !cacheRsp.data.airdrop_contract_address) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_et_3',
          api_error_identifier: 'token_not_setup',
          debug_options: {}
        })
      );
    }

    oThis.clientBrandedToken = cacheRsp.data;

    if (!oThis.workerUuid) {
      const processQueueAssociationRsp = await new ProcessQueueAssociationCacheKlass({
        client_id: oThis.clientId
      }).fetch();
      if (
        processQueueAssociationRsp.isFailure() ||
        processQueueAssociationRsp.data.workingProcessDetails.length === 0
      ) {
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 's_t_et_4',
            api_error_identifier: 'token_not_setup',
            debug_options: {}
          })
        );
      }
      oThis.workingProcesses = processQueueAssociationRsp.data.workingProcessDetails;
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Validate the commission percent and amount.
   *
   * Sets oThis.transactionTypeRecord
   *
   * @return {Promise<result>}
   */
  _validateOptionallyMandatoryParams: async function() {
    const oThis = this;

    // in case of arbitrary amount, amount should be passed in the params.
    if (
      commonValidator.isVarTrue(oThis.transactionTypeRecord.arbitrary_amount) &&
      commonValidator.isVarNull(oThis.amount)
    ) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_t_tb_6',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_amount'],
          debug_options: {}
        })
      );
    }
    // in case of non arbitrary amount, amount should NOT be passed in the params.
    if (
      commonValidator.isVarFalse(oThis.transactionTypeRecord.arbitrary_amount) &&
      !commonValidator.isVarNull(oThis.amount)
    ) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_t_tb_8',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_amount'],
          debug_options: {}
        })
      );
    }
    if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToUserKind) {
      // in case of arbitrary commission percent, commission percent should be passed in the params.
      if (
        commonValidator.isVarTrue(oThis.transactionTypeRecord.arbitrary_commission_percent) &&
        commonValidator.isVarNull(oThis.commissionPercent)
      ) {
        return Promise.reject(
          responseHelper.paramValidationError({
            internal_error_identifier: 's_t_tb_7',
            api_error_identifier: 'invalid_api_params',
            params_error_identifiers: ['invalid_commission_percent'],
            debug_options: {}
          })
        );
      }

      // in case of arbitrary commission percent, commission percent should be passed in the params.
      if (
        commonValidator.isVarFalse(oThis.transactionTypeRecord.arbitrary_commission_percent) &&
        !commonValidator.isVarNull(oThis.commissionPercent)
      ) {
        return Promise.reject(
          responseHelper.paramValidationError({
            internal_error_identifier: 's_t_tb_9',
            api_error_identifier: 'invalid_api_params',
            params_error_identifiers: ['invalid_commission_percent'],
            debug_options: {}
          })
        );
      }
    }

    return responseHelper.successWithData({});
  },

  /**
   * Validate Users
   *
   * @Sets userRecords
   * @return {Promise<result>}
   */
  _validateUsers: async function() {
    const oThis = this,
      ManagedAddressCacheKlass = oThis.ic().getManagedAddressCache();

    if (!oThis.fromUuid || !oThis.toUuid || oThis.fromUuid === oThis.toUuid) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_et_3',
          api_error_identifier: 'invalid_api_params',
          debug_options: {}
        })
      );
    }

    const uuidsToFetch = [oThis.fromUuid, oThis.toUuid, oThis.clientBrandedToken.reserve_address_uuid];
    const managedAddressCache = new ManagedAddressCacheKlass({ uuids: uuidsToFetch });

    const cacheFetchResponse = await managedAddressCache.fetch();

    if (cacheFetchResponse.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_et_6',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    let fromUser = cacheFetchResponse.data[oThis.fromUuid];
    if (!fromUser || fromUser.client_id != oThis.clientId || fromUser.status !== managedAddressesConst.activeStatus) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_et_7',
          api_error_identifier: 'invalid_from_user_uuid',
          debug_options: {}
        })
      );
    }

    let toUser = cacheFetchResponse.data[oThis.toUuid];
    if (!toUser || toUser.client_id != oThis.clientId || toUser.status !== managedAddressesConst.activeStatus) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_et_8',
          api_error_identifier: 'invalid_to_user_uuid',
          debug_options: {}
        })
      );
    }

    if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.companyToUserKind) {
      if (oThis.fromUuid !== oThis.clientBrandedToken.reserve_address_uuid) {
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 's_t_et_9',
            api_error_identifier: 'invalid_from_user_uuid',
            debug_options: {}
          })
        );
      }
    } else if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToCompanyKind) {
      if (oThis.toUuid !== oThis.clientBrandedToken.reserve_address_uuid) {
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 's_t_et_10',
            api_error_identifier: 'invalid_to_user_uuid',
            debug_options: {}
          })
        );
      }
    } else if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToUserKind) {
      if (oThis.fromUuid === oThis.clientBrandedToken.reserve_address_uuid) {
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 's_t_et_11',
            api_error_identifier: 'invalid_from_user_uuid',
            debug_options: {}
          })
        );
      }
      if (oThis.toUuid === oThis.clientBrandedToken.reserve_address_uuid) {
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 's_t_et_12',
            api_error_identifier: 'invalid_to_user_uuid',
            debug_options: {}
          })
        );
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
  _validateAction: async function() {
    const oThis = this,
      ClientTransactionTypeFromIdCache = oThis.ic().getClientTransactionTypeByIdCache();

    if (!oThis.actionId) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_et_12',
          api_error_identifier: 'invalid_api_params',
          debug_options: {}
        })
      );
    }

    let cachedResp = await new ClientTransactionTypeFromIdCache({ id: oThis.actionId }).fetch();
    if (cachedResp.isFailure()) {
      return Promise.reject(cachedResp);
    }
    oThis.transactionTypeRecord = cachedResp.data;

    if (oThis.transactionTypeRecord.status !== clientTransactionTypeConst.activeStatus) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_t_et_13',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_transactionkind'],
          debug_options: {}
        })
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Update Transaction log.
   *
   * @param statusString
   * @param failedResponse
   * @returns {*|Promise<any>|Request<DynamoDB.UpdateItemOutput, AWSError>}
   */
  updateParentTransactionLog: function(statusString, failedResponse) {
    const oThis = this,
      transactionLogModel = oThis.ic().getTransactionLogModel(),
      statusInt = transactionLogConst.invertedStatuses[statusString];

    logger.debug('-------------------failedResponse--', failedResponse);
    let dataToUpdate = { transaction_uuid: oThis.transactionUuid, status: statusInt };

    if (oThis.transactionHash) {
      dataToUpdate['transaction_hash'] = oThis.transactionHash;
    }

    if (failedResponse) {
      dataToUpdate['error_code'] = failedResponse.code;
    }

    logger.debug('-------------------dataToUpdate--', dataToUpdate);
    return new transactionLogModel({
      client_id: oThis.clientId,
      shard_name: oThis.ic().configStrategy.TRANSACTION_LOG_SHARD_NAME
    }).updateItem(dataToUpdate);
  },

  /**
   * Execute
   *
   * @return {promise<void>}
   */
  _execute: async function() {
    const oThis = this;

    await oThis.performTransactionSteps().catch(async function(err) {
      let error = null;
      if (responseHelper.isCustomResult(err)) {
        error = err;
      } else {
        error = responseHelper.error({
          internal_error_identifier: 's_t_et_23',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: { err: err }
        });
      }
      logger.error('executeTransaction Caught in Error catch..', error.toHash());
      await oThis.updateParentTransactionLog(transactionLogConst.failedStatus, error.toHash().err);
    });

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Steps to perform when a transaction is executed.
   *
   * @return {Promise<result>}
   */
  performTransactionSteps: async function() {
    const oThis = this;

    // If from user has approved BT once then don't need to approve again
    const needApproveBT = !oThis.userRecords[oThis.fromUuid].properties.includes(
      managedAddressesConst.bTContractApproved
    );

    logger.debug('-1----------------------------needApproveBT-', needApproveBT);
    // If Approval is needed and it failed then don't perform airdrop pay
    if (needApproveBT) {
      // Refill gas of user to approve Airdrop contract
      //transfer estimated gas to approver.
      if (oThis.fromUuid !== oThis.clientBrandedToken.reserve_address_uuid) {
        const refillGasForUserResponse = await oThis.refillGasForUser();
        if (refillGasForUserResponse.isFailure()) return Promise.reject(refillGasForUserResponse);
      }

      const approveForBrandedTokenResponse = await oThis.approveForBrandedToken();
      if (approveForBrandedTokenResponse.isFailure()) return Promise.reject(approveForBrandedTokenResponse);
      logger.debug('-2----------------------------approveForBrandedTokenResponse-', approveForBrandedTokenResponse);
    }

    const setWorkerUserResponse = await oThis.setWorkerUser();
    if (setWorkerUserResponse.isFailure()) return Promise.reject(setWorkerUserResponse);
    logger.debug('-3----------------------------setWorkerUserResponse-', setWorkerUserResponse);
    const sendAirdropPayResponse = await oThis.sendAirdropPay();
    if (sendAirdropPayResponse.isFailure()) return Promise.reject(sendAirdropPayResponse);
    logger.debug('-4----------------------------sendAirdropPayResponse-', sendAirdropPayResponse);
    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Refill gas for user if required for approving airdrop contract.
   *
   * @return {Promise<result>}
   */
  refillGasForUser: async function() {
    const oThis = this,
      TransferStPrimeKlass = oThis.ic().getTransferSTPrimeForApproveClass();

    let inputParams = {
      sender_uuid: oThis.clientBrandedToken.reserve_address_uuid,
      token_erc20_address: oThis.clientBrandedToken.token_erc20_address,
      receiver_uuid: oThis.fromUuid,
      method_args: { amount: approveAmount }
    };
    let refillGasResponse = await new TransferStPrimeKlass(inputParams).perform();

    if (refillGasResponse.isFailure()) {
      await oThis.updateParentTransactionLog(transactionLogConst.failedStatus, refillGasResponse.data['error']);
    }

    return Promise.resolve(refillGasResponse);
  },

  /**
   * user approving airdrop contract for the transfer of branded token to other user.
   *
   * @return {Promise.<void>}
   */
  approveForBrandedToken: async function() {
    const oThis = this,
      ApproveContractKlass = oThis.ic().getApproveContractClass();

    let inputParams = {
      approverUuid: oThis.fromUuid,
      token_erc20_address: oThis.clientBrandedToken.token_erc20_address,
      approvee_address: oThis.clientBrandedToken.airdrop_contract_address,
      return_type: 'txReceipt'
    };

    let approveResponse = await new ApproveContractKlass(inputParams).perform();

    if (approveResponse.isFailure()) {
      await oThis.updateParentTransactionLog(transactionLogConst.failedStatus, approveResponse.data['error']);
    }

    return Promise.resolve(approveResponse);
  },

  /**
   * Set worker user
   *
   * @return {Promise<result>}
   */
  setWorkerUser: async function() {
    const oThis = this,
      ManagedAddressCacheKlass = oThis.ic().getManagedAddressCache();

    if (!oThis.workerUuid) {
      // Decide worker address based on the number of available processIds.
      let index = oThis.fromUserId % oThis.workingProcesses.length;
      oThis.workerUuid = oThis.workingProcesses[index].workerUuid;
    }

    const managedAddressCache = new ManagedAddressCacheKlass({ uuids: [oThis.workerUuid] }),
      cacheFetchResponse = await managedAddressCache.fetch();

    logger.debug('----setWorkerUser---------------------------cacheFetchResponse-', cacheFetchResponse);
    if (cacheFetchResponse.isFailure()) {
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 's_t_et_16',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    logger.debug('----setWorkerUser---------------------------workerUuid-', oThis.workerUuid);
    oThis.workerUser = cacheFetchResponse.data[oThis.workerUuid];

    logger.debug('----setWorkerUser---------------------------oThis.workerUser-', oThis.workerUser);
    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Call Airdrop pay method
   *
   */
  sendAirdropPay: async function() {
    const oThis = this,
      reserveUser = oThis.userRecords[oThis.clientBrandedToken.reserve_address_uuid],
      configStrategy = oThis.ic().configStrategy,
      ostPriceCacheKlass = oThis.ic().getOstPricePointsCache(),
      ClientActiveWorkerUuidCacheKlass = oThis.ic().getClientActiveWorkerUuidCache();

    logger.debug('-3--1--------------------------reserveUser-', reserveUser);
    if (!oThis.workerUser || !reserveUser) {
      await oThis.updateParentTransactionLog(transactionLogConst.failedStatus, {
        code: 's_t_et_22',
        msg: 'Worker or reserve user not found. '
      });
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 's_t_et_14',
          api_error_identifier: 'token_not_setup',
          debug_options: {}
        })
      );
    }

    let ostPrices = await new ostPriceCacheKlass().fetch();
    let ostValue = ostPrices.data[conversionRatesConst.ost_currency()][conversionRatesConst.usd_currency()];

    logger.debug('-3--2--------------------------ostValue-', ostValue);
    let currencyType =
      oThis.transactionTypeRecord.currency_type === conversionRatesConst.usd_currency()
        ? conversionRatesConst.usd_currency()
        : '';

    let currencyValue = oThis.transactionTypeRecord.arbitrary_amount
      ? oThis.amount
      : oThis.transactionTypeRecord.currency_value;

    logger.debug('-3--3--------------------------currencyValue-', currencyValue);
    let commisionAmount = 0;
    if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToUserKind) {
      let commissionPercent = oThis.transactionTypeRecord.arbitrary_commission_percent
        ? oThis.commissionPercent
        : oThis.transactionTypeRecord.commission_percent;

      commisionAmount = basicHelper
        .convertToWei(commissionPercent)
        .mul(basicHelper.convertToWei(currencyValue))
        .div(basicHelper.convertToWei('100'))
        .toString(10);
    }
    logger.debug('-3--4--------------------------commisionAmount-', commisionAmount);

    const payMethodParams = {
      airdrop_contract_address: oThis.clientBrandedToken.airdrop_contract_address,
      chain_id: configStrategy.OST_UTILITY_CHAIN_ID,
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
      options: { tag: oThis.transactionTypeRecord.name, returnType: 'txHash', shouldHandlePostPay: 0 },
      branded_token_address: oThis.clientBrandedToken.token_erc20_address.toLowerCase(),
      airdrop_budget_holder_address: oThis.clientBrandedToken.airdrop_budget_holder_address.toLowerCase()
    };

    const paymentsProvider = oThis.ic().getPaymentsProvider(),
      openSTPayments = paymentsProvider.getInstance(),
      AirdropManagerPayKlass = openSTPayments.services.airdropManager.pay;

    const payObject = new AirdropManagerPayKlass(payMethodParams);

    logger.debug('-3--5--------------------------payMethodParams-', payMethodParams);
    const payResponse = await payObject.perform().catch(function(error) {
      logger.error('execute_transaction.js::airdropPayment.pay::catch');
      logger.error(error);
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 's_t_et_15',
          api_error_identifier: 'token_not_setup',
          debug_options: {}
        })
      );
    });

    logger.debug('-3--6--------------------------payResponse-', payResponse.toHash());

    if (payResponse.isFailure()) {
      const payResponseData = payResponse.toHash();

      //Mark ST Prime balance is low for worker for future transactions.
      if (payResponseData.err.internal_id.includes('l_ci_h_pse_gas_low')) {
        // Mark ST Prime balance is low for worker for future transactions.

        const dbObject = (await new ClientWorkerManagedAddressIdModel()
          .select('id, properties')
          .where({ client_id: oThis.clientId, managed_address_id: oThis.workerUser.id })
          .fire())[0];

        let newPropertiesValue = new ClientWorkerManagedAddressIdModel().unsetBit(
          clientWorkerManagedAddressConst.hasStPrimeBalanceProperty,
          dbObject.properties
        );

        await new ClientWorkerManagedAddressIdModel()
          .update({ properties: newPropertiesValue })
          .where({ id: dbObject.id })
          .fire();

        // Flush worker uuids cache
        new ClientActiveWorkerUuidCacheKlass({ client_id: oThis.clientId }).clear();
      }

      return Promise.reject(payResponse);
    }

    oThis.transactionHash = payResponse.data.transaction_hash;

    // insert into transaction meta table
    await new TransactionMetaModel().insertRecord({
      transaction_hash: oThis.transactionHash,
      kind: new TransactionMetaModel().invertedKinds[transactionLogConst.tokenTransferTransactionType],
      client_id: oThis.clientId,
      chain_id: configStrategy.OST_UTILITY_CHAIN_ID,
      transaction_uuid: oThis.transactionUuid,
      post_receipt_process_params: JSON.stringify(payResponse.data.post_receipt_process_params)
    });

    await oThis.updateParentTransactionLog(transactionLogConst.waitingForMiningStatus);

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

InstanceComposer.registerShadowableClass(TransferBt, 'getTransferBtClass');

module.exports = TransferBt;

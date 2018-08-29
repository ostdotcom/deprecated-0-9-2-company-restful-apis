'use strict';

/**
 * Deploy airdrop contract
 *  - deploy airdrop contract
 *  - setops(utility ops address) to airdrop contract
 *  - register airdrop contract address
 *
 * @module lib/on_boarding/deploy_airdrop
 *
 */

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log'),
  criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  OnBoardingRouter = require(rootPrefix + '/lib/on_boarding/router'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

require(rootPrefix + '/lib/providers/payments');
require(rootPrefix + '/app/services/token_management/edit');

/**
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.critical_interaction_log_id - id of deploy airdrop contract row
 * @param {number} params.parent_critical_interaction_log_id - id of propose bt row
 *
 */
const SetupAirdropContractClass = function(params) {
  const oThis = this;

  oThis.criticalChainInteractionLogId = parseInt(params.critical_interaction_log_id);
  oThis.parentCriticalInteractionLogId = parseInt(params.parent_critical_interaction_log_id);
  oThis.criticalChainInteractionLog = null;
  oThis.parentCriticalChainInteractionLog = null;

  oThis.clientId = null;
  oThis.clientTokenId = null;
  oThis.tokenSymbol = null;
  oThis.brandedTokenId = null;
  oThis.brandedTokenAddress = null;
  oThis.airdropBudgetHolderAddr = null;
  oThis.airdropContractAddress = null;
  oThis.reserveUuid = null;
};

SetupAirdropContractClass.prototype = {
  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: async function() {
    const oThis = this,
      r = null;

    return oThis.asyncPerform().catch(function(error) {
      let errorObj = null;
      // something unhandled happened
      logger.error('lib/on_boarding/deploy_airdrop.js::perform::catch');
      logger.error(error);

      if (responseHelper.isCustomResult(error)) {
        errorObj = error;
      } else {
        errorObj = responseHelper.error({
          internal_error_identifier: 'l_ob_da_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: { error: error, clientId: oThis.clientId },
          error_config: errorConfig
        });
      }

      if (oThis.criticalChainInteractionLog) {
        oThis.updateCriticalChainInteractionLog(oThis.criticalChainInteractionLog.id, {
          status: new CriticalChainInteractionLogModel().invertedStatuses[
            criticalChainInteractionLogConst.failedStatus
          ],
          response_data: errorObj.toHash()
        });
      }

      return errorObj;
    });
  },

  /**
   * Async perform
   *
   * @return {promise<result>}
   */
  asyncPerform: async function() {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy;

    await oThis.setCriticalChainInteractionLog();

    oThis.updateCriticalChainInteractionLog(oThis.criticalChainInteractionLog.id, {
      status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.pendingStatus]
    });

    await oThis.getAddresses();

    await oThis.deployAirdrop();

    await oThis.registerAirdrop();

    await oThis.setopsAirdrop();

    await new OnBoardingRouter({
      current_step: 'deploy_airdrop',
      status: 'done',

      chain_id: configStrategy.OST_UTILITY_CHAIN_ID,
      token_symbol: oThis.parentCriticalChainInteractionLog.request_params.token_symbol,
      client_id: oThis.clientId,
      client_token_id: oThis.criticalChainInteractionLog.client_token_id,
      parent_critical_interaction_log_id: oThis.parentCriticalChainInteractionLog.id,
      client_branded_token_id: oThis.criticalChainInteractionLog.client_branded_token_id
    }).perform();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * set critical chain interaction log <br><br>
   *
   * @return {promise<result>}
   *
   */
  setCriticalChainInteractionLog: async function() {
    const oThis = this,
      criticalChainInteractionLogs = await new CriticalChainInteractionLogModel().getByIds([
        oThis.criticalChainInteractionLogId,
        oThis.parentCriticalInteractionLogId
      ]),
      criticalChainInteractionLog = criticalChainInteractionLogs[oThis.criticalChainInteractionLogId],
      parentCriticalChainInteractionLog = criticalChainInteractionLogs[oThis.parentCriticalInteractionLogId];

    if (!criticalChainInteractionLog) {
      const errorRsp = responseHelper.error({
        internal_error_identifier: 'l_ob_da_2',
        api_error_identifier: 'no_data_found',
        error_config: errorConfig
      });
      return Promise.reject(errorRsp);
    }

    if (!parentCriticalChainInteractionLog) {
      const errorRsp = responseHelper.error({
        internal_error_identifier: 'l_ob_da_3',
        api_error_identifier: 'no_data_found',
        error_config: errorConfig
      });
      return Promise.reject(errorRsp);
    }

    oThis.criticalChainInteractionLog = criticalChainInteractionLog;
    oThis.parentCriticalChainInteractionLog = parentCriticalChainInteractionLog;

    oThis.brandedTokenId = oThis.criticalChainInteractionLog.client_branded_token_id;
    oThis.clientId = oThis.criticalChainInteractionLog.client_id;
    oThis.clientTokenId = oThis.criticalChainInteractionLog.client_token_id;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * validate and fetch required data from db.
   *
   * sets brandedTokenAddress, reserveUuid, airdropBudgetHolderAddr
   *
   * @return {promise<result>}
   */
  getAddresses: async function() {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy;

    if (!oThis.brandedTokenId || !oThis.clientId) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_da_4',
          api_error_identifier: 'invalid_params',
          error_config: errorConfig
        })
      );
    }

    if (!configStrategy.OST_UTILITY_WORKERS_CONTRACT_ADDRESS) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_da_5',
          api_error_identifier: 'workers_contract_not_found',
          error_config: errorConfig
        })
      );
    }

    oThis._criticalLogDebug('* Fetching Client Branded Token details', 'debug');
    const clientBrandedToken = await new ClientBrandedTokenModel()
      .select('*')
      .where(['id=?', oThis.brandedTokenId])
      .fire();

    const brandedToken = clientBrandedToken[0];

    oThis.tokenSymbol = brandedToken.symbol;

    if (brandedToken.client_id !== oThis.clientId) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_da_6',
          api_error_identifier: 'unauthorized_for_other_client',
          error_config: errorConfig
        })
      );
    }
    oThis.brandedTokenAddress = brandedToken.token_erc20_address;

    if (!oThis.brandedTokenAddress) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_da_7',
          api_error_identifier: 'branded_token_contract_not_found',
          error_config: errorConfig
        })
      );
    }
    oThis.reserveUuid = brandedToken.reserve_address_uuid;

    oThis._criticalLogDebug('* Fetching managed addresses', 'debug');
    const airdropHolderManagedAddressId = brandedToken.airdrop_holder_managed_address_id,
      managedAddresses = await new ManagedAddressModel().getByIds([airdropHolderManagedAddressId]);

    oThis.airdropBudgetHolderAddr = managedAddresses[0].ethereum_address;

    if (!oThis.airdropBudgetHolderAddr) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_da_8',
          api_error_identifier: 'airdrop_holder_address_not_found',
          error_config: errorConfig
        })
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * deploy airdrop contract.
   *
   * @return {promise<result>}
   */
  deployAirdrop: async function() {
    const oThis = this,
      paymentsProvider = oThis.ic().getPaymentsProvider(),
      EditTokenKlass = oThis.ic().getEditBrandedTokenKlass(),
      configStrategy = oThis.ic().configStrategy,
      openSTPayments = paymentsProvider.getInstance(),
      AirdropDeployerKlass = openSTPayments.services.deploy.airdrop;

    const airdropDeployerObj = new AirdropDeployerKlass({
      branded_token_contract_address: oThis.brandedTokenAddress,
      base_currency: 'OST',
      worker_contract_address: configStrategy.OST_UTILITY_WORKERS_CONTRACT_ADDRESS,
      airdrop_budget_holder: oThis.airdropBudgetHolderAddr,
      gas_price: configStrategy.OST_UTILITY_GAS_PRICE,
      options: { returnType: 'txReceipt' }
    });

    oThis._criticalLogDebug('* Performing Deploy airdrop', 'step');
    const airdropDeployerResponse = await airdropDeployerObj.perform();

    if (airdropDeployerResponse.isFailure()) {
      return Promise.reject(airdropDeployerResponse);
    }

    logger.debug(airdropDeployerResponse);

    oThis._criticalLogDebug('* Updating Critical chain interaction log', 'debug');
    oThis.updateCriticalChainInteractionLog(oThis.criticalChainInteractionLog.id, {
      status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.processedStatus],
      response_data: airdropDeployerResponse.toHash(),
      transaction_hash: airdropDeployerResponse.data.transaction_receipt.transactionHash
    });

    oThis.airdropContractAddress = airdropDeployerResponse.data.transaction_receipt.contractAddress;
    if (!oThis.airdropContractAddress) {
      const errorRsp = responseHelper.error({
        internal_error_identifier: 'l_ob_da_9',
        api_error_identifier: 'airdrop_contract_not_found',
        debug_options: { data: airdropDeployerResponse.data },
        error_config: errorConfig
      });
      return Promise.reject(errorRsp);
    }

    const editTokenParams = {
      symbol: oThis.tokenSymbol,
      client_id: oThis.criticalChainInteractionLog.client_id,
      airdrop_contract_addr: oThis.airdropContractAddress
    };

    oThis._criticalLogDebug('* Performing edit token', 'step');
    const editTokenObj = new EditTokenKlass(editTokenParams),
      editTokenRsp = await editTokenObj.perform();

    if (editTokenRsp.isFailure()) {
      return Promise.reject(editTokenRsp);
    }

    return Promise.resolve(airdropDeployerResponse);
  },

  /**
   * register airdrop contract.
   *
   * @return {promise<result>}
   */
  registerAirdrop: async function() {
    const oThis = this,
      paymentsProvider = oThis.ic().getPaymentsProvider(),
      configStrategy = oThis.ic().configStrategy,
      openSTPayments = paymentsProvider.getInstance(),
      RegisterAirdropKlass = openSTPayments.services.airdropManager.registerAirdrop;

    const registerObject = new RegisterAirdropKlass({
      airdrop_contract_address: oThis.airdropContractAddress,
      chain_id: configStrategy.OST_UTILITY_CHAIN_ID
    });
    oThis._criticalLogDebug('* Performing register airdrop', 'step');
    return registerObject.perform();
  },

  /**
   * setops(utility_ops_address) to airdrop contract.
   *
   * @return {promise<result>}
   */
  setopsAirdrop: async function() {
    const oThis = this,
      paymentsProvider = oThis.ic().getPaymentsProvider(),
      configStrategy = oThis.ic().configStrategy,
      openSTPayments = paymentsProvider.getInstance(),
      SetOpsKlass = openSTPayments.services.opsManaged.setOps,
      insertRsp = await oThis.insertCriticalChainInteractionLog(),
      airdropSetOpsId = insertRsp.data.insertId;

    const setOpsObject = new SetOpsKlass({
      contract_address: oThis.airdropContractAddress,
      gas_price: configStrategy.OST_UTILITY_GAS_PRICE,
      chain_id: configStrategy.OST_UTILITY_CHAIN_ID,
      deployer_address: configStrategy.OST_UTILITY_DEPLOYER_ADDR,
      deployer_passphrase: configStrategy.OST_UTILITY_DEPLOYER_PASSPHRASE,
      ops_address: configStrategy.OST_UTILITY_OPS_ADDR,
      options: { returnType: 'txReceipt' }
    });

    oThis._criticalLogDebug('* Performing setOps', 'step');
    const setOpsResponse = await setOpsObject.perform();

    if (setOpsResponse.isFailure()) {
      return Promise.reject(setOpsResponse);
    }

    oThis._criticalLogDebug('* Updating critical chain interaction log', 'debug');
    oThis.updateCriticalChainInteractionLog(airdropSetOpsId, {
      status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.processedStatus],
      response_data: setOpsResponse.toHash(),
      transaction_hash: setOpsResponse.data.transaction_receipt.transactionHash
    });

    return Promise.resolve(setOpsResponse);
  },

  /**
   * update critical chain interaction log <br><br>
   *
   * @return {promise<result>}
   *
   */
  updateCriticalChainInteractionLog: async function(idToUpdate, dataToUpdate) {
    const oThis = this;

    if (!dataToUpdate.response_data) {
      dataToUpdate.response_data = '{}';
    } else {
      dataToUpdate.response_data = JSON.stringify(dataToUpdate.response_data);
    }

    await new CriticalChainInteractionLogModel()
      .update(dataToUpdate)
      .where({ id: idToUpdate })
      .fire();

    new CriticalChainInteractionLogModel().flushTxStatusDetailsCache(oThis.parentCriticalInteractionLogId);

    new CriticalChainInteractionLogModel().flushPendingTxsCache(oThis.criticalChainInteractionLog.client_token_id);

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * insert critical chain interaction log <br><br>
   *
   * @return {promise<result>}
   *
   */
  insertCriticalChainInteractionLog: async function() {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy,
      chainType = new CriticalChainInteractionLogModel().invertedChainTypes[
        criticalChainInteractionLogConst.utilityChainType
      ],
      status = new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.pendingStatus],
      activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.setopsAirdropActivityType
      ];

    const createParams = {
      chain_id: configStrategy.OST_UTILITY_CHAIN_ID,
      parent_id: oThis.parentCriticalInteractionLogId,
      client_id: oThis.clientId,
      client_token_id: oThis.clientTokenId,
      client_branded_token_id: oThis.brandedTokenId,
      activity_type: activityType,
      chain_type: chainType,
      status: status,
      request_params: {}
    };

    const dbRecordResponse = await new CriticalChainInteractionLogModel().insertRecord(createParams),
      dbRecord = dbRecordResponse.data.dbRecord;

    return Promise.resolve(responseHelper.successWithData({ insertId: dbRecord.insertId }));
  },

  _criticalLogDebug: function(message, messageKind) {
    const oThis = this;
    let parentId = oThis.parentCriticalInteractionLogId || '-';
    logger[messageKind].apply(logger, ['[p' + parentId + '][s' + oThis.criticalChainInteractionLogId + ']', message]);
  }
};

InstanceComposer.registerShadowableClass(SetupAirdropContractClass, 'getSetupAirdropContractClass');

module.exports = SetupAirdropContractClass;

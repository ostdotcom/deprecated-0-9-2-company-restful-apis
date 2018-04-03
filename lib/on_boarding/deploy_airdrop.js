"use strict";

/**
 * Deploy airdrop contract
 *  - deploy airdrop contract
 *  - setops(utility ops address) to airdrop contract
 *  - register airdrop contract address
 *
 * @module lib/on_boarding/deploy_airdrop
 *
 */

const openStPayments = require('@openstfoundation/openst-payments')
  , AirdropDeployerKlass = openStPayments.services.deploy.airdrop
  , SetOpsKlass = openStPayments.services.opsManaged.setOps
  , RegisterAirdropKlass = openStPayments.services.airdropManager.registerAirdrop
;

const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log')
  , criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log')
  , EditTokenKlass = require(rootPrefix + '/app/services/token_management/edit')
  , utils = require(rootPrefix + '/lib/util')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , OnBoardingRouter = require(rootPrefix + '/lib/on_boarding/router')
;


/**
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.critical_interaction_log_id - id of deploy airdrop contract row
 * @param {number} params.parent_critical_interaction_log_id - id of propose bt row
 *
 */
const SetupAirdropContractClass = function (params) {

  const oThis = this;

  oThis.criticalChainInteractionLogId = parseInt(params.critical_interaction_log_id);
  oThis.parentCriticalInteractionLogId = parseInt(params.parent_critical_interaction_log_id);
  oThis.criticalChainInteractionLog = null;
  oThis.parentCriticalChainInteractionLog = null;

  oThis.workerContractAddress = chainIntConstants.UTILITY_WORKERS_CONTRACT_ADDRESS;
  oThis.gasPrice = chainIntConstants.UTILITY_GAS_PRICE;
  oThis.utilityDeployerAddress = chainIntConstants.UTILITY_DEPLOYER_ADDR;
  oThis.utilityDeployerPassphrase = chainIntConstants.UTILITY_DEPLOYER_PASSPHRASE;
  oThis.utilityOpsAddress = chainIntConstants.UTILITY_OPS_ADDR;
  oThis.chainId = chainIntConstants.UTILITY_CHAIN_ID;

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
  perform: async function () {
    const oThis = this
      , r = null
    ;

    return oThis.asyncPerform()
        .catch(function (error) {

          var errorObj = null;

          if(responseHelper.isCustomResult(error)) {

            errorObj = error;

          } else {

            // something unhandled happened
            logger.error('lib/on_boarding/deploy_airdrop.js::perform::catch');
            logger.error(error);

            errorObj = responseHelper.error("l_snm_p_1", "Inside catch block", null, {error: error}, {sendErrorEmail: true});

          }

          if (oThis.criticalChainInteractionLog) {
            oThis.updateCriticalChainInteractionLog(
              oThis.criticalChainInteractionLog.id,
              {
                status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.failedStatus],
                response_data: errorObj.toHash()
              }
            );
          }

          return errorObj;
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
  setCriticalChainInteractionLog: async function () {

    const oThis = this
        , criticalChainInteractionLogs = await new CriticalChainInteractionLogModel().getByIds([
            oThis.criticalChainInteractionLogId,
            oThis.parentCriticalInteractionLogId
          ])
        , criticalChainInteractionLog = criticalChainInteractionLogs[oThis.criticalChainInteractionLogId]
        , parentCriticalChainInteractionLog = criticalChainInteractionLogs[oThis.parentCriticalInteractionLogId]
    ;

    if (!criticalChainInteractionLog) {
      const errorRsp = responseHelper.error(
          "l_snm_p_2", "criticalChainInteractionLog not found",
          null, {}, {sendErrorEmail: false}
      );
      return Promise.reject(errorRsp);
    }

    if (!parentCriticalChainInteractionLog) {
      const errorRsp = responseHelper.error(
          "l_snm_p_3", "parentCriticalChainInteractionLog not found",
          null, {}, {sendErrorEmail: false}
      );
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
  getAddresses: async function () {

    var oThis = this;

    if (!oThis.brandedTokenId || !oThis.clientId) {
      return Promise.reject(responseHelper.error('l_am_s_2', 'Mandatory params missing.'));
    }

    if (!oThis.workerContractAddress) {
      return Promise.reject(responseHelper.error('l_am_s_1', 'Mandatory to have Workers contract deployed.'));
    }

    const clientBrandedToken = await new ClientBrandedTokenModel().select('*').where(['id=?', oThis.brandedTokenId]).fire();

    const brandedToken = clientBrandedToken[0];

    oThis.tokenSymbol = brandedToken.symbol;

    if (brandedToken.client_id != oThis.clientId) {
      return Promise.reject(responseHelper.error('l_am_s_1', 'Unauthorised request'));
    }
    oThis.brandedTokenAddress = brandedToken.token_erc20_address;

    if (!oThis.brandedTokenAddress) {
      return Promise.reject(responseHelper.error('l_am_s_1', 'Mandatory to have Branded token contract deployed.'));
    }
    oThis.reserveUuid = brandedToken.reserve_address_uuid;

    const airdropHolderManagedAddressId = brandedToken.airdrop_holder_managed_address_id
      , managedAddressInstance = new ManagedAddressKlass()
      , managedAddresses = await managedAddressInstance.getByIds([airdropHolderManagedAddressId]);

    oThis.airdropBudgetHolderAddr = managedAddresses[0].ethereum_address;

    if (!oThis.airdropBudgetHolderAddr) {
      return Promise.reject(responseHelper.error('l_am_s_1', 'Airdrop budget holder address is mandatory.'));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * deploy airdrop contract.
   *
   * @return {promise<result>}
   */
  deployAirdrop: async function () {

    const oThis = this;

    const airdropDeployerObj = new AirdropDeployerKlass({
      branded_token_contract_address: oThis.brandedTokenAddress,
      base_currency: 'OST',
      worker_contract_address: oThis.workerContractAddress,
      airdrop_budget_holder: oThis.airdropBudgetHolderAddr,
      gas_price: oThis.gasPrice,
      options: {returnType: 'txReceipt'}
    });

    const airdropDeployerResponse = await airdropDeployerObj.perform();

    if (airdropDeployerResponse.isFailure()) {
      return Promise.reject(airdropDeployerResponse);
    }

    console.log(JSON.stringify(airdropDeployerResponse));

    oThis.updateCriticalChainInteractionLog(oThis.criticalChainInteractionLog.id, {
      status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.processedStatus],
      response_data: airdropDeployerResponse.toHash(),
      transaction_hash: airdropDeployerResponse.data.transaction_receipt.transactionHash
    });

    oThis.airdropContractAddress = airdropDeployerResponse.data.transaction_receipt.contractAddress;
    if (!oThis.airdropContractAddress) {
      const errorRsp = responseHelper.error(
          'l_am_s_2', 'Airdrop contract address not found from deploy receipt',
          null, {data: airdropDeployerResponse.data}
      );
      return Promise.reject(errorRsp);
    }

    const editTokenParams = {
      symbol: oThis.tokenSymbol,
      client_id: oThis.criticalChainInteractionLog.client_id,
      airdrop_contract_addr: oThis.airdropContractAddress
    };

    const editTokenObj = new EditTokenKlass(editTokenParams)
        , editTokenRsp = await editTokenObj.perform();

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
  registerAirdrop: async function () {

    const oThis = this;

    const registerObject = new RegisterAirdropKlass({
      airdrop_contract_address: oThis.airdropContractAddress,
      chain_id: oThis.chainId
    });

    return registerObject.perform();

  },

  /**
   * setops(utility_ops_address) to airdrop contract.
   *
   * @return {promise<result>}
   */
  setopsAirdrop: async function () {

    const oThis = this
        , insertRsp = await oThis.insertCriticalChainInteractionLog()
        , airdropSetOpsId = insertRsp.data.insertId
    ;

    const setOpsObject = new SetOpsKlass({
      contract_address: oThis.airdropContractAddress,
      gas_price: oThis.gasPrice,
      chain_id: oThis.chainId,
      deployer_address: oThis.utilityDeployerAddress,
      deployer_passphrase: oThis.utilityDeployerPassphrase,
      ops_address: oThis.utilityOpsAddress,
      options: {returnType: 'txReceipt'}
    });

    const setOpsResponse = await setOpsObject.perform();

    if(setOpsResponse.isFailure()){
      return Promise.reject(setOpsResponse);
    }

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
  updateCriticalChainInteractionLog: async function (idToUpdate, dataToUpdate) {

    const oThis = this;

    if (!dataToUpdate.response_data) {
      dataToUpdate.response_data = '{}';
    } else {
      dataToUpdate.response_data = JSON.stringify(dataToUpdate.response_data);
    }

    await new CriticalChainInteractionLogModel().update(dataToUpdate).where({id: idToUpdate}).fire();

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
  insertCriticalChainInteractionLog: async function () {

    const oThis = this
      , criticalChainInteractionLogModelObj = new CriticalChainInteractionLogModel()
      , chainType = criticalChainInteractionLogModelObj.invertedChainTypes[criticalChainInteractionLogConst.utilityChainType]
      , status = criticalChainInteractionLogModelObj.invertedStatuses[criticalChainInteractionLogConst.pendingStatus]
      , activityType = criticalChainInteractionLogModelObj.invertedActivityTypes[
        criticalChainInteractionLogConst.setopsAirdropActivityType]
    ;

    const createParams = {
      parent_id: oThis.parentCriticalInteractionLogId,
      client_id: oThis.clientId,
      client_token_id: oThis.clientTokenId,
      client_branded_token_id: oThis.brandedTokenId,
      activity_type: activityType,
      chain_type: chainType,
      status: status,
      request_params: {}
    };

    const dbRecord = await criticalChainInteractionLogModelObj.insertRecord(createParams);

    return Promise.resolve(responseHelper.successWithData({insertId: dbRecord.insertId}));

  }

};

module.exports = SetupAirdropContractClass;
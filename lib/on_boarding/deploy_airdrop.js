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
  , openStPaymentsDeployer = new openStPayments.deployer()
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

  oThis.criticalChainInteractionLogId = params.critical_interaction_log_id;
  oThis.parentCriticalInteractionLogId = params.parent_critical_interaction_log_id;
  oThis.criticalChainInteractionLog = null;
  oThis.parentCriticalChainInteractionLog = null;

  oThis.contractName = 'airdrop';
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
            oThis.updateCriticalChainInteractionLog({
              status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.failedStatus],
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
  asyncPerform: async function () {

    const oThis = this
    ;

    var r = null
    ;

    r = await oThis.setCriticalChainInteractionLog();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.getAddresses();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.deployAirdrop();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.registerAirdrop();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.setopsAirdrop();
    if (r.isFailure()) return Promise.resolve(r);

    return Promise.resolve(r);

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
      return responseHelper.error("l_snm_p_2", "criticalChainInteractionLog not found", null, {}, {sendErrorEmail: false});
    }

    if (!parentCriticalChainInteractionLog) {
      return responseHelper.error("l_snm_p_3", "parentCriticalChainInteractionLog not found", null, {}, {sendErrorEmail: false});
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

    const clientBrandedToken = await new ClientBrandedTokenModel().select('*').where(['id=?', oThis.brandedTokenId]);

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

    const constructorArgs = [
      oThis.brandedTokenAddress,
      utils.asciiToHex('OST'),
      oThis.workerContractAddress,
      oThis.airdropBudgetHolderAddr
    ];

    var r = await openStPaymentsDeployer.deploy(
      oThis.contractName,
      constructorArgs,
      oThis.gasPrice,
      {returnType: "txReceipt", tag: ""}
    );

    if (r.isFailure()) {
      var errorRsp = responseHelper.error('l_am_s_1', 'Airdrop contract deployment failed.', {error: r.toHash()}, {},
          {sendErrorEmail: false});
      oThis.updateCriticalChainInteractionLog(oThis.criticalChainInteractionLog.id, {
        status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.failedStatus],
        response_data: r.toHash()
      });
      return Promise.reject(errorRsp);
    }

    oThis.updateCriticalChainInteractionLog(oThis.criticalChainInteractionLog.id, {
      status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.processedStatus],
      response_data: r.toHash()
    });

    oThis.airdropContractAddress = r.data.transaction_receipt.contractAddress;
    if (!oThis.airdropContractAddress) {
      return Promise.resolve(responseHelper.error('l_am_s_2', 'Airdrop contract address not found from deploy receipt'));
    }

    const editTokenParams = {
      symbol: oThis.tokenSymbol,
      client_id: oThis.criticalChainInteractionLog.client_id,
      airdrop_contract_addr: oThis.airdropContractAddress
    };

    const editTokenObj = new EditTokenKlass(editTokenParams)
        , editTokenRsp = await editTokenObj.perform();

    return Promise.resolve(r);

  },

  /**
   * register airdrop contract.
   *
   * @return {promise<result>}
   */
  registerAirdrop: async function () {
    var oThis = this;
    return openStPayments.airdropManager.registerAirdrop(oThis.airdropContractAddress, oThis.chainId);
  },

  /**
   * setops(utility_ops_address) to airdrop contract.
   *
   * @return {promise<result>}
   */
  setopsAirdrop: async function () {

    const oThis = this
        , insertRsp = await oThis.insertCriticalChainInteractionLog()
        , airdropSetOpsId = insertRsp.insertId
    ;

    const opsManaged = new openStPayments.opsManaged(oThis.airdropContractAddress, oThis.gasPrice, oThis.chainId);

    var r = await opsManaged.setOpsAddress(
      oThis.utilityDeployerAddress,
      oThis.utilityDeployerPassphrase,
      oThis.utilityOpsAddress,
      {returnType: "txReceipt", tag: ''}
    );

    if(r.isFailure()){
      oThis.updateCriticalChainInteractionLog(airdropSetOpsId, {
        status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.failedStatus],
        response_data: r.toHash()
      });
      return Promise.resolve(responseHelper.error('l_am_s_1', 'Setops airdrop contract failed.'));
    }

    oThis.updateCriticalChainInteractionLog(airdropSetOpsId, {
      status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.processedStatus],
      response_data: r.toHash()
    });

    return Promise.resolve(r);

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
      client_branded_token_id: oThis.clientBrandedTokenId,
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
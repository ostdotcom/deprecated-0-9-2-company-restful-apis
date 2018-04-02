"use strict";

/**
 *
 * Start Airdrop for a client token by subscribing to RMQ events.<br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/start
 *
 */

const openSTNotification = require('@openstfoundation/openst-notification');

const rootPrefix = '../../..'
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , ClientAirdropModel = require(rootPrefix + '/app/models/client_airdrop')
  , TokenTransferKlass = require(rootPrefix + '/lib/airdrop_management/distribute_tokens/token_transfer')
  , ContractApproveKlass = require(rootPrefix + '/lib/airdrop_management/distribute_tokens/contract_approve')
  , AllocateTokenKlass = require(rootPrefix + '/lib/airdrop_management/distribute_tokens/allocate_token')
  , AllAddressesKlass = require(rootPrefix + '/lib/airdrop_management/distribute_tokens/to_addresses/all')
  , ApproveContractKlass = require(rootPrefix + '/lib/transactions/approve_contract')
  , NeverAirdroppedAddressesKlass = require(rootPrefix + '/lib/airdrop_management/distribute_tokens/to_addresses/never_airdropped')
  , clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop')
  , CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log')
  , criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 * Start Airdrop constructor
 *
 * @param {object} params -
 * @param {number} params.client_airdrop_id - client airdrop id for which airdrop has to be done
 * @param {number} params.critical_chain_interaction_log_id - Critical chain interactions log id.
 *
 * @constructor
 *
 */
const startKlass = function (params) {

  const oThis = this
  ;

  oThis.clientAirdropId = params.client_airdrop_id;
  oThis.criticalInteractionLogId = params.critical_chain_interaction_log_id;
  oThis.criticalInteractionLog = null;

  oThis.clientAirdrop = new ClientAirdropModel();
  oThis.criticalChIntLogObj = new CriticalChainInteractionLogModel();

  oThis.clientAirdropObj = null;
  oThis.tokensTransferedTransactionHash = null;
  oThis.contractApproveTransactionHash = null;

};

startKlass.prototype = {

  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch(async function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error("lib/airdrop_management/distribute_tokens/start.js::perform::catch");
          logger.error(error);

          await oThis.markCriticalLogFailure(error);
          return responseHelper.error("am_dt_s_p_1", "Unhandled result", null, [error], {});
        }
      });
  },

  /**
   * Start the airdrop
   *
   * @returns {Promise<result>}
   */
  asyncPerform: async function () {

    const oThis = this
    ;

    var r = null;

    r = await oThis._setClientAirdropObj();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis._addClientAirdropDetails();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis._startTokenTransfer();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis._startContractApprove();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis._allocateTokenToAddresses();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis._markCompleteStatus();
    if (r.isFailure()) return Promise.resolve(r);

    await oThis.approveReserveForAirdropContract();

    await oThis.enqueueUserApprovalJob();

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   *
   * Mark critical log as failure.
   *
   * @param errResponse
   *
   * @return {Promise.<>}
   */
  markCriticalLogFailure: async function (errResponse) {
    const oThis = this;

    return await new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
      oThis.criticalInteractionLogId,
      {
        status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.failedStatus],
        response_data: JSON.stringify(errResponse)
      },
      oThis.criticalInteractionLog.parent_id,
      oThis.criticalInteractionLog.client_token_id
    );

  },


  /**
   * Set the required client airdrop db object and update it's status to processing
   *
   * @returns {Promise<result>}
   * @private
   */
  _setClientAirdropObj: async function () {

    const oThis = this
    ;

    const airdrop_result = await new ClientAirdropModel().select('*').where({id: oThis.clientAirdropId}).fire();
    oThis.clientAirdropObj = airdrop_result[0];

    if (oThis.clientAirdropObj.status !== parseInt(oThis.clientAirdrop.invertedStatuses[clientAirdropConst.incompleteStatus])) {
      logger.notify('am_dt_s_scao_1', 'Invalid status for airdrop.', {client_airdrop_id: oThis.clientAirdropObj.id});
      return Promise.resolve(responseHelper.error('am_dt_s_scao_1', 'Invalid status for airdrop.'));
    }

    const criticalInteractionLogRecord = await new CriticalChainInteractionLogModel().select('*').where({id: oThis.criticalInteractionLogId}).fire();
    oThis.criticalInteractionLog = criticalInteractionLogRecord[0];
    oThis.criticalInteractionLogParentId = oThis.criticalInteractionLog.parent_id || oThis.criticalInteractionLog.id;

    await new ClientAirdropModel()
      .update({status: oThis.clientAirdrop.invertedStatuses[clientAirdropConst.processingStatus]})
      .where({id: oThis.clientAirdropId}).fire();

    await new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
      oThis.criticalInteractionLogId,
      {
        status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.pendingStatus]
      },
      oThis.criticalInteractionLogParentId,
      oThis.criticalInteractionLog.client_token_id
    );

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Check if airdrop details exists or not. If not present, fetch and populate them as per filters.
   *
   * @returns {Promise<result>}
   * @private
   */
  _addClientAirdropDetails: async function () {
    const oThis = this
    ;

    if (oThis.clientAirdrop.isBitSet(clientAirdropConst.usersIdentifiedStepComplete, oThis.clientAirdropObj.steps_complete)) {
      logger.notify('am_s_1', 'Invalid state for airdrop. user_identifed step already done', {client_airdrop_id: oThis.clientAirdropObj.id});
      return Promise.reject(responseHelper.error('am_dt_s_acad_1', 'Invalid state for airdrop. user_identifed step already done',
        null, {}, {sendErrorEmail: false}));
    }

    var airdropToAddressesKlass = null;
    if (oThis.clientAirdropObj.airdrop_list_type === parseInt(oThis.clientAirdrop.invertedAirdropListType[clientAirdropConst.allAddressesAirdropListType])) {
      airdropToAddressesKlass = AllAddressesKlass;
    } else if (oThis.clientAirdropObj.airdrop_list_type === parseInt(oThis.clientAirdrop.invertedAirdropListType[clientAirdropConst.neverAirdroppedAddressesAirdropListType])) {
      airdropToAddressesKlass = NeverAirdroppedAddressesKlass;
    }

    const airdropToAddresses = new airdropToAddressesKlass({client_airdrop_obj: oThis.clientAirdropObj}),
      response = await airdropToAddresses.perform();

    if (response.isFailure()) {
      await oThis._updateFailedStatusClientAirdropObj(response);
    } else {
      await oThis._updateStepCompleteForClientAirdropObj(clientAirdropConst.usersIdentifiedStepComplete);
    }

    return Promise.resolve(response);
  },

  /**
   * Transfer airdrop tokens from reserve address to budget holder address
   *
   * @returns {Promise<response>}
   * @private
   */
  _startTokenTransfer: async function () {
    const oThis = this
      , tokenTransfer = new TokenTransferKlass({
        client_branded_token_id: oThis.clientAirdropObj.client_branded_token_id,
        client_airdrop_id: oThis.clientAirdropId
      })
    ;

    logger.info('Starting Airdrop Token Transfer for ', oThis.clientAirdropId);

    const response = await tokenTransfer.perform();

    if (response.isFailure()) {
      await oThis._updateFailedStatusClientAirdropObj(response);
    } else {
      oThis.tokensTransferedTransactionHash = response.data.transaction_hash;
      await oThis._updateStepCompleteForClientAirdropObj(clientAirdropConst.tokensTransferedStepComplete);
    }

    return Promise.resolve(response);
  },

  /**
   * Budget holder address approve to airdrop contract
   *
   * @returns {Promise<response>}
   * @private
   */
  _startContractApprove: async function () {
    const oThis = this
      , contractApprove = new ContractApproveKlass({
        client_branded_token_id: oThis.clientAirdropObj.client_branded_token_id,
        client_airdrop_id: oThis.clientAirdropId
      })
    ;
    logger.info('Started Airdrop Contract Approve for ', oThis.clientAirdropId);

    const response = await contractApprove.perform();

    if (response.isFailure()) {
      await oThis._updateFailedStatusClientAirdropObj(response);
    } else {
      oThis.contractApproveTransactionHash = response.data.transaction_hash;
      await oThis._updateStepCompleteForClientAirdropObj(clientAirdropConst.contractApprovedStepComplete);
    }

    return Promise.resolve(response);
  },

  /**
   * Allocate tokens to Partner company user addresses
   *
   * @returns {Promise<result>}
   * @private
   */
  _allocateTokenToAddresses: async function () {
    const oThis = this
      , allocateToken = new AllocateTokenKlass({
        client_airdrop_id: oThis.clientAirdropId,
        client_branded_token_id: oThis.clientAirdropObj.client_branded_token_id,
        token_transferred_transaction_hash: oThis.tokensTransferedTransactionHash
      })
    ;

    logger.info('Started Airdrop Allocate Token for ', oThis.clientAirdropId);

    const response = await allocateToken.perform();

    if (response.isFailure()) {
      await oThis._updateFailedStatusClientAirdropObj(response);
    } else {
      await oThis._updateStepCompleteForClientAirdropObj(clientAirdropConst.allocationDoneStepComplete);
    }

    return Promise.resolve(response);
  },

  /**
   * Update airdrop token distribution completed step in database
   *
   * @param {string} step_name - step completed
   *
   * @returns {Promise<result>}
   * @private
   */
  _updateStepCompleteForClientAirdropObj: async function (step_name) {
    const oThis = this
      , clientAirdropModel = new ClientAirdropModel()
    ;

    logger.info('Updating Step complete for airdrop for ', oThis.clientAirdropObj.id, 'Step: ', step_name);

    await clientAirdropModel.update({
      data: JSON.stringify(
        {
          tokens_transfered_transaction_hash: oThis.tokensTransferedTransactionHash,
          contract_approve_transaction_hash: oThis.contractApproveTransactionHash
        })
    }).update(['steps_complete = steps_complete | ?', clientAirdropModel.invertedStepsComplete[step_name]]).where({id: oThis.clientAirdropObj.id}).fire();

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Set the status of client airdrop db object to complete
   *
   * @returns {Promise<result>}
   * @private
   */
  _markCompleteStatus: async function () {

    const oThis = this;

    await new ClientAirdropModel()
      .update({status: oThis.clientAirdrop.invertedStatuses[clientAirdropConst.completeStatus]})
      .where({id: oThis.clientAirdropId}).fire();

    await new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
      oThis.criticalInteractionLogId,
      {
        status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.processedStatus]
      },
      oThis.criticalInteractionLogParentId,
      oThis.criticalInteractionLog.client_token_id
    );

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Update failed status and error response in database
   *
   * @param {result} responseData - error result data
   *
   * @returns {Promise<result>}
   * @private
   */
  _updateFailedStatusClientAirdropObj: async function (responseData) {
    const oThis = this
      , response = {
        tokens_transfered_transaction_hash: oThis.tokensTransferedTransactionHash,
        contract_approve_transaction_hash: oThis.contractApproveTransactionHash,
        err: responseData
      }
    ;

    logger.info('Updating Failed Status for airdrop for ', oThis.clientAirdropObj.id, 'Error: ', response);

    await new ClientAirdropModel()
      .update({
        status: oThis.clientAirdrop.invertedStatuses[clientAirdropConst.failedStatus],
        data: JSON.stringify(response)
      }).where({id: oThis.clientAirdropId}).fire();

    await new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
      oThis.criticalInteractionLogId,
      {
        status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.failedStatus],
        response_data: JSON.stringify(response)
      },
      oThis.criticalInteractionLogParentId,
      oThis.criticalInteractionLog.client_token_id
    );

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Approve Reserve of client for Airdrop contract
   *
   * @return {Promise<void>}
   */
  approveReserveForAirdropContract: async function(){
    const oThis = this;
    // fetch branded token details
    const clientBrandedTokenSqlResponse = await new ClientBrandedTokenKlass().select('*')
      .where(['id=?',oThis.clientAirdropObj.client_branded_token_id]).fire();
    const clientBrandedTokenObj = clientBrandedTokenSqlResponse[0];

    const managedAddressSqlResponse = await new ManagedAddressKlass().select('*')
      .where(['id=?',clientBrandedTokenObj.reserve_managed_address_id]).fire();

    const managedAddressObj = managedAddressSqlResponse[0];

    var inputParams = {approverUuid: managedAddressObj.uuid, token_erc20_address: clientBrandedTokenObj.token_erc20_address,
      approvee_address: clientBrandedTokenObj.airdrop_contract_addr, return_type: 'txReceipt'};

    return new ApproveContractKlass(inputParams).perform();

  },

  /**
   * enque user approval job.
   *
   * @return {Promise<void>}
   */
  enqueueUserApprovalJob: async function () {

    var oThis = this;

    await openSTNotification.publishEvent.perform(
      {
        topics: ['airdrop.approve.contract'],
        publisher: 'OST',
        message: {
          kind: 'background_job',
          payload: {
            airdrop_id: oThis.clientAirdropId,
            client_branded_token_id: oThis.clientAirdropObj.client_branded_token_id
          }
        }
      }
    );

    return Promise.resolve();

  }

};

module.exports = startKlass;
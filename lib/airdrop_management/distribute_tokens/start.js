"use strict";

/**
 *
 * Start Airdrop for a client token by subscribing to RMQ events.<br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/start
 *
 */

const rootPrefix = '../../..'
  , clientAirdropKlass = require(rootPrefix + '/app/models/client_airdrop')
  , clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop')
  , tokenTransferKlass = require(rootPrefix + '/lib/airdrop_management/distribute_tokens/token_transfer')
  , contractApproveKlass = require(rootPrefix + '/lib/airdrop_management/distribute_tokens/contract_approve')
  , allocateTokenKlass = require(rootPrefix + '/lib/airdrop_management/distribute_tokens/allocate_token')
  , allToAddressesKlass = require(rootPrefix + '/lib/airdrop_management/distribute_tokens/to_addresses/all')
  , neverAirdroppedToAddressesKlass = require(rootPrefix + '/lib/airdrop_management/distribute_tokens/to_addresses/never_airdropped')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 * Start Airdrop constructor
 *
 * @param {object} params -
 * @param {number} params.client_airdrop_id - client airdrop id for which airdrop has to be done
 *
 * @constructor
 *
 */
const startKlass = function (params) {

  var oThis = this
  ;

  oThis.clientAirdropId = params.client_airdrop_id;

  oThis.clientAirdrop = new clientAirdropKlass();

  oThis.clientAirdropObj = null;
  oThis.tokensTransferedTransactionHash = null;
  oThis.contractApproveTransactionHash = null;

};

startKlass.prototype = {

  /**
   * Start the airdrop
   *
   * @returns {Promise<result>}
   */
  perform: async function () {

    var r = null
      , oThis = this
    ;

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

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Set the required client airdrop db object and update it's status to processing
   *
   * @returns {Promise<result>}
   * @private
   */
  _setClientAirdropObj: async function () {

    var oThis = this
    ;

    const airdrop_result = await oThis.clientAirdrop.getById(oThis.clientAirdropId);
    oThis.clientAirdropObj = airdrop_result[0];

    if (oThis.clientAirdropObj.status !== parseInt(oThis.clientAirdrop.invertedStatuses[clientAirdropConst.incompleteStatus])){
      logger.notify('am_dt_s_scao_1', 'Invalid status for airdrop.', {client_airdrop_id: oThis.clientAirdropObj.id});
      return Promise.resolve(responseHelper.error('am_dt_s_scao_1', 'Invalid status for airdrop.'));
    }

    await oThis.clientAirdrop.edit({
      qParams: {
        status: clientAirdropConst.processingStatus
      },
      whereCondition: {
        id: oThis.clientAirdropObj.id
      }
    });

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Check if airdrop details exists or not. If not present, fetch and populate them as per filters.
   *
   * @returns {Promise<result>}
   * @private
   */
  _addClientAirdropDetails: async function () {
    var oThis = this
      , airdropToAddressesKlass = null
    ;

    if (oThis.clientAirdrop.isBitSet(clientAirdropConst.userIdentifiedStepComplete, oThis.clientAirdropObj.steps_complete)) {
      logger.notify('am_s_1', 'Invalid state for airdrop. user_identifed step already done', {client_airdrop_id: oThis.clientAirdropObj.id});
      return Promise.resolve(responseHelper.error('am_s_1', 'Invalid state for airdrop. user_identifed step already done'));
    }

    if (oThis.clientAirdropObj.airdrop_list_type === parseInt(oThis.clientAirdrop.invertedAirdropListType[clientAirdropConst.allAddressesAirdropListType])) {
      airdropToAddressesKlass = allToAddressesKlass;
    } else if (oThis.clientAirdropObj.airdrop_list_type === parseInt(oThis.clientAirdrop.invertedAirdropListType[clientAirdropConst.neverAirdroppedAddressesAirdropListType])) {
      airdropToAddressesKlass = neverAirdroppedToAddressesKlass;
    }

    const airdropToAddresses = new airdropToAddressesKlass({client_airdrop_obj: oThis.clientAirdropObj}),
      response = await airdropToAddresses.perform();

    if (response.isFailure()) {
      await oThis._updateFailedStatusClientAirdropObj(response);
    } else {
      await oThis._updateStepCompleteForClientAirdropObj(clientAirdropConst.userIdentifiedStepComplete);
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
      , tokenTransfer = new tokenTransferKlass({
        client_branded_token_id: oThis.clientAirdropObj.client_branded_token_id,
        client_airdrop_id: oThis.clientAirdropId
      })
    ;

    logger.info('Starting Airdrop Token Transfer for ', oThis.clientAirdropObj.id);

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
      , contractApprove = new contractApproveKlass({
        client_branded_token_id: oThis.clientAirdropObj.client_branded_token_id,
        client_airdrop_id: oThis.clientAirdropId
      })
    ;
    logger.info('Started Airdrop Contract Approve for ', oThis.clientAirdropObj.id);

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
      , allocateToken = new allocateTokenKlass({
        client_airdrop_id: oThis.clientAirdropId,
        client_branded_token_id: oThis.clientAirdropObj.client_branded_token_id,
        token_transferred_transaction_hash: oThis.tokensTransferedTransactionHash
      })
    ;

    logger.info('Started Airdrop Allocate Token for ', oThis.clientAirdropObj.id);

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
    var oThis = this
      , step_complete_bit_val = (oThis.clientAirdrop.setBit(step_name, oThis.clientAirdropObj.steps_complete))
    ;

    logger.info('Updating Step complete for airdrop for ', oThis.clientAirdropObj.id, 'Step: ', step_name);

    await oThis.clientAirdrop.edit({
      qParams: {
        steps_complete: step_complete_bit_val,
        data: JSON.stringify({
          tokens_transfered_transaction_hash: oThis.tokensTransferedTransactionHash,
          contract_approve_transaction_hash: oThis.contractApproveTransactionHash
        }),
      },
      whereCondition: {
        id: oThis.clientAirdropObj.id
      }
    });

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
    const oThis = this;

    logger.info('Updating Failed Status for airdrop for ', oThis.clientAirdropObj.id, 'Error: ', responseData);

    await oThis.clientAirdrop.edit({
      qParams: {
        data: JSON.stringify(responseData),
        status: clientAirdropConst.failedStatus
      },
      whereCondition: {
        id: oThis.clientAirdropObj.id
      }
    });

    return Promise.resolve(responseHelper.successWithData({}));
  }

};

module.exports = startKlass;
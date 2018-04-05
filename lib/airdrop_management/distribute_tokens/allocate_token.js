"use strict";

/**
 *
 * Start contract Approve for airdrop contract of client <br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/allocate_token
 *
 */

const openStPayments = require('@openstfoundation/openst-payments')
  , AirdropManagerBatchAllocatorKlass = openStPayments.services.airdropManager.batchAllocator
;

const rootPrefix = '../../..'
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , ClientAirdropDetailModel = require(rootPrefix + '/app/models/client_airdrop_details')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , clientAirdropDetailsConst = require(rootPrefix + '/lib/global_constant/client_airdrop_details')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;


/**
 * Add new transaction kind constructor
 *
 * @param {object} params -
 * @param {number} params.client_airdrop_id - client airdrop id for which airdrop has to be done
 * @param {number} params.client_branded_token_id - client branded token id
 * @param {string} params.token_transferred_transaction_hash - token transfer transaction hash
 *
 * @constructor
 *
 */
const contractApproveKlass = function (params) {

  const oThis = this;

  oThis.clientAirdropId = params.client_airdrop_id;
  oThis.clientBrandedTokenId = params.client_branded_token_id;
  oThis.tokensTransferedTransactionHash = params.token_transferred_transaction_hash;

};

contractApproveKlass.prototype = {

  /**
   * Start allocation process
   *
   * @returns {Promise<result>}
   */
  perform: async function () {

    const oThis = this
      , limitSize = 2000
    ;

    var offset = 0
      , neverAirdropedManagedAddressIds = []
    ;

    logger.info('Starting Allocate token');

    // fetch client branded token
    const clientBrandedToken = new ClientBrandedTokenKlass()
      , clientBrandedTokenSqlResponse = await clientBrandedToken.getById(oThis.clientBrandedTokenId);

    oThis.clientBrandedToken = clientBrandedTokenSqlResponse[0];

    while (true) {
      logger.info('Processing Batch Start');
      const managedAddress = new ManagedAddressKlass()
        , clientAirdropDetailsHash = {}
        , openStInputHash = {}
        , managedAddressIds = []
        , airdropDetailsId = []
      ;

      // fetch pending records
      const results = await new ClientAirdropDetailModel().getPendingRecordsInbatches(oThis.clientAirdropId, limitSize, offset)
        , totalCount = results.length;

      if (totalCount === 0) break;

      // Prepare data for further processing
      for (var i = 0; i < totalCount; i++) {
        airdropDetailsId.push(results[i].id);
        const userData = {airdropAmount: results[i].airdrop_amount_in_wei, expiryTimestamp: results[i].expiry_timestamp};
        clientAirdropDetailsHash[results[i].managed_address_id] = userData;
        managedAddressIds.push(results[i].managed_address_id);
      }

      // fetch managed user addresses
      const managedAddressObjects = await managedAddress.getByIds(managedAddressIds);

      // Prepare data for batch allocation in payments
      for (var i = 0; i < totalCount; i++) {
        const managedAddressObj = managedAddressObjects[i];
        openStInputHash[managedAddressObj.ethereum_address] = clientAirdropDetailsHash[managedAddressObj.id];
        if (!managedAddress.isBitSet(managedAddressesConst.airdropGrantProperty, managedAddressObj.properties)) {
          neverAirdropedManagedAddressIds.push(managedAddressObj.id);
        }
      }

      // Batch allocate airdrop to addresses
      const batchAllocatorObject = new AirdropManagerBatchAllocatorKlass({
        airdrop_contract_address: oThis.clientBrandedToken.airdrop_contract_addr,
        transaction_hash: oThis.tokensTransferedTransactionHash,
        airdrop_users: openStInputHash,
        chain_id: chainInteractionConstants.UTILITY_CHAIN_ID
      });

      const response = await batchAllocatorObject.perform();

      if (response.isFailure()) {
        logger.notify('am_at_1', 'Error In allocate token', response, {client_airdrop_id: oThis.clientAirdropId});
        await oThis._updateAirdropDetailsStatus(airdropDetailsId, clientAirdropDetailsConst.failedStatus);
        return Promise.resolve(response);
      }

      // update airdrop addresses
      await oThis._updateAirdropDetailsStatus(airdropDetailsId, clientAirdropDetailsConst.completeStatus);

      // update airdrop granted property
      if (neverAirdropedManagedAddressIds.length >= 1000) {
        await oThis._setPropertiesForMangedAddress(neverAirdropedManagedAddressIds);
        neverAirdropedManagedAddressIds = [];
      }

      if (totalCount < limitSize) break;

      offset = offset + limitSize;
      logger.info('Processing Batch End');
    }

    // update airdrop granted property for remaining users
    if (neverAirdropedManagedAddressIds.length >= 1) {
      await oThis._setPropertiesForMangedAddress(neverAirdropedManagedAddressIds);
      neverAirdropedManagedAddressIds = [];
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Set airdrop granted property in managed addresses
   *
   * @param {array} managedAddressIds - array of managed address ids
   *
   * @returns {Promise<result>}
   * @private
   */
  _setPropertiesForMangedAddress: async function (managedAddressIds) {
    const oThis = this
      , managedAddress = new ManagedAddressKlass()
    ;

    logger.info('Starting to update property for never airdroped addresses ');

    await managedAddress.update(['properties = properties | ?', managedAddress.invertedProperties[managedAddressesConst.airdropGrantProperty]]).where({id: managedAddressIds}).fire();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Update airdrop details table status
   *
   * @param {array} airdropDetailsId - array of airdrop details table id
   * @param {string} status - airdrop status for this batch
   *
   * @returns {Promise<result>}
   * @private
   */
  _updateAirdropDetailsStatus: async function (airdropDetailsId, status) {
    const oThis = this;

    logger.info('Starting to update status for client airdrop details ');

    await new ClientAirdropDetailModel().edit({
      qParams: {
        status: status
      },
      whereCondition: {
        id: [airdropDetailsId]
      }
    });

    return Promise.resolve(responseHelper.successWithData({}));
  }

};

module.exports = contractApproveKlass;
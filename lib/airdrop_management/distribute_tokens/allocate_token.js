"use strict";

/**
 *
 * Start contract Approve for airdrop contract of client <br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/allocate_token
 *
 */

const OpenStPaymentsKlass = require('@openstfoundation/openst-payments')
  , openStPaymentsAirdropManager = OpenStPaymentsKlass.airdropManager

const rootPrefix = '../../..'
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , clientBrandedToken = new ClientBrandedTokenKlass()
  , clientAirdropDetailKlass = require(rootPrefix + '/app/models/client_airdrop_details')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , clientAirdropDetailsConst = require(rootPrefix + '/lib/global_constant/client_airdrop_details')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  // , responseHelper = require(rootPrefix + '/lib/formatter/response')
;


/**
 * Add new transaction kind constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_airdrop_id - client airdrop id for which airdrop has to be done
 * @param {number} params.client_branded_token_id - client branded token id
 *
 * @constructor
 *
 */
const contractApproveKlass = function (params) {

  var oThis = this;

  oThis.clientAirdropId = params.client_airdrop_id;
  oThis.clientBrandedTokenId = params.client_branded_token_id;
  oThis.tokensTransferedTransactionHash = params.token_transferred_transaction_hash;

};

contractApproveKlass.prototype = {

  perform: async function () {

    var oThis = this
      , limitSize = 2000
      , offset = 0
      , continueLoop = true
      , results = null
      , clientAirdropDetail = new clientAirdropDetailKlass()
      , ManagedAddress = new ManagedAddressKlass()
      , clientAirdropDetailsHash = {}
      , openStInputHash = {}
      , managedAddressIds = []
      , managedAddressObj = null
      , managedAddressObjects = null
      , userData = null
      , neverAirdropedManagedAddressIds = []
      ,airdropDetailsId = []
    ;

    logger.info('Starting Allocate token');


    oThis.clientBrandedToken = await clientBrandedToken.getById(oThis.client_branded_token_id)[0];

    while (continueLoop) {
      logger.info('Processing Batch Start');
      results = clientAirdropDetail.getPendingRecordsInbatches(oThis.clientAirdropId, limitSize, offset)

      var totalCount = results.length;
      if (totalCount == 0) break;

      for (var i = 0; i < totalCount; i++) {
        airdropDetailsId.push(results[i].id);
        userData = {value: results[i].airdrop_amount_in_wei, expiry_timestamp: results[i].expiry_timesatmp}
        clientAirdropDetailsHash[results[i].managed_address_id] = userData;
        managedAddressIds.push(results[i].managed_address_id)
      }

      managedAddressObjects = await ManagedAddress.getByIds(managedAddressIds);

      for (var i = 0; i < totalCount; i++) {
        managedAddressObj = managedAddressObjects[i];
        openStInputHash[managedAddressObj.ethereum_address] = clientAirdropDetailsHash[managedAddressObj.id]
        if (!ManagedAddress.isBitSet( managedAddressesConst.airdropGrantProperty, managedAddressObj.properties))
        neverAirdropedManagedAddressIds.push(managedAddressObj.id)
      }

      var response = await openStPaymentsAirdropManager.batchAllocate(
        oThis.clientBrandedToken.airdropContractAddress,
        oThis.tokensTransferedTransactionHash,
        openStInputHash
      );

      if (response.isFailure()) {
        logger.notify('am_at_1', 'Error In allocate token', response, {client_airdrop_id: oThis.clientAirdropId});
        await oThis._updateAirdropDetailsStatus(airdropDetailsId, clientAirdropDetailsConst.failedStatus);
        return Promise.resolve(response);
      }

      await oThis._updateAirdropDetailsStatus(airdropDetailsId, clientAirdropDetailsConst.completeStatus);

      if (neverAirdropedManagedAddressIds.length >= 1000)
      {
        await oThis.setPropertiesForMangedAddress(neverAirdropedManagedAddressIds);
        neverAirdropedManagedAddressIds = []
      }

      if (totalCount < limitSize) continueLoop = false;
      results = null
      clientAirdropDetailsHash = {}
      openStInputHash = {}
      managedAddressIds = []
      managedAddressObj = null
      managedAddressObjects = null
      airdropDetailsId = [];

      offset = offset + limitSize
      logger.info('Processing Batch End');
    }

    if (neverAirdropedManagedAddressIds.length >= 1000)
    {
      await _setPropertiesForMangedAddress(neverAirdropedManagedAddressIds);
      neverAirdropedManagedAddressIds = []
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  _setPropertiesForMangedAddress: async function (managedAddressIds) {
    logger.info('Starting to update property for never airdroped addresses ');
    var oThis = this
      , ManagedAddress = new ManagedAddressKlass()
    ;

    await ManagedAddress.update(['properties = properties | ?', ManagedAddress.invertedProperties[managedAddressesConst.airdropGrantProperty]]).where({id: managedAddressIds}).fire();
  },

  _updateAirdropDetailsStatus: async function (airdropDetailsId, status) {
    logger.info('Starting to update status for client airdrop details ');
    var oThis = this
    , clientAirdropDetail = new clientAirdropDetailKlass()
    ;

    await clientAirdropDetail.edit({
      qParams: {
        status: status
      },
      whereCondition: {
        ids: [airdropDetailsId]
      }
    });
  }

};

module.exports = contractApproveKlass;
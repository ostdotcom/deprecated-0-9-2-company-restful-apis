'use strict';

/**
 *
 * Start allocate token for airdrop contract of client <br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/allocate_token
 *
 */

const rootPrefix = '../../..',
  ClientAirdropDetailModel = require(rootPrefix + '/app/models/client_airdrop_details'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  clientAirdropDetailsConst = require(rootPrefix + '/lib/global_constant/client_airdrop_details'),
  managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/lib/providers/payments');
require(rootPrefix + '/lib/cache_management/client_branded_token');

/**
 * Add new transaction kind constructor
 *
 * @param {object} params -
 * @param {number} params.client_id - client id
 * @param {number} params.client_airdrop_id - client airdrop id for which airdrop has to be done
 * @param {number} params.client_branded_token_id - client branded token id
 * @param {string} params.token_transferred_transaction_hash - token transfer transaction hash
 *
 * @constructor
 *
 */
const AllocateTokenKlass = function(params) {
  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.clientAirdropId = params.client_airdrop_id;
  oThis.clientBrandedTokenId = params.client_branded_token_id;
  oThis.tokensTransferedTransactionHash = params.token_transferred_transaction_hash;
};

AllocateTokenKlass.prototype = {
  /**
   * Start allocation process
   *
   * @returns {Promise<result>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(async function(error) {
      logger.error('lib/airdrop_management/distribute_tokens/allocate_token.js::perform::catch');
      logger.error(error);

      if (responseHelper.isCustomResult(error)) {
        return Promise.resolve(error);
      } else {
        return Promise.resolve(
          responseHelper.error({
            internal_error_identifier: 'l_am_dt_at_1',
            api_error_identifier: 'something_went_wrong',
            debug_options: { error: error },
            error_config: errorConfig
          })
        );
      }
    });
  },

  /**
   * Start allocation process
   *
   * @returns {Promise<result>}
   */
  asyncPerform: async function() {
    const oThis = this,
      limitSize = 2000;

    let offset = 0,
      neverAirdropedManagedAddressIds = [];

    logger.info('Starting Allocate token');

    const clientBrandedTokenCacheKlass = oThis.ic().getClientBrandedTokenCache(),
      clientBrandedTokenCacheObj = new clientBrandedTokenCacheKlass({ clientId: oThis.clientId });

    // fetch client branded token
    const clientBTCacheResponse = await clientBrandedTokenCacheObj.fetch();

    if (clientBTCacheResponse.isFailure()) return Promise.reject(clientBTCacheResponse);

    oThis.clientBrandedToken = clientBTCacheResponse.data;

    while (true) {
      logger.info('Processing Batch Start');
      const clientAirdropDetailsHash = {},
        openStInputHash = {},
        managedAddressIds = [],
        airdropDetailsIds = [];

      // fetch pending records
      const results = await new ClientAirdropDetailModel().getPendingRecordsInbatches(
          oThis.clientAirdropId,
          limitSize,
          offset
        ),
        totalCount = results.length;

      if (totalCount === 0) break;

      // Prepare data for further processing
      for (let i = 0; i < totalCount; i++) {
        airdropDetailsIds.push(results[i].id);
        const userData = {
          airdropAmount: results[i].airdrop_amount_in_wei,
          expiryTimestamp: results[i].expiry_timestamp
        };
        clientAirdropDetailsHash[results[i].managed_address_id] = userData;
        managedAddressIds.push(results[i].managed_address_id);
      }

      // fetch managed user addresses
      const managedAddressObjects = await new ManagedAddressModel().getByIds(managedAddressIds);

      // Prepare data for batch allocation in payments
      for (let i = 0; i < totalCount; i++) {
        const managedAddressObj = managedAddressObjects[i];
        openStInputHash[managedAddressObj.ethereum_address] = clientAirdropDetailsHash[managedAddressObj.id];
        if (
          !new ManagedAddressModel().isBitSet(managedAddressesConst.airdropGrantProperty, managedAddressObj.properties)
        ) {
          neverAirdropedManagedAddressIds.push(managedAddressObj.id);
        }
      }

      // Batch allocate airdrop to addresses

      const paymentsProvider = oThis.ic().getPaymentsProvider(),
        openSTPayments = paymentsProvider.getInstance(),
        configStrategy = oThis.ic().configStrategy;

      const batchAllocatorObject = new openSTPayments.services.airdropManager.batchAllocator({
        airdrop_contract_address: oThis.clientBrandedToken.airdrop_contract_addr,
        transaction_hash: oThis.tokensTransferedTransactionHash,
        airdrop_users: openStInputHash,
        chain_id: configStrategy.OST_UTILITY_CHAIN_ID
      });

      const response = await batchAllocatorObject.perform();

      if (response.isFailure()) {
        logger.notify('am_at_1', 'Error In allocate token', response, { client_airdrop_id: oThis.clientAirdropId });
        await oThis._updateAirdropDetailsStatus(airdropDetailsIds, clientAirdropDetailsConst.failedStatus);
        return Promise.resolve(response);
      }

      // update airdrop addresses
      await oThis._updateAirdropDetailsStatus(airdropDetailsIds, clientAirdropDetailsConst.completeStatus);

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
  _setPropertiesForMangedAddress: async function(managedAddressIds) {
    const oThis = this,
      managedAddress = new ManagedAddressModel();

    logger.info('Starting to update property for never airdroped addresses ');

    await new ManagedAddressModel()
      .update([
        'properties = properties | ?',
        new ManagedAddressModel().invertedProperties[managedAddressesConst.airdropGrantProperty]
      ])
      .where({ id: managedAddressIds })
      .fire();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Update airdrop details table status
   *
   * @param {array} airdropDetailsIds - array of airdrop details table id
   * @param {string} status - airdrop status for this batch
   *
   * @returns {Promise<result>}
   * @private
   */
  _updateAirdropDetailsStatus: async function(airdropDetailsIds, status) {
    const oThis = this,
      statusDb = new ClientAirdropDetailModel().invertedStatuses[status];

    logger.info('Starting to update status for client airdrop details ');

    await new ClientAirdropDetailModel()
      .update({ status: statusDb })
      .where(['id in (?)', airdropDetailsIds])
      .fire();

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

InstanceComposer.registerShadowableClass(AllocateTokenKlass, 'getAllocateTokenClass');

module.exports = AllocateTokenKlass;

'use strict';

/**
 * Start allocating airdrop amount to users.
 *
 * @module lib/on_boarding/deploy_airdrop
 *
 */

const uuid = require('uuid'),
  openStPlatform = require('@openstfoundation/openst-platform'),
  openSTNotification = require('@openstfoundation/openst-notification');

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  BTSecureCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure'),
  BTCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token'),
  ManagedAddressesCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses'),
  ClientAirdropModel = require(rootPrefix + '/app/models/client_airdrop'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log'),
  clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop'),
  managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses'),
  criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log'),
  AirdropEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/airdrop'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

const StartAllocateAirdropKlass = function(params) {
  const oThis = this;

  oThis.criticalChainInteractionLogId = parseInt(params.critical_interaction_log_id);
  oThis.parentCriticalInteractionLogId =
    parseInt(params.parent_critical_interaction_log_id) || oThis.criticalChainInteractionLogId;

  oThis.airdropParams = params.airdrop_params;
  oThis.clientId = params.client_id;

  oThis.criticalChainInteractionLog = null;
  oThis.parentCriticalChainInteractionLog = null;
  oThis.clientBrandedToken = null;
  oThis.airdropUuid = null;
  oThis.tokenSymbol = null;
};

StartAllocateAirdropKlass.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(async function(error) {
      var errorObj = null;

      // something unhandled happened
      logger.error('lib/allocate_airdrop/start_airdrop.js::perform::catch');
      logger.error(error);

      if (responseHelper.isCustomResult(error)) {
        errorObj = error;
      } else {
        errorObj = responseHelper.error({
          internal_error_identifier: 'l_aa_sa_1',
          api_error_identifier: 'something_went_wrong',
          debug_options: { error: error, clientId: oThis.clientId },
          error_config: errorConfig
        });
      }

      if (oThis.criticalChainInteractionLog) {
        await new CriticalChainInteractionLogModel()
          .updateCriticalChainInteractionLog(
            oThis.criticalChainInteractionLogId,
            {
              status: new CriticalChainInteractionLogModel().invertedStatuses[
                criticalChainInteractionLogConst.failedStatus
              ],
              response_data: errorObj.toHash()
            },
            oThis.parentCriticalInteractionLogId,
            oThis.clientTokenId
          )
          .catch(function(err) {
            logger.error('lib/allocate_airdrop/start_airdrop.js::perform::catch::updateCriticalChainInteractionLog');
            logger.error(err);
          });
      }

      return errorObj;
    });
  },

  /**
   * Perform
   *
   * @return {Promise<result>}
   */
  asyncPerform: async function() {
    const oThis = this;

    await oThis.setCriticalChainInteractionLog();

    await oThis.validateInput();

    await oThis.validateIncompleteRequests();

    await oThis.validateReserveBalance();

    await oThis.insertDb();

    const airdropEntityData = {
      id: oThis.airdropUuid,
      current_status: clientAirdropConst.incompleteStatus,
      steps_complete: ''
    };

    const airdropEntityFormatter = new AirdropEntityFormatterKlass(airdropEntityData),
      airdropEntityFormatterRsp = await airdropEntityFormatter.perform();

    const apiResponseData = {
      result_type: 'airdrop',
      airdrop: airdropEntityFormatterRsp.data
    };

    return Promise.resolve(responseHelper.successWithData(apiResponseData));
  },

  /**
   * set critical chain interaction log <br><br>
   *
   * @return {promise<result>}
   *
   */
  setCriticalChainInteractionLog: async function() {
    const oThis = this;

    if (!oThis.criticalChainInteractionLogId) {
      return Promise.resolve(responseHelper.successWithData({}));
    }
    const criticalChainInteractionLogs = await new CriticalChainInteractionLogModel().getByIds([
        oThis.criticalChainInteractionLogId,
        oThis.parentCriticalInteractionLogId
      ]),
      criticalChainInteractionLog = criticalChainInteractionLogs[oThis.criticalChainInteractionLogId],
      parentCriticalChainInteractionLog = criticalChainInteractionLogs[oThis.parentCriticalInteractionLogId];

    if (!criticalChainInteractionLog) {
      const errorRsp = responseHelper.error({
        internal_error_identifier: 'l_aa_sa_2',
        api_error_identifier: 'criticalChainInteractionLog_not_found',
        error_config: errorConfig
      });
      return Promise.reject(errorRsp);
    }

    if (!parentCriticalChainInteractionLog) {
      const errorRsp = responseHelper.error({
        internal_error_identifier: 'l_aa_sa_2.1',
        api_error_identifier: 'criticalChainInteractionLog_not_found',
        error_config: errorConfig
      });
      return Promise.reject(errorRsp);
    }

    oThis.criticalChainInteractionLog = criticalChainInteractionLog;
    oThis.parentCriticalChainInteractionLog = parentCriticalChainInteractionLog;

    oThis.clientId = oThis.criticalChainInteractionLog.client_id;

    oThis.clientTokenId = oThis.criticalChainInteractionLog.client_token_id;
    oThis.airdropParams = oThis.parentCriticalChainInteractionLog.request_params.airdrop_params;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Validate Input parameters
   *
   * Sets clientBrandedToken
   * @return {Promise<any>}
   */
  validateInput: async function() {
    const oThis = this;

    if (!oThis.airdropParams || !oThis.clientId) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_aa_sa_3',
          api_error_identifier: 'invalid_params',
          error_config: errorConfig
        })
      );
    }

    if (isNaN(oThis.airdropParams.airdrop_amount) || oThis.airdropParams.airdrop_amount <= 0) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 'l_aa_sa_4',
          api_error_identifier: 'invalid_params',
          params_error_identifiers: ['invalid_airdrop_amount'],
          error_config: errorConfig
        })
      );
    }

    if (
      ![
        clientAirdropConst.allAddressesAirdropListType,
        clientAirdropConst.neverAirdroppedAddressesAirdropListType,
        clientAirdropConst.everAirdroppedAddressesAirdropListType
      ].includes(oThis.airdropParams.airdrop_user_list_type)
    ) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 'l_aa_sa_5',
          api_error_identifier: 'invalid_List_type_to_airdrop',
          params_error_identifiers: ['airdropped_filter_empty_list'],
          error_config: errorConfig
        })
      );
    }

    const btCache = new BTCacheKlass({ clientId: oThis.clientId }),
      btCacheRsp = await btCache.fetch();

    if (btCacheRsp.isFailure()) {
      return Promise.reject(btCacheRsp);
    }
    oThis.tokenSymbol = btCacheRsp.data.symbol;

    if (!oThis.tokenSymbol) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_aa_sa_6',
          api_error_identifier: 'missing_token_symbol',
          error_config: errorConfig
        })
      );
    }

    var btSecureCache = new BTSecureCacheKlass({ tokenSymbol: oThis.tokenSymbol });
    const cacheRsp = await btSecureCache.fetch();
    if (cacheRsp.isFailure()) {
      return Promise.reject(cacheRsp);
    }

    if (oThis.clientId != cacheRsp.data.client_id) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_aa_sa_7',
          api_error_identifier: 'missing_client_id',
          error_config: errorConfig
        })
      );
    }

    await oThis.validateUserIds();

    oThis.clientBrandedToken = cacheRsp.data;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Validate whether invalid user id is passed for airdrop.
   *
   * @return {Promise<any>}
   */
  validateUserIds: async function() {
    const oThis = this;

    if (oThis.airdropParams.user_ids) {
      var invalidUuids = false;
      const uuidsAddressInfo = await new ManagedAddressModel()
        .select('*')
        .where(['uuid in (?)', oThis.airdropParams.user_ids])
        .fire();
      if (uuidsAddressInfo.length < oThis.airdropParams.user_ids.length) {
        invalidUuids = true;
      }
      for (var i = 0; i < uuidsAddressInfo.length; i++) {
        if (uuidsAddressInfo[i].client_id !== oThis.clientId) {
          invalidUuids = true;
        }
      }
      if (invalidUuids) {
        return Promise.reject(
          responseHelper.paramValidationError({
            internal_error_identifier: 'l_aa_ss_12',
            api_error_identifier: 'invalid_airdrop_uuids',
            params_error_identifiers: ['invalid_airdrop_uuids'],
            error_config: errorConfig
          })
        );
      }
    }
    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Validate whether any incomplete requests are in process
   *
   * @return {Promise<any>}
   */
  validateIncompleteRequests: async function() {
    const oThis = this;

    const clientAirdrops = await new ClientAirdropModel().select('*').where(['client_id=?', oThis.clientId]);
    if (clientAirdrops.length > 0) {
      for (var i = 0; i < clientAirdrops.length; i++) {
        if (
          [clientAirdropConst.incompleteStatus, clientAirdropConst.processingStatus].includes(
            new ClientAirdropModel().statuses[clientAirdrops[i].status]
          )
        ) {
          return Promise.reject(
            responseHelper.error({
              internal_error_identifier: 'l_aa_sa_8',
              api_error_identifier: 'airdrop_requests_in_process',
              error_config: errorConfig
            })
          );
        }
      }
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Validate Reserve's branded token balance is more than airdrop total.
   *
   * @return {Promise<any>}
   */
  validateReserveBalance: async function() {
    const oThis = this;

    const addrResponse = await new ManagedAddressesCacheKlass({
      uuids: [oThis.clientBrandedToken.reserve_address_uuid]
    }).fetch();

    if (addrResponse.isFailure()) {
      return Promise.reject(addrResponse);
    }

    const reserveAddressObj = addrResponse.data[oThis.clientBrandedToken.reserve_address_uuid];

    const brandedTokenBalanceResponse = await new openStPlatform.services.balance.brandedToken({
      address: reserveAddressObj.ethereum_address,
      erc20_address: oThis.clientBrandedToken.token_erc20_address
    }).perform();

    if (brandedTokenBalanceResponse.isFailure()) {
      return Promise.reject(brandedTokenBalanceResponse);
    }

    const getFilteredActiveUsersCountParams = { client_id: oThis.clientId };

    if (oThis.airdropParams.airdrop_user_list_type == clientAirdropConst.neverAirdroppedAddressesAirdropListType) {
      getFilteredActiveUsersCountParams['property_unset_bit_value'] = new ManagedAddressModel().invertedProperties[
        managedAddressesConst.airdropGrantProperty
      ];
    } else if (
      oThis.airdropParams.airdrop_user_list_type == clientAirdropConst.everAirdroppedAddressesAirdropListType
    ) {
      getFilteredActiveUsersCountParams['property_set_bit_value'] = new ManagedAddressModel().invertedProperties[
        managedAddressesConst.airdropGrantProperty
      ];
    }
    if (oThis.airdropParams.user_ids) {
      getFilteredActiveUsersCountParams['uuids'] = oThis.airdropParams.user_ids;
    }

    const getFilteredActiveUsersCountResponse = await new ManagedAddressModel().getFilteredActiveUsersCount(
      getFilteredActiveUsersCountParams
    );

    if (!getFilteredActiveUsersCountResponse[0] || getFilteredActiveUsersCountResponse[0].total_count == 0) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 'l_aa_sa_10',
          api_error_identifier: 'no_users_found_for_this_list_type',
          params_error_identifiers: ['airdropped_filter_empty_list'],
          error_config: errorConfig
        })
      );
    }

    console.log(
      '-------------------------------oThis.airdropParams.airdrop_amount-',
      oThis.airdropParams.airdrop_amount
    );
    console.log('-------------------------------brandedTokenBalanceResponse-', brandedTokenBalanceResponse);
    const amountInWei = basicHelper.convertToWei(oThis.airdropParams.airdrop_amount);
    if (
      amountInWei
        .mul(getFilteredActiveUsersCountResponse[0].total_count)
        .gt(basicHelper.convertToBigNumber(brandedTokenBalanceResponse.data.balance))
    ) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 'l_aa_sa_11',
          api_error_identifier: 'insufficient_funds',
          params_error_identifiers: ['insufficient_airdrop_amount'],
          error_config: errorConfig
        })
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Insert in Database
   *
   * Sets @airdropUuid
   *
   */
  insertDb: async function() {
    const oThis = this;
    oThis.airdropUuid = uuid.v4();

    var airdrop_list_type = new ClientAirdropModel().invertedAirdropListType[
      oThis.airdropParams.airdrop_user_list_type
    ];
    if (oThis.airdropParams.user_ids) {
      airdrop_list_type |= new ClientAirdropModel().invertedAirdropListType[
        clientAirdropConst.specificAddressesAirdropListType
      ];
    }

    const clientAirdropCreateResponse = await new ClientAirdropModel()
      .insert({
        airdrop_uuid: oThis.airdropUuid,
        client_id: oThis.clientId,
        client_branded_token_id: oThis.clientBrandedToken.id,
        common_airdrop_amount_in_wei: basicHelper.convertToWei(oThis.airdropParams.airdrop_amount).toNumber(),
        airdrop_list_type: airdrop_list_type,
        status: new ClientAirdropModel().invertedStatuses[clientAirdropConst.incompleteStatus]
      })
      .fire();

    // Publish Airdrop event
    await openSTNotification.publishEvent.perform({
      topics: ['airdrop.start.' + coreConstants.PACKAGE_NAME],
      publisher: 'OST',
      message: {
        kind: 'background_job',
        payload: {
          client_airdrop_id: clientAirdropCreateResponse.insertId,
          critical_chain_interaction_log_id: oThis.criticalChainInteractionLogId,
          user_ids: oThis.airdropParams.user_ids
        }
      }
    });
  }
};

module.exports = StartAllocateAirdropKlass;

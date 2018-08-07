'use strict';

/**
 * Propose branded token
 *
 * @module lib/on_boarding/propose
 */

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log'),
  OnBoardingRouter = require(rootPrefix + '/lib/on_boarding/router'),
  criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

require(rootPrefix + '/lib/providers/platform');
require(rootPrefix + '/app/services/token_management/edit');
require(rootPrefix + '/lib/cache_multi_management/erc20_contract_address');
require(rootPrefix + '/lib/cache_multi_management/erc20_contract_uuid');
require(rootPrefix + '/lib/on_boarding/assign_shards');

// time interval
const timeInterval = 30000; // 30 seconds

/**
 * propose branded token status
 *
 * @constructor
 *
 * @param {object} params - parameters object
 * @param {string} params.critical_interaction_log_id - id of criticial interaction log
 *
 */
const ProposeKlass = function(params) {
  const oThis = this;

  oThis.criticalChainInteractionLogId = params.critical_interaction_log_id;

  oThis.criticalChainInteractionLog = null;
  oThis.symbol = null;
  oThis.name = null;
  oThis.conversionFactor = null;
  oThis.transactionHash = null;
};

ProposeKlass.prototype = {
  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      var errorObj = null;
      // something unhandled happened
      logger.error('lib/on_boarding/propose.js::perform::catch');
      logger.error(error);

      if (responseHelper.isCustomResult(error)) {
        errorObj = error;
      } else {
        errorObj = responseHelper.error({
          internal_error_identifier: 'l_ob_p_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: { error: error },
          error_config: errorConfig
        });
      }

      if (oThis.criticalChainInteractionLog) {
        oThis.updateCriticalChainInteractionLog({
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
   * Perform<br><br>
   *
   * @return {promise<result>}
   *
   */
  asyncPerform: async function() {
    const oThis = this,
      EditTokenKlass = oThis.ic().getEditBrandedTokenKlass(),
      Erc20ContractAddressCacheKlass = oThis.ic().getErc20ContractAddressCache(),
      Erc20ContractUuidCacheKlass = oThis.ic().getErc20ContractUuidCache(),
      AssignShardsForClient = oThis.ic().getAssignShardsClass();

    await oThis.setCriticalChainInteractionLog();

    await oThis.setDerivedParams();

    oThis._criticalLogDebug('** Started propose', 'step');
    await oThis.propose();

    oThis._criticalLogDebug('** Started getRegistrationStatus', 'step');

    const getRegistrationStatusResponse = await oThis.getRegistrationStatus(),
      registerationData = getRegistrationStatusResponse.data.registration_status;

    const editTokenParams = {
      symbol: oThis.symbol,
      client_id: oThis.criticalChainInteractionLog.client_id,
      token_erc20_address: registerationData.erc20_address,
      token_uuid: registerationData.uuid
    };

    oThis._criticalLogDebug('** Performing edit token', 'step');

    const editTokenObj = new EditTokenKlass(editTokenParams),
      editTokenRsp = await editTokenObj.perform();

    if (editTokenRsp.isFailure()) {
      return Promise.reject(editTokenRsp);
    }

    await new AssignShardsForClient({
      client_id: oThis.criticalChainInteractionLog.client_id,
      token_erc20_address: registerationData.erc20_address
    }).perform();

    new Erc20ContractAddressCacheKlass({ addresses: [registerationData.erc20_address] }).clear();
    new Erc20ContractUuidCacheKlass({ uuids: [registerationData.uuid] }).clear();

    const callRouterRsp = await new OnBoardingRouter({
      current_step: 'propose',
      status: 'done',

      token_symbol: oThis.symbol,
      client_id: oThis.criticalChainInteractionLog.client_id,
      client_token_id: oThis.criticalChainInteractionLog.client_token_id,
      parent_critical_interaction_log_id: oThis.criticalChainInteractionLog.id,
      client_branded_token_id: oThis.criticalChainInteractionLog.client_branded_token_id
    }).perform();

    if (callRouterRsp.isFailure()) {
      return Promise.reject(callRouterRsp);
    }

    return Promise.resolve(callRouterRsp);
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
        oThis.criticalChainInteractionLogId
      ]),
      criticalChainInteractionLog = criticalChainInteractionLogs[oThis.criticalChainInteractionLogId];

    if (!criticalChainInteractionLog) {
      const errorRsp = responseHelper.error({
        internal_error_identifier: 'l_ob_p_2',
        api_error_identifier: 'no_data_found',
        error_config: errorConfig
      });
      return Promise.reject(errorRsp);
    }

    oThis.criticalChainInteractionLog = criticalChainInteractionLog;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * set params which could be derived from ciritcal log table <br><br>
   *
   * @return {promise<result>}
   *
   */
  setDerivedParams: async function() {
    const oThis = this;

    const clientBrandedTokenRecords = await new ClientBrandedTokenModel()
      .select('name,symbol,conversion_factor')
      .where(['id=?', oThis.criticalChainInteractionLog.client_branded_token_id])
      .fire();
    const clientBrandedToken = clientBrandedTokenRecords[0];

    if (!clientBrandedToken) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_p_2',
          api_error_identifier: 'client_branded_token_not_found',
          debug_options: { client_branded_token_id: oThis.criticalChainInteractionLog.client_branded_token_id },
          error_config: errorConfig
        })
      );
    }

    if (!clientBrandedToken.symbol || !clientBrandedToken.name || !clientBrandedToken.conversion_factor) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_p_3',
          api_error_identifier: 'invalid_branded_token',
          debug_options: { clientBrandedToken: clientBrandedToken },
          error_config: errorConfig
        })
      );
    }

    oThis.symbol = clientBrandedToken.symbol;
    oThis.name = clientBrandedToken.name;
    oThis.conversionFactor = clientBrandedToken.conversion_factor;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * update critical chain interaction log <br><br>
   *
   * @return {promise<result>}
   *
   */
  updateCriticalChainInteractionLog: async function(dataToUpdate) {
    const oThis = this,
      criticalChainInteractionLogObj = new CriticalChainInteractionLogModel();

    if (!dataToUpdate.response_data) {
      dataToUpdate.response_data = '{}';
    } else {
      dataToUpdate.response_data = JSON.stringify(dataToUpdate.response_data);
    }

    await criticalChainInteractionLogObj
      .update(dataToUpdate)
      .where({ id: oThis.criticalChainInteractionLog.id })
      .fire();

    criticalChainInteractionLogObj.flushTxStatusDetailsCache(oThis.criticalChainInteractionLogId);

    criticalChainInteractionLogObj.flushPendingTxsCache(oThis.criticalChainInteractionLog.client_token_id);

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Propose<br><br>
   *
   * @return {promise<result>}
   *
   */
  propose: async function() {
    const oThis = this,
      platformProvider = oThis.ic().getPlatformProvider(),
      openSTPlaform = platformProvider.getInstance(),
      criticalChainInteractionLogObj = new CriticalChainInteractionLogModel();

    const proposeServiceObj = new openSTPlaform.services.onBoarding.proposeBrandedToken({
      symbol: oThis.symbol,
      name: oThis.name,
      conversion_factor: oThis.conversionFactor
    });

    const proposeResponse = await proposeServiceObj.perform();

    if (proposeResponse.isFailure()) {
      const errorRsp = responseHelper.error({
        internal_error_identifier: 'l_ob_p_5',
        api_error_identifier: 'proposeBrandedToken_failed',
        debug_options: proposeResponse.toHash(),
        error_config: errorConfig
      });

      return Promise.reject(proposeResponse);
    }

    oThis.updateCriticalChainInteractionLog({
      status: criticalChainInteractionLogObj.invertedStatuses[criticalChainInteractionLogConst.pendingStatus],
      transaction_uuid: proposeResponse.data.transaction_uuid,
      transaction_hash: proposeResponse.data.transaction_hash
    });

    oThis.transactionHash = proposeResponse.data.transaction_hash;

    return Promise.resolve(proposeResponse);
  },

  /**
   * Get registration status<br><br>
   *
   * @return {result} - returns an object of Result
   *
   */
  getRegistrationStatus: function() {
    const oThis = this,
      platformProvider = oThis.ic().getPlatformProvider(),
      openSTPlaform = platformProvider.getInstance(),
      criticalChainInteractionLogObj = new CriticalChainInteractionLogModel();

    return new Promise(function(onResolve, onReject) {
      // number of times it will attempt to fetch
      var maxAttempts = 25;

      const getStatus = async function() {
        if (maxAttempts > 0) {
          const getRegistrationStatusServiceObj = new openSTPlaform.services.onBoarding.getRegistrationStatus({
            transaction_hash: oThis.transactionHash
          });

          const getRegistrationStatusResponse = await getRegistrationStatusServiceObj.perform();

          if (
            getRegistrationStatusResponse.isSuccess() &&
            getRegistrationStatusResponse.data &&
            getRegistrationStatusResponse.data.registration_status.is_proposal_done === 1 &&
            getRegistrationStatusResponse.data.registration_status.is_registered_on_uc === 1 &&
            getRegistrationStatusResponse.data.registration_status.is_registered_on_vc === 1
          ) {
            oThis.updateCriticalChainInteractionLog({
              status: criticalChainInteractionLogObj.invertedStatuses[criticalChainInteractionLogConst.processedStatus],
              response_data: getRegistrationStatusResponse.toHash()
            });

            onResolve(getRegistrationStatusResponse);
          } else {
            oThis.updateCriticalChainInteractionLog({
              status: criticalChainInteractionLogObj.invertedStatuses[criticalChainInteractionLogConst.pendingStatus],
              response_data: getRegistrationStatusResponse.toHash()
            });

            maxAttempts--;

            setTimeout(getStatus, timeInterval);
          }
        } else {
          const errorRsp = responseHelper.error({
            internal_error_identifier: 'l_ob_p_6',
            api_error_identifier: 'registration_status_not_found',
            debug_options: getRegistrationStatusResponse.toHash(),
            error_config: errorConfig
          });

          return onReject(errorRsp);
        }
      };

      setTimeout(getStatus, timeInterval);
    });
  },

  _criticalLogDebug: function(message, messageKind) {
    const oThis = this;
    let parentId = oThis.criticalInteractionLogParentId || '-';
    logger[messageKind].apply(logger, ['[p' + parentId + '][s' + oThis.criticalChainInteractionLogId + ']', message]);
  }
};

InstanceComposer.registerShadowableClass(ProposeKlass, 'getProposeKlass');

module.exports = ProposeKlass;

'use strict';

const rootPrefix = '../../..',
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log'),
  criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

require(rootPrefix + '/lib/providers/platform');

const BaseKlass = function(params) {
  const oThis = this;

  oThis.criticalChainInteractionLogId = parseInt(params.critical_interaction_log_id);
  oThis.parentCriticalInteractionLogId = parseInt(params.parent_critical_interaction_log_id);

  oThis.criticalChainInteractionLog = null;
  oThis.parentCriticalChainInteractionLog = null;
  oThis.brandedTokenId = null;
  oThis.clientId = null;
  oThis.clientTokenId = null;
  oThis.toStakeAmount = null;
  oThis.benificiaryAddress = null;
  oThis.uuid = null;
  oThis.stakeResponse = null;
  oThis.brandedToken = null;
};

BaseKlass.prototype = {
  criticalChainInteractionLog: null,

  parentCriticalChainInteractionLog: null,

  /**
   * Perform
   *
   * @returns {Promise<result>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(async function(error) {
      var errorObj = null;
      // something unhandled happened
      logger.error('lib/stake_and_mint/start/base.js::perform::catch');
      logger.error(error);

      if (responseHelper.isCustomResult(error)) {
        errorObj = error;
      } else {
        errorObj = responseHelper.error({
          internal_error_identifier: 'l_sam_s_b_1',
          api_error_identifier: 'unhandled_catch_response',
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
            logger.error('lib/stake_and_mint/start/base.js::perform::catch::updateCriticalChainInteractionLog');
            logger.error(error);
          });
      }

      return errorObj;
    });
  },

  asyncPerform: async function() {
    const oThis = this;

    await oThis.setCriticalChainInteractionLog();

    await oThis.validateAndSanitize();

    oThis._criticalLogDebug('Updating critical chain interaction log', 'debug');
    oThis
      .updateCriticalInteractionLog({
        status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.pendingStatus]
      })
      .catch(function(err) {
        logger.error('lib/stake_and_mint/start/base.js::updateCriticalInteractionLog::catch');
        logger.error(error);
      });

    await oThis.setTokenUuid();

    await oThis.setBenificiaryAddress();

    let initiateStakeAndMintResponse = await oThis.initiateStakeAndMint();

    oThis._criticalLogDebug('* Updating transaction hash in critical chain interaction log', 'debug');

    oThis
      .updateCriticalInteractionLog({
        transaction_hash: initiateStakeAndMintResponse.data.transaction_hash
      })
      .catch(function(err) {
        logger.error('lib/stake_and_mint/start/base.js::updateCriticalInteractionLog::catch');
        logger.error(error);
      });

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * set critical chain interaction log <br><br>
   *
   * @returns {Promise<result>}
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
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_sam_s_b_2',
          api_error_identifier: 'no_data_found',
          error_config: errorConfig
        })
      );
    }

    if (!parentCriticalChainInteractionLog) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_sam_s_b_3',
          api_error_identifier: 'no_data_found',
          error_config: errorConfig
        })
      );
    }

    oThis.criticalChainInteractionLog = criticalChainInteractionLog;
    oThis.parentCriticalChainInteractionLog = parentCriticalChainInteractionLog;

    oThis.brandedTokenId = oThis.criticalChainInteractionLog.client_branded_token_id;
    oThis.clientId = oThis.criticalChainInteractionLog.client_id;
    oThis.clientTokenId = oThis.criticalChainInteractionLog.client_token_id;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * set beneficiary address <br><br>
   *
   * sets beneficiaryAddress
   *
   * @returns {Promise<result>}
   *
   */
  setBenificiaryAddress: async function() {
    const oThis = this,
      reserveAddressId = oThis.brandedToken.reserve_managed_address_id;

    oThis._criticalLogDebug('* Fetching managed address record', 'debug');
    const managedAddress = await new ManagedAddressModel()
      .select('*')
      .where(['id=?', reserveAddressId])
      .fire();
    oThis.benificiaryAddress = managedAddress[0].ethereum_address;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * initiate stake and mint. <br><br>
   *
   * sets stakeResponse
   *
   * @returns {Promise<result>}
   *
   */
  initiateStakeAndMint: async function() {
    const oThis = this,
      platformProvider = oThis.ic().getPlatformProvider(),
      openSTPlatform = platformProvider.getInstance();

    const object = new openSTPlatform.services.stake.start({
      beneficiary: oThis.benificiaryAddress,
      to_stake_amount: oThis.toStakeAmount,
      uuid: oThis.uuid
    });

    oThis._criticalLogDebug('* Performing Stake and Mint', 'step');

    const stakeResponse = await object.perform();

    if (stakeResponse.isSuccess()) {
      return Promise.resolve(stakeResponse);
    } else {
      return Promise.reject(stakeResponse);
    }
  },

  /**
   * update critical interaction log id
   *
   * @returns {Promise}
   */
  updateCriticalInteractionLog: function(dataToUpdate) {
    const oThis = this;

    // marking self as processed
    return new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
      oThis.criticalChainInteractionLogId,
      dataToUpdate,
      oThis.parentCriticalInteractionLogId,
      oThis.clientTokenId
    );
  },

  /**
   * current step
   *
   * @returns {string}
   *
   */
  currentStep: function() {
    throw 'Sub class to implement.';
  },

  _criticalLogDebug: function(message, messageKind) {
    const oThis = this;
    let parentId = oThis.parentCriticalInteractionLogId || '-';
    logger[messageKind].apply(logger, ['[p' + parentId + '][s' + oThis.criticalChainInteractionLogId + ']', message]);
  }
};

InstanceComposer.registerShadowableClass(BaseKlass, 'getBaseKlass');
module.exports = BaseKlass;

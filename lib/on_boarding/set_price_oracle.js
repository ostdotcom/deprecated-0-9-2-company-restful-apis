"use strict";

/**
 * set price oracle to airdrop contract.
 *
 * @module lib/on_boarding/set_price_oracle
 *
 */

const openStPayments = require('@openstfoundation/openst-payments')
;

const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log')
  , criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log')
;

/**
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.critical_interaction_log_id - critical chain interactions log id
 * @param {number} params.parent_critical_interaction_log_id - parent of critical chain interactions log id
 *
 */
const SetPriceOracleKlass = function (params) {

  var oThis = this;

  oThis.criticalChainInteractionLogId = params.critical_interaction_log_id;
  oThis.parentCriticalInteractionLogId = params.parent_critical_interaction_log_id;

  oThis.criticalChainInteractionLog = null;
  oThis.parentCriticalChainInteractionLog = null;
  oThis.brandedTokenId = null;
  oThis.clientId = null;
  oThis.clientTokenId = null;

  oThis.senderAddress = chainIntConstants.UTILITY_OPS_ADDR;
  oThis.senderPassphrase = chainIntConstants.UTILITY_OPS_PASSPHRASE;
  oThis.chainId = chainIntConstants.UTILITY_CHAIN_ID;
  oThis.gasPrice = chainIntConstants.UTILITY_GAS_PRICE;

  oThis.priceOracleContractAddress = chainIntConstants.UTILITY_PRICE_ORACLES.OST.USD;
  oThis.airDropContractAddress = '';

};

SetPriceOracleKlass.prototype = {

  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: function () {
    const oThis = this
    ;

    return oThis.asyncPerform()
      .catch(async function (error) {

        var errorObj = null;

        if(responseHelper.isCustomResult(error)) {
          errorObj = error;
        } else {
          // something unhandled happened
          logger.error('lib/on_boarding/propose.js::perform::catch');
          logger.error(error);

          errorObj = responseHelper.error("l_ob_p_1", "Inside catch block", null, {error: error}, {sendErrorEmail: true});

        }

        if (oThis.criticalChainInteractionLog) {
          await new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
            oThis.criticalChainInteractionLogId,
            {
              status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.failedStatus],
              response_data: errorObj.toHash(),
            },
            oThis.parentCriticalInteractionLogId,
            oThis.clientTokenId
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

    const oThis = this;
    var r = null;

    await oThis.setCriticalChainInteractionLog();

    await oThis.validateAndSanitize();

    const airdrop = new openStPayments.airdrop(oThis.airDropContractAddress, oThis.chainId);

    r = await airdrop.setPriceOracle(
      oThis.senderAddress,
      oThis.senderPassphrase,
      'USD',
      oThis.priceOracleContractAddress,
      oThis.gasPrice,
      {returnType: "txReceipt", tag: ""}
    );

    if(r.isFailure()){
      return Promise.reject(responseHelper.error('l_ob_spo_2', 'setPriceOracle failed. details:\n', r));
    } else {
      await new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
        oThis.criticalChainInteractionLogId,
        {
          status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.processedStatus]
        },
        oThis.parentCriticalInteractionLogId,
        oThis.clientTokenId
      );
    }

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
      return Promise.reject(responseHelper.error("l_ob_spo_2", "criticalChainInteractionLog not found", null, {},
        {sendErrorEmail: false}));
    }

    if (!parentCriticalChainInteractionLog) {
      return Promise.reject(responseHelper.error("l_ob_spo_2", "parentCriticalChainInteractionLog not found", null, {},
        {sendErrorEmail: false}));
    }

    oThis.criticalChainInteractionLog = criticalChainInteractionLog;
    oThis.parentCriticalChainInteractionLog = parentCriticalChainInteractionLog;

    oThis.brandedTokenId = oThis.criticalChainInteractionLog.client_branded_token_id;
    oThis.clientId = oThis.criticalChainInteractionLog.client_id;
    oThis.clientTokenId = oThis.criticalChainInteractionLog.client_token_id;

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * validate and sanitize.
   *
   * sets airDropContractAddress
   *
   * @return {Promise.<result>}
   */
  validateAndSanitize: async function () {

    const oThis = this;

    if (!oThis.brandedTokenId || !oThis.clientId) {
      return Promise.reject(responseHelper.error('l_ob_spo_3', 'Mandatory params missing.', null, {},
        {sendErrorEmail: false}));
    }

    const clientBrandedToken = await new ClientBrandedTokenModel().select('*').where(['id=?', oThis.brandedTokenId]);
    const brandedToken = clientBrandedToken[0];

    if (brandedToken.client_id != oThis.clientId) {
      return Promise.reject(responseHelper.error('l_ob_spo_4', 'Unauthorised request'));
    }

    oThis.airDropContractAddress = brandedToken.airdrop_contract_addr;

    if (!oThis.airDropContractAddress) {
      return Promise.reject(responseHelper.error('l_ob_spo_5', 'Airdrop contract address is mandatory.', null, {},
        {sendErrorEmail: false}));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

module.exports = SetPriceOracleKlass;
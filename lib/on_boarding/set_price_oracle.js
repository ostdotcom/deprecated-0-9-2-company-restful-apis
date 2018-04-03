"use strict";

/**
 * set price oracle to airdrop contract.
 *
 * @module lib/on_boarding/set_price_oracle
 *
 */

const openStPayments = require('@openstfoundation/openst-payments')
    , AirdropManagerSetPriceOracleKlass = openStPayments.services.airdropManager.setPriceOracle
;

const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log')
  , criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log')
  , OnBoardingRouter = require(rootPrefix + '/lib/on_boarding/router')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
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

  const oThis = this;

  oThis.criticalChainInteractionLogId = parseInt(params.critical_interaction_log_id);
  oThis.parentCriticalInteractionLogId = parseInt(params.parent_critical_interaction_log_id);

  oThis.criticalChainInteractionLog = null;
  oThis.parentCriticalChainInteractionLog = null;
  oThis.brandedTokenId = null;
  oThis.clientId = null;
  oThis.clientTokenId = null;
  oThis.brandedToken = null;

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
          logger.error('lib/on_boarding/set_price_oracle.js::perform::catch');
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

    await oThis.setCriticalChainInteractionLog();

    await oThis.validateAndSanitize();

    new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
        oThis.criticalChainInteractionLogId,
        {
          status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.pendingStatus]
        },
        oThis.parentCriticalInteractionLogId,
        oThis.clientTokenId
    );

    const setPriceOracleObject = new AirdropManagerSetPriceOracleKlass({
      airdrop_contract_address: oThis.airDropContractAddress,
      chain_id: oThis.chainId,
      sender_address: oThis.senderAddress,
      sender_passphrase: oThis.senderPassphrase,
      currency: 'USD',
      price_oracle_contract_address: oThis.priceOracleContractAddress,
      gas_price: oThis.gasPrice,
      options: {tag: 'airdrop.setPriceOracle', returnType: 'txReceipt'}
    });

    const setPriceOracleResponse = await setPriceOracleObject.perform();

    if(setPriceOracleResponse.isFailure()){
      return Promise.reject(responseHelper.error('l_ob_spo_2', 'setPriceOracle failed. details:\n', setPriceOracleResponse));
    } else {
      await new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
        oThis.criticalChainInteractionLogId,
        {
          status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.processedStatus],
          transaction_hash: setPriceOracleResponse.data.transaction_receipt.transactionHash
        },
        oThis.parentCriticalInteractionLogId,
        oThis.clientTokenId
      );
    }

    const callRouterRsp = await new OnBoardingRouter({
      current_step: 'set_price_oracle',
      status: 'done',

      token_symbol: oThis.parentCriticalChainInteractionLog.request_params.token_symbol,
      client_id: oThis.criticalChainInteractionLog.client_id,
      client_token_id: oThis.criticalChainInteractionLog.client_token_id,
      parent_critical_interaction_log_id: oThis.parentCriticalChainInteractionLog.id,
      client_branded_token_id: oThis.criticalChainInteractionLog.client_branded_token_id
    }).perform();

    if (callRouterRsp.isFailure()) {
      return Promise.reject(callRouterRsp);
    }

    return Promise.resolve(setPriceOracleResponse);
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

    const clientBrandedToken = await new ClientBrandedTokenModel().select('*').where(['id=?', oThis.brandedTokenId]).fire();
    oThis.brandedToken = clientBrandedToken[0];

    if (oThis.brandedToken.client_id != oThis.clientId) {
      return Promise.reject(responseHelper.error('l_ob_spo_4', 'Unauthorised request'));
    }

    oThis.airDropContractAddress = oThis.brandedToken.airdrop_contract_addr;

    if (!oThis.airDropContractAddress) {
      return Promise.reject(responseHelper.error('l_ob_spo_5', 'Airdrop contract address is mandatory.', null, {},
        {sendErrorEmail: false}));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

module.exports = SetPriceOracleKlass;
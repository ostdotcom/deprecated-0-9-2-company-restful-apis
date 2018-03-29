"use strict";

/**
 * set accepted margin to airdrop contract.
 *
 * @module lib/on_boarding/set_accepted_margin
 *
 */

const openStPayments = require('@openstfoundation/openst-payments')
;

const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log')
  , OnBoardingRouter = require(rootPrefix + '/lib/on_boarding/router')
;

/**
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id
 * @param {number} params.branded_token_id - id of saas branded token table.
 *
 */
const SetAcceptedMarginKlass = function (params) {

  var oThis = this;
  oThis.critical_log_id = params.critical_interaction_log_id,
  oThis.parent_critical_log_id = params.parent_critical_interaction_log_id,
  oThis.client_token_id = null,
  oThis.brandedTokenId = null;
  oThis.clientId = null;

  oThis.senderAddress = chainIntConstants.UTILITY_OPS_ADDR;
  oThis.senderPassphrase = chainIntConstants.UTILITY_OPS_PASSPHRASE;
  oThis.chainId = chainIntConstants.UTILITY_CHAIN_ID;
  oThis.gasPrice = chainIntConstants.UTILITY_GAS_PRICE;

  oThis.acceptedMargin = coreConstants.ACCEPTED_PRICE_FLUCTUATION_FOR_PAYMENT.OST.USD;
  oThis.airDropContractAddress = '';

};

SetAcceptedMarginKlass.prototype = {

  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: async function () {
    var oThis = this
      , r = null
    ;

    return oThis.asyncPerform().catch(function (error) {
      logger.error('Setup Airdrop contract failed with error - ', error);
      return Promise.resolve(responseHelper.error("l_ob_sam_1", "Inside catch block", null, {},
        {sendErrorEmail: false}));
    });

  },

  /**
   * Async perform
   *
   * @return {promise<result>}
   */
  asyncPerform: async function () {

    var oThis = this
      , r = null;

    r = await getAndSetCriticalChainInteractionLog();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.validateAndSanitize();
    if (r.isFailure()) return Promise.resolve(r);

    const airdrop = new openStPayments.airdrop(oThis.airDropContractAddress, oThis.chainId);

    r = await airdrop.setAcceptedMargin(
      oThis.senderAddress,
      oThis.senderPassphrase,
      'USD',
      oThis.acceptedMargin,
      oThis.gasPrice,
      {returnType: "txHash", tag: ""}
    );

    if(r.isFailure()){
      return Promise.reject(responseHelper.error('l_ob_sam_2', 'setPriceOracle failed. details:\n', r));
    } else {
      // TODO: update critical logs table here.
    }

    await new OnBoardingRouter({
      current_step: 'set_accepted_margin',
      status: 'done',

      token_symbol: '',
      client_id: oThis.client_id,
      client_token_id: oThis.client_token_id,
      parent_critical_interaction_log_id: oThis.parent_critical_log_id,
      client_branded_token_id: oThis.brandedTokenId
    }).perform();

    return Promise.resolve(r);
  },

  /**
   * validate and sanitize.
   *
   * sets airDropContractAddress
   *
   * @return {Promise.<result>}
   */
  validateAndSanitize: async function () {

    var oThis = this;

    if (!oThis.brandedTokenId || !oThis.clientId) {
      return Promise.reject(responseHelper.error('l_ob_sam_3', 'Mandatory params missing.'));
    }

    const clientBrandedToken = await new ClientBrandedTokenModel().select('*').where(['id=?', oThis.brandedTokenId]);
    const brandedToken = clientBrandedToken[0];

    if (brandedToken.client_id != oThis.clientId) {
      return Promise.reject(responseHelper.error('l_ob_sam_4', 'Unauthorised request'));
    }

    oThis.airDropContractAddress = brandedToken.airdrop_contract_addr;

    if (!oThis.airDropContractAddress) {
      return Promise.reject(responseHelper.error('l_ob_sam_5', 'Airdrop contract address is mandatory.'));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  getAndSetCriticalChainInteractionLog: async function(){
    const oThis = this;

    let CriticalChainInteractionLogObj = new CriticalChainInteractionLogModel();

    let critical_chain_interaction_log_records = CriticalChainInteractionLogObj
      .getbyIds(
        [
          oThis.critical_log_id,
          oThis.parent_critical_log_id
        ]).fire();

    oThis.clientId = critical_chain_interaction_log_records[oThis.critical_log_id].client_id;
    oThis.client_token_id = critical_chain_interaction_log_records[oThis.critical_log_id].client_token_id;
    oThis.brandedTokenId = critical_chain_interaction_log_records[oThis.critical_log_id].client_branded_token_id;

    return Promise.resolve(responseHelper.successWithData({}));
  }

};

module.exports = SetAcceptedMarginKlass;
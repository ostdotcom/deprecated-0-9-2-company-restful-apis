"use strict";

const rootPrefix = '../../..'
  , BaseKlass = require(rootPrefix + '/app/services/stake_and_mint/base')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , clientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , CriticalChainInteractionLogModel = require(`${rootPrefix}/app/models/critical_chain_interaction_log`)
;

/**
 * Add new transaction kind constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id for whom tokens need to be minted
 * @param {number} params.token_symbol - symbol of token which is to be minted
 * @param {number} params.to_stake_amount - amount to stake in ost
 *
 * @constructor
 *
 */
const BrandedTokenKlass = function (params) {

  var oThis = this;

  oThis.critical_log_id = params.critical_interaction_log_id;
  oThis.parent_critical_interaction_log_id = params.parent_critical_interaction_log_id;
  oThis.toStakeAmount = null;
  oThis.clientId = null;
  oThis.tokenSymbol = null;

  oThis.benificieryAddress = null;
  oThis.uuid = null;

  oThis.stakeResponse = null;
  oThis.brandedToken = null;

};

BrandedTokenKlass.prototype = Object.create(BaseKlass.prototype);

const BrandedTokenKlassPrototype = {

  validateAndSanitize: function () {

    const oThis = this;

    let CriticalChainInteractionLogObj = new CriticalChainInteractionLogModel();
    let critical_chain_interaction_logs = CriticalChainInteractionLogObj.
    getByIds(
      [
        oThis.critical_log_id,
        oThis.parent_critical_interaction_log_id
      ]).fire();

    let parent_critical_chain_interaction_log = critical_chain_interaction_logs[oThis.parent_critical_interaction_log_id];
    let critical_chain_interaction_log = critical_chain_interaction_logs[oThis.critical_log_id];

    oThis.clientId = parent_critical_chain_interaction_log.client_id;
    oThis.tokenSymbol = parent_critical_chain_interaction_log.request_params.token_symbol;
    oThis.toStakeAmount = parent_critical_chain_interaction_log.request_params.stake_and_mint_params.ost_to_stake_to_mint_bt;

    if(!oThis.toStakeAmount || !oThis.clientId || !oThis.tokenSymbol){
      return Promise.resolve(responseHelper.error('sam_bt_1', 'Invalid Params'));
    }

    oThis.toStakeAmount = basicHelper.convertToWei(oThis.toStakeAmount.toString());

    return Promise.resolve(responseHelper.successWithData({}));

  },
  
  setTokenUuid: async function () {

    var oThis = this;

    const clientBrandedTokenObj = new clientBrandedTokenKlass();
    const clientBrandedToken = await clientBrandedTokenObj.getBySymbol(oThis.tokenSymbol);

    oThis.brandedToken = clientBrandedToken[0];
    oThis.uuid = oThis.brandedToken.token_uuid;

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

Object.assign(BrandedTokenKlass.prototype, BrandedTokenKlassPrototype);

module.exports = BrandedTokenKlass;
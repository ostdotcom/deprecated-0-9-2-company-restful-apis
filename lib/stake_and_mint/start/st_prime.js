"use strict";

const rootPrefix = '../../..'
  , BaseKlass = require(rootPrefix + '/app/services/stake_and_mint/base')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , clientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , CriticalChainInteractionLogModel = require(`${rootPrefix}/app/models/critical_chain_interaction_log`)
;

const StPrimeKlass = function (params) {

  var oThis = this;

  oThis.critical_log_id = params.critical_interaction_log_id;
  oThis.parent_critical_log_id = params.parent_critical_interaction_log_id;
  oThis.toStakeAmount = null;
  oThis.clientId = null;

  oThis.benificieryAddress = null;
  oThis.uuid = null;

  oThis.stakeResponse = null;
  oThis.brandedToken = null;

};

StPrimeKlass.prototype = Object.create(BaseKlass.prototype);

const StPrimeKlassPrototype = {

  validateAndSanitize: function () {
    const oThis = this;

    let CriticalChainInteractionLogObj = new CriticalChainInteractionLogModel();
    let critical_chain_interaction_logs = CriticalChainInteractionLogObj
      .getByIds(
        [
          oThis.critical_log_id,
          oThis.parent_critical_log_id
        ]);

    let parent_critical_chain_interaction_log = critical_chain_interaction_logs[oThis.parent_critical_log_id];

    oThis.clientId = parent_critical_chain_interaction_log.client_id;
    oThis.toStakeAmount = parent_critical_chain_interaction_log.request_params.stake_and_mint_params.st_prime_to_mint;

    if(!oThis.toStakeAmount || !oThis.clientId){
      return Promise.resolve(responseHelper.error('sam_bt_1', 'Invalid Params'));
    }

    oThis.toStakeAmount = basicHelper.convertToWei(oThis.toStakeAmount.toString());

    return Promise.resolve(responseHelper.successWithData({}));
  },

  setTokenUuid: async function () {

    var oThis = this;

    const clientBrandedTokenObj = new clientBrandedTokenKlass();
    const clientBrandedTokens = await clientBrandedTokenObj.getByClientId(oThis.clientId);

    oThis.brandedToken = clientBrandedTokens[clientBrandedTokens.length - 1];

    oThis.uuid = chainInteractionConstants.ST_PRIME_UUID;

    return Promise.resolve(responseHelper.successWithData({}));
  }

};

Object.assign(StPrimeKlass.prototype, StPrimeKlassPrototype);

module.exports = StPrimeKlass;
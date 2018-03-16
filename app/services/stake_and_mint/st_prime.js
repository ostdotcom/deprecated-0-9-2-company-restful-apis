"use strict";

const rootPrefix = '../../..'
  , BaseKlass = require(rootPrefix + '/app/services/stake_and_mint/base')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , clientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
;

const StPrimeKlass = function (params) {

  var oThis = this;

  oThis.toStakeAmount = params.to_stake_amount;
  oThis.clientId = params.client_id;

  oThis.benificieryAddress = null;
  oThis.uuid = null;

  oThis.stakeResponse = null;
  oThis.brandedToken = null;

};

StPrimeKlass.prototype = Object.create(BaseKlass.prototype);

const StPrimeKlassPrototype = {

  validateAndSanitize: function () {
    var oThis = this;
    if(!oThis.toStakeAmount || !oThis.clientId){
      return Promise.resolve(responseHelper.error('sam_bt_1', 'Invalid Params'));
    }

    oThis.toStakeAmount = basicHelper.convertToWei(oThis.toStakeAmount.toString(10));

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
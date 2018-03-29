"use strict";

const rootPrefix = '../../..'
  , BaseKlass = require(rootPrefix + '/lib/stake_and_mint/start/base')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
;

const StPrimeKlass = function (params) {

  const oThis = this;

  BaseKlass.call(oThis, params);
};

StPrimeKlass.prototype = Object.create(BaseKlass.prototype);

const StPrimeKlassPrototype = {

  /**
   * Validate and sanitize
   *
   * @returns {promise<result>}
   *
   */
  validateAndSanitize: function () {

    const oThis = this;

    oThis.toStakeAmount = oThis.parentCriticalChainInteractionLog.request_params.stake_and_mint_params.st_prime_to_mint;

    if(!oThis.toStakeAmount || !oThis.clientId || !oThis.brandedTokenId){
      return Promise.reject(responseHelper.error('sam_sp_1', 'Invalid Params', null, {},
        {sendErrorEmail: false}));
    }

    oThis.toStakeAmount = basicHelper.convertToWei(oThis.toStakeAmount.toString());

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * set token uuid.
   *
   * @returns {promise<result>}
   *
   */
  setTokenUuid: async function () {

    const oThis = this;

    const clientBrandedToken = await new ClientBrandedTokenModel().select('*').where(['id=?',oThis.brandedTokenId]).fire();

    oThis.brandedToken = clientBrandedToken[0];
    oThis.uuid = chainInteractionConstants.ST_PRIME_UUID;

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * current step
   *
   * @returns {string}
   *
   */
  currentStep: function() {
    return 'st_prime_stake_and_mint_complete';
  }
};

Object.assign(StPrimeKlass.prototype, StPrimeKlassPrototype);

module.exports = StPrimeKlass;
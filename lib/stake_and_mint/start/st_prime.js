'use strict';

const rootPrefix = '../../..',
  BaseKlass = require(rootPrefix + '/lib/stake_and_mint/start/base'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

const StPrimeKlass = function(params) {
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
  validateAndSanitize: function() {
    const oThis = this;

    oThis.toStakeAmount = oThis.parentCriticalChainInteractionLog.request_params.stake_and_mint_params.st_prime_to_mint;

    if (!oThis.toStakeAmount || !oThis.clientId || !oThis.brandedTokenId) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'sam_sp_1',
          api_error_identifier: 'invalid_params',
          error_config: errorConfig
        })
      );
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
  setTokenUuid: async function() {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy;

    const clientBrandedToken = await new ClientBrandedTokenModel()
      .select('*')
      .where(['id=?', oThis.brandedTokenId])
      .fire();

    oThis.brandedToken = clientBrandedToken[0];
    oThis.uuid = configStrategy.OST_OPENSTUTILITY_ST_PRIME_UUID;

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

InstanceComposer.registerShadowableClass(StPrimeKlass, 'getStPrimeKlass');

module.exports = StPrimeKlass;

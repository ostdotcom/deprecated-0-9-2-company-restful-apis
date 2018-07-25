'use strict';

const rootPrefix = '../../..',
  BaseKlass = require(rootPrefix + '/lib/stake_and_mint/start/base.js'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

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
const BrandedTokenKlass = function(params) {
  const oThis = this;

  BaseKlass.call(oThis, params);
};

BrandedTokenKlass.prototype = Object.create(BaseKlass.prototype);

const BrandedTokenKlassPrototype = {
  /**
   * Validate and sanitize
   *
   * @returns {promise<result>}
   *
   */
  validateAndSanitize: function() {
    const oThis = this;

    oThis.toStakeAmount =
      oThis.parentCriticalChainInteractionLog.request_params.stake_and_mint_params.ost_to_stake_to_mint_bt;

    if (!oThis.toStakeAmount || !oThis.clientId || !oThis.brandedTokenId) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'sam_bt_1',
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
    const oThis = this;

    const clientBrandedToken = await new ClientBrandedTokenModel()
      .select('*')
      .where(['id=?', oThis.brandedTokenId])
      .fire();

    oThis.brandedToken = clientBrandedToken[0];
    oThis.uuid = oThis.brandedToken.token_uuid;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * current step
   *
   * @returns {string}
   *
   */
  currentStep: function() {
    return 'bt_stake_and_mint_complete';
  }
};

Object.assign(BrandedTokenKlass.prototype, BrandedTokenKlassPrototype);

module.exports = BrandedTokenKlass;

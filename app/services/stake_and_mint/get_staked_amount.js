"use strict";

const rootPrefix = '../../..'
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , ClientSecuredBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
    , openStPlatform = require('@openstfoundation/openst-platform')
;

/**
 * Add new transaction kind constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id for whom staked amount is to be fetched
 * @param {number} params.token_symbol - symbol of whom staked amount is to be fetched
 *
 * @constructor
 *
 */
const GetStakedAmountKlass = function (params) {

  var oThis = this;

  oThis.clientId = params.client_id;
  oThis.tokenSymbol = params.token_symbol;
  oThis.simpleStakeContractAddr = null;

};

GetStakedAmountKlass.prototype = {

  perform: async function() {

    var oThis = this
        , r = null;

    r = await oThis.validateAndSanitize();
    if(r.isFailure()) return Promise.resolve(r);

    r = await oThis.setSimpleStakeContractAddr();
    if(r.isFailure()) return Promise.resolve(r);

    const object = new openStPlatform.services.stake.getStakedAmount({
      simple_stake_contract_address: oThis.simpleStakeContractAddr
    });

    const handleOpenStPlatformSuccess = function (getStakedAmountRsp) {
      if(getStakedAmountRsp.isSuccess()){
        return responseHelper.successWithData(getStakedAmountRsp.data);
      } else {
        return responseHelper.error(getStakedAmountRsp.err.code, getStakedAmountRsp.err.message);
      }
    };

    return object.perform().then(handleOpenStPlatformSuccess);

  },

  validateAndSanitize: function() {

    var oThis = this;

    if(!oThis.clientId || !oThis.tokenSymbol){
      return Promise.resolve(responseHelper.error('sam_gsa_1', 'Invalid Params'));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  setSimpleStakeContractAddr: async function() {

    var oThis = this;

    const clientSecureBrandedTokenCache = new ClientSecuredBrandedTokenCacheKlass({'tokenSymbol': oThis.tokenSymbol});
    const clientBrandedTokenSecureCacheRsp = await clientSecureBrandedTokenCache.fetch();

    if (clientBrandedTokenSecureCacheRsp.isFailure()) {
      return Promise.resolve(clientBrandedTokenSecureCacheRsp);
    }

    const clientBrandedTokenSecureCacheData = clientBrandedTokenSecureCacheRsp.data;

    oThis.simpleStakeContractAddr = clientBrandedTokenSecureCacheData.simple_stake_contract_addr;

    return Promise.resolve(responseHelper.successWithData({}));

  }

}

module.exports = GetStakedAmountKlass;
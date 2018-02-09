"use strict";

const rootPrefix = '../..'
    , openStPlatform = require('@openstfoundation/openst-platform')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , airdroppedBtBalanceCache = require(rootPrefix + '/lib/cache_management/airdroppedBtBalance')
    , bigNumber = require('bignumber.js')
;

/**
 * @constructor
 * @augments btBalance
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const btBalance = module.exports = function(params) {

  const oThis = this;

  oThis.address = params['address'];
  oThis.erc20Address = params['erc20_address'];
  oThis.clientTokenId = params['client_token_id'];

};

btBalance.prototype.constructor = btBalance;

/**
 * fetch data from airdrop cache and uc
 * sum it up and return in Wei
 *
 * @return {Result}
 */
btBalance.prototype.fetch = async function() {

  const oThis = this;

  const obj = new airdroppedBtBalanceCache({
    'address': oThis.address,
    'client_token_id': oThis.clientTokenId
  });

  const airdroppedBalanceResponse = await obj.fetch();

  if (airdroppedBalanceResponse.isFailure()) {

    return airdroppedBalanceResponse;

  } else {

    console.log(airdroppedBalanceResponse.data);
    const airdroppedBalance = new bigNumber(String(airdroppedBalanceResponse.data));

    // as Platform has already cached BT Balance we directly hit that cache
    const obj = new openStPlatform.services.balance.brandedToken(
        {'address': oThis.address, 'erc20_address': oThis.erc20Address}
    );

    const btBalanceResponse = await obj.perform();

    if (btBalanceResponse.isFailure()) {
      return btBalanceResponse;
    }

    console.log(btBalanceResponse.data);
    const btBalance = new bigNumber(String(btBalanceResponse.data['balance']));

    const sum = btBalance.plus(airdroppedBalance);

    return responseHelper.successWithData(sum);

  }

};
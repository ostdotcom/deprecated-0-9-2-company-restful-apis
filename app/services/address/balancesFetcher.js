"use strict";

const rootPrefix = '../../..'
  , openStPlatform = require('@openstfoundation/openst-platform')
;

const balancesFetcher = {

  fetchEthBalance: function(address){

    const obj = new openStPlatform.services.balance.eth({'address': address});

    return obj.perform();

  },

  fetchOstBalance: function(address){

    const obj = new openStPlatform.services.balance.simpleToken({'address': address});

    return obj.perform();

  },

  fetchOstPrimeBalance: function(address){

    const obj = new openStPlatform.services.balance.simpleTokenPrime({'address': address});

    return obj.perform();

  },

  fetchBrandedTokenBalance: function(erc20_address, address){

    const obj = new openStPlatform.services.balance.brandedToken(
          {'address': address, 'erc20_address': erc20_address}
        );

    return obj.perform();

  }

};

module.exports = balancesFetcher;
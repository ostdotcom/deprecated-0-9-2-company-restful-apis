'use strict';

const rootPrefix = '../..';

const Buffer = require('safe-buffer').Buffer,
  Tx = require('ethereumjs-tx'),
  BigNumber = require('bignumber.js');

// Please declare your require variable here.
let nonceManagerKlass,
  responseHelper,
  logger,
  coreConstants,
  valueChainGasPriceCacheKlass,
  ChainGethProvidersCache,
  configStrategyHelper,
  fetchPrivateKeyKlass;

// NOTE :: Please define all your requires inside the function
const initRequires = function() {
  nonceManagerKlass = nonceManagerKlass || require(rootPrefix + '/module_overrides/web3_eth/nonce_manager');
  responseHelper = responseHelper || require(rootPrefix + '/lib/formatter/response');
  logger = logger || require(rootPrefix + '/lib/logger/custom_console_logger');
  valueChainGasPriceCacheKlass =
    valueChainGasPriceCacheKlass || require(rootPrefix + '/lib/shared_cache_management/estimate_value_chain_gas_price');
  coreConstants = coreConstants || require(rootPrefix + '/config/core_constants');
  ChainGethProvidersCache = require(rootPrefix + '/lib/shared_cache_management/chain_geth_providers');
  configStrategyHelper = require(rootPrefix + '/helpers/config_strategy/by_client_id');
  fetchPrivateKeyKlass = require(rootPrefix + '/lib/shared_cache_management/address_private_key');
};

const SignRawTx = function(host, rawTx) {
  const oThis = this;

  initRequires();

  logger.debug('rawTx:\n', rawTx);
  oThis.rawTx = rawTx;
  oThis.host = host;

  oThis.fromAddress = oThis.rawTx.from;
  oThis.gasPrice = String(oThis.rawTx.gasPrice || 0);

  // declaring the vars which will be populated while perform
  oThis.chainGasPrice = null;
  oThis.bnChainGasPrice = null;
  oThis.chainKind = null;
  oThis.clientId = null;
  oThis.chainId = null;
  oThis.gethWsProviders = null;
  oThis.privateKeyObj = null;
  oThis.configStrategy = null;
  oThis.nonceManager = null;
};

SignRawTx.prototype = {
  /**
   * Perform
   *
   * @returns {promise<*>}
   */
  perform: async function() {
    const oThis = this;

    oThis._sanitize();

    //Get the private key.
    await oThis._getPrivateKey();

    // nonce cache key has chain kind. need to fetch it.
    await oThis._getChainInfo();

    await oThis._setRawTxGasPrice();

    await oThis._fetchNonceAndAddToRawTransaction();

    return oThis._signTransactionLocally();
  },

  /**
   * Mark as success
   *
   * @returns {promise}
   */
  markAsSuccess: async function() {
    const oThis = this;

    return oThis.nonceManager.completionWithSuccess();
  },

  /**
   * Mark as failure
   *
   * @param shouldSyncNonce {bool} - should the nonce be synced?
   *
   * @returns {promise}
   */
  markAsFailure: async function(shouldSyncNonce) {
    const oThis = this;

    return oThis.nonceManager.completionWithFailure(shouldSyncNonce);
  },

  _sanitize: function() {
    const oThis = this;

    // convert to hex. since we are signing the tx here, the value should mandatorily be in HEX.
    let value = new BigNumber(oThis.rawTx.value || 0);
    oThis.rawTx.value = '0x' + value.toString(16);
  },

  /**
   * Get private key for the fromAddress
   *
   * @returns {promise}
   *
   * @private
   */
  _getPrivateKey: async function() {
    const oThis = this;

    if (oThis._signTransactionLocally !== SignRawTx.prototype._signTransactionLocally) return;

    const fetchPrivateKeyObj = new fetchPrivateKeyKlass({ address: oThis.fromAddress }),
      fetchPrivateKeyRsp = await fetchPrivateKeyObj.fetchDecryptedData();

    if (fetchPrivateKeyRsp.isFailure()) {
      const errorMsg = 'Private key not found for address: ' + oThis.fromAddress;
      return Promise.reject(errorMsg);
    }

    // Get private key - this should be the private key without 0x at the beginning.
    let privateKey = fetchPrivateKeyRsp.data['private_key_d'];
    if (privateKey.slice(0, 2).toLowerCase() === '0x') {
      privateKey = privateKey.substr(2);
    }

    //IMPORTANT: The below code is meant for security. Its not overhead. Its security.
    let privateKeyObj = new Buffer(privateKey, 'hex');
    let rawTx = Object.assign({}, oThis.rawTx);
    oThis.rawTx = null;

    oThis._signTransactionLocally = function() {
      let tx = new Tx(rawTx);

      tx.sign(privateKeyObj);

      return tx.serialize();
    };
    oThis.clientId = fetchPrivateKeyRsp.data['client_id'];
  },

  /**
   * Get chain info
   *
   * @returns {promise}
   *
   * @private
   */
  _getChainInfo: async function() {
    const oThis = this;

    if (oThis.chainId) return;

    // Fetch details from cache.
    if (oThis.clientId === '0') {
      let chainGethProvidersCacheObject = new ChainGethProvidersCache({ gethProvider: oThis.host });

      let response = await chainGethProvidersCacheObject.fetch();
      if (response.isFailure()) {
        return Promise.reject(response);
      }

      let cacheResponse = response.data;

      // Set the variables for further use.
      oThis.chainId = cacheResponse['chainId'];
      oThis.chainKind = cacheResponse['chainKind'];
      oThis.gethWsProviders = cacheResponse['siblingEndpoints'];

      // Passing empty object as nonce manager class needs this as a param.
      oThis.configStrategy = {};
    }
    // Fetch details for a client.
    else {
      let configStrategyHelperObj = new configStrategyHelper();

      let configStrategyResponse = await configStrategyHelperObj.getConfigStrategy(oThis.clientId);
      if (configStrategyResponse.isFailure()) {
        return Promise.reject(configStrategyResponse);
      }

      oThis.configStrategy = configStrategyResponse.data;

      let valueProviders = oThis.configStrategy.OST_VALUE_GETH_WS_PROVIDERS,
        utilityProviders = oThis.configStrategy.OST_UTILITY_GETH_WS_PROVIDERS;

      // We identify chain kind and geth providers in this manner to save one cache hit.
      if (valueProviders.includes(host)) {
        oThis.chainKind = 'value';
        oThis.gethWsProviders = valueProviders;
      } else if (utilityProviders.includes(host)) {
        oThis.chainKind = 'utility';
        oThis.gethWsProviders = utilityProviders;
      }
    }

    return Promise.resolve();
  },

  /**
   * Set raw transaction gas price
   *
   * @returns {promise}
   *
   * @private
   */
  _setRawTxGasPrice: async function() {
    const oThis = this;

    if (String(oThis.chainKind).toLowerCase() === 'value') {
      let valueChainGasPriceCacheObj = new valueChainGasPriceCacheKlass(),
        chainGasPriceRsp = await valueChainGasPriceCacheObj.fetch();

      oThis.chainGasPrice = chainGasPriceRsp.data;
    } else {
      if (oThis.clientId === '0') {
        oThis.chainGasPrice = coreConstants.OST_UTILITY_GAS_PRICE;
      } else {
        oThis.chainGasPrice = oThis.configStrategy.OST_UTILITY_GAS_PRICE;
      }
    }

    oThis.bnChainGasPrice = new BigNumber(oThis.chainGasPrice);

    if (oThis.bnChainGasPrice.isZero()) {
      logger.debug('WARN :: Gas Price for chainKind', oThis.chainKind, 'is zero.');
    } else {
      oThis.rawTx.gasPrice = oThis.chainGasPrice;
      logger.debug('Auto-corrected gas price to', oThis.rawTx.gasPrice);
    }
  },

  /**
   * Fetch nonce and add to raw transaction
   *
   * @returns {promise}
   *
   * @private
   */
  _fetchNonceAndAddToRawTransaction: async function() {
    const oThis = this;

    oThis.nonceManager = new nonceManagerKlass({
      address: oThis.fromAddress,
      chain_kind: oThis.chainKind,
      client_id: oThis.clientId,
      host: oThis.host,
      chain_id: oThis.chainId,
      geth_providers: oThis.gethWsProviders,
      config_strategy: oThis.configStrategy
    });
    // We are passing gethWsProviders here as we don't want to make another cache hit in nonce manager class.
    // The providers have been fetched depending on the clientId as well as the cache kind.

    const getNonceResponse = await oThis.nonceManager.getNonce();

    if (getNonceResponse.isFailure()) {
      return Promise.reject(getNonceResponse);
    }

    oThis.rawTx.nonce = getNonceResponse.data.nonce;
  },

  /**
   * Sign transaction locally
   *
   * @returns {object} signed transaction
   *
   * @private
   */
  _signTransactionLocally: function() {
    throw 'Key not available';
  }
};

module.exports = SignRawTx;

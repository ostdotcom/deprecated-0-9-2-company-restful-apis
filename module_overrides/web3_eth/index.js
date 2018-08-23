'use strict';

const basePackage = 'web3-eth';

const BasePackage = require(basePackage),
  Buffer = require('safe-buffer').Buffer,
  Tx = require('ethereumjs-tx'),
  BigNumber = require('bignumber.js');

const rootPrefix = '../..';

// Please declare your require variables here.
let nonceManagerKlass, responseHelper, logger, chainInteractionConstants, valueChainGasPriceCacheKlass;

// NOTE :: Please define all your requires inside the function
function initRequires() {
  nonceManagerKlass = nonceManagerKlass || require(rootPrefix + '/module_overrides/web3_eth/nonce_manager');
  responseHelper = responseHelper || require(rootPrefix + '/lib/formatter/response');
  logger = logger || require(rootPrefix + '/lib/logger/custom_console_logger');
  valueChainGasPriceCacheKlass= valueChainGasPriceCacheKlass || require(rootPrefix + '/lib/cache_management/estimate_value_chain_gas_price');
  chainInteractionConstants = chainInteractionConstants || require(rootPrefix + '/config/chain_interaction_constants');
}

// Module Override Code - Part 1
let requireData, resolvedId, resolvedFileName;

for (let k in require.cache) {
  if (k.indexOf('/' + basePackage + '/src/index.js') > -1) {
    requireData = require.cache[k];
    resolvedId = requireData.id;
    resolvedFileName = requireData.filename;
    delete require.cache[k];
  }
}

// Derived Class Definition/Implementation
const Derived = function() {
  let oThis = this;

  initRequires();

  logger.debug('Derived Constructor of ', basePackage, ' invoked!');

  //Constructor sometimes return other instance of object.
  //Always have a safety-net
  const output = BasePackage.apply(oThis, arguments);
  //Safety Net
  oThis = output || oThis;

  const _sendTransaction = oThis.sendTransaction;

  oThis.sendTransaction = function() {
    logger.debug('HACKED sendTransaction INVOKED');
    logger.debug('arguments of sendTransaction', arguments);

    const rawTx = arguments['0'],
      fromAddress = rawTx.from,
      gasPrice = String(rawTx.gasPrice || 0),
      bnGasPrice = new BigNumber(gasPrice),
      host = oThis.currentProvider.host ? oThis.currentProvider.host : oThis.currentProvider.connection._url,
      chainKind = chainInteractionConstants.GETH_PROVIDER_TO_CHAIN_KIND_MAP[host];

    let chainGasPrice, bnChainGasPrice, chainId, privateKeyObj;

    if (chainInteractionConstants.ADDRESSES_TO_UNLOCK_VIA_KEYSTORE_FILE_MAP[fromAddress.toLowerCase()]) {
      logger.info('WEB3_OVERRIDE: sendTransaction using passphrase from address:', fromAddress);
      return _sendTransaction.apply(this, arguments);
    } else {
      logger.info('WEB3_OVERRIDE: sendTransaction using private key from address:', fromAddress);

      const Web3PromiEvent = require('web3-core-promievent'),
        hackedReturnedPromiEvent = Web3PromiEvent(),
        fetchPrivateKeyKlass = require(rootPrefix + '/lib/cache_management/address_private_key');

      var txHashObtained = false,
        retryCount = 0;

      const maxRetryFor = 2;

      /**
       * Sanitizes and sets the transaction value.
       *
       */
      const sanitize = function () {
        // convert to hex
        let value = new BigNumber(rawTx.value || 0);
        rawTx.value = '0x' + value.toString(16);
      };

      /**
       * Fetches the decrypted private key and the clientId.
       *
       * @returns {Promise<*>}
       */
      const getPrivateKey = async function () {
        const fetchPrivateKeyObj = new fetchPrivateKeyKlass({address: fromAddress}),
          fetchPrivateKeyRsp = await fetchPrivateKeyObj.fetchDecryptedData();

        if (fetchPrivateKeyRsp.isFailure()) {
          const errorMsg = 'Private key not found for address: ' + fromAddress;

          hackedReturnedPromiEvent.eventEmitter.emit('error', errorMsg);
          hackedReturnedPromiEvent.reject(errorMsg);

          return Promise.reject(errorMsg);
        }

        // Get private key - this should be the private key without 0x at the beginning.
        let privateKey = fetchPrivateKeyRsp.data['private_key_d'];
        if (privateKey.slice(0, 2).toLowerCase() === '0x') {
          privateKey = privateKey.substr(2);
        }

        privateKeyObj = new Buffer(privateKey, 'hex');

        return Promise.resolve();
      };

      /**
       * Sets the chain gas price for the transaction.
       *
       */
      const setRawTxGasPrice = async function () {

        if (String(chainKind).toLowerCase() === "value") {
          
          let valueChainGasPriceCacheObj = new valueChainGasPriceCacheKlass(),
            chainGasPriceRsp = await valueChainGasPriceCacheObj.fetch();
          chainGasPrice = chainGasPriceRsp.data;
          
        } else {
          
          chainGasPrice = chainInteractionConstants.UTILITY_GAS_PRICE;
          
        }

        bnChainGasPrice = new BigNumber(chainGasPrice);

        if (bnChainGasPrice.isZero()) {
          logger.debug('WARN :: Gas Price for chainKind', chainKind, 'is zero.');
        } else {
          rawTx.gasPrice = chainGasPrice;
          logger.debug('Auto-corrected gas price to', rawTx.gasPrice);
          console.trace('WARN :: sendTransaction called without setting gas price.\nPlease see trace for more info');

      };


      const fetchNonceAndAddToRawTransaction = async function () {

        await setRawTxGasPrice();

        const nonceManager = new nonceManagerKlass({
          address: fromAddress,
          chain_kind: chainKind,
          chain_id: chainId
        });
        // We are passing gethWsProviders here as we don't want to make another cache hit in nonce manager class.
        // The providers have been fetched depending on the clientId as well as the cache kind.

        const getNonceResponse = await nonceManager.getNonce();

        if (getNonceResponse.isFailure()) {
          return Promise.resolve(getNonceResponse);
        }

        rawTx.nonce = getNonceResponse.data.nonce;

        return Promise.resolve(responseHelper.successWithData({nonceManager: nonceManager}));
      };

      /**
       * Signs the transactions.
       *
       * @returns {*}
       */
      const signTransactionLocally = function () {
        const tx = new Tx(rawTx);
        tx.sign(privateKeyObj);
        console.log('rawTx**********',rawTx);
        return tx.serialize();
      };

      const executeTx = async function () {
        // Fetch Private Key if not present.
        if (!privateKeyObj) {
          logger.log('executeTx :: getPrivateKey initiated');
          //Get the private key.
          await getPrivateKey().catch(function (reason) {
            logger.error('executeTx :: getPrivateKey :: Failed to get private key. reason', reason);
            return Promise.reject(reason);
          });
        }

        const fetchNonceResult = await fetchNonceAndAddToRawTransaction();

        if (fetchNonceResult.isFailure()) {
          hackedReturnedPromiEvent.reject({message: fetchNonceResult.toHash().err.msg});
          return Promise.resolve();
        }

        const nonceManager = fetchNonceResult.data.nonceManager;

        logger.log('executeTx :: sendSignedTx initiated');
        await sendSignedTx(nonceManager);
      };

      const sendSignedTx = function (nonceManager) {
        const serializedTx = signTransactionLocally();

        const onTxHash = async function (hash) {
          if (!txHashObtained) {
            txHashObtained = true;
            await nonceManager.completionWithSuccess();
          }
          hackedReturnedPromiEvent.eventEmitter.emit('transactionHash', hash);
        };

        const onReceipt = function (receipt) {
          hackedReturnedPromiEvent.eventEmitter.emit('receipt', receipt);
        };

        const onError = async function (error) {
          const nonceTooLowError = error.message.indexOf('nonce too low') > -1;
          if (nonceTooLowError && retryCount < maxRetryFor) {
            logger.error('NONCE too low error. retrying with higher nonce.');
            retryCount = retryCount + 1;

            // clear the nonce
            await nonceManager.completionWithFailure(true);

            // retry
            executeTx();
          } else {
            if (txHashObtained) {
              // neglect if hash was already given.
              return;
            }
            logger.error('error', error);
            await nonceManager.completionWithFailure();
            hackedReturnedPromiEvent.eventEmitter.emit('error', error);
            hackedReturnedPromiEvent.reject.apply(hackedReturnedPromiEvent, error);
          }
        };

        const onResolve = function () {
          hackedReturnedPromiEvent.resolve.apply(hackedReturnedPromiEvent, arguments);
        };

        const onReject = function () {
          logger.error(arguments);
          // hackedReturnedPromiEvent.reject.apply(hackedReturnedPromiEvent, arguments);
        };

        return oThis
          .sendSignedTransaction('0x' + serializedTx.toString('hex'))
          .once('transactionHash', onTxHash)
          .once('receipt', onReceipt)
          .on('error', onError)
          .then(onResolve, onReject)
          .catch(onReject);
      };

      const asyncPerformer = async function () {
        sanitize();

        executeTx();

        return Promise.resolve();
      };

      asyncPerformer();

      return hackedReturnedPromiEvent.eventEmitter;
    }

  };

  return oThis;

};



Derived.isOSTVersion = true;

// Module Override Code - Part 2
require.cache[resolvedId] = {
  id: resolvedId,
  filename: resolvedFileName,
  loaded: true,
  exports: Derived
};

module.exports = Derived;

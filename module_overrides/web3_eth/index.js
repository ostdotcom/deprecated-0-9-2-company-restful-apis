'use strict';

const basePackage = 'web3-eth';

const BasePackage = require(basePackage);

const rootPrefix = '../..';

// Please declare your require variable here.
let responseHelper, logger, coreConstants, SignRawTx, moUtils, web3InteractFactory;

// NOTE :: Please define all your requires inside the function
const initRequires = function() {
  responseHelper = responseHelper || require(rootPrefix + '/lib/formatter/response');
  logger = logger || require(rootPrefix + '/lib/logger/custom_console_logger');
  coreConstants = coreConstants || require(rootPrefix + '/config/core_constants');
  SignRawTx = SignRawTx || require(rootPrefix + '/module_overrides/common/sign_raw_tx');
  web3InteractFactory = web3InteractFactory || require(rootPrefix + '/lib/web3/interact/ws_interact');
  moUtils = moUtils || require(rootPrefix + '/module_overrides/common/utils');
};

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

  //Constructor sometimes return other instance of object.
  //Always have a safety-net
  const output = BasePackage.apply(oThis, arguments);
  //Safety Net
  oThis = output || oThis;

  let fetchReceipt, getReceipt;

  const _sendTransaction = oThis.sendTransaction;

  oThis.sendTransaction = function(orgRawTx, orgCallback) {
    const rawTx = arguments['0'],
      fromAddress = rawTx.from,
      host = moUtils.getHost(oThis.currentProvider);

    if (moUtils.isUnlockable(fromAddress)) {
      return _sendTransaction.apply(this, arguments);
    } else {
      const Web3PromiEvent = require('web3-core-promievent'),
        hackedReturnedPromiEvent = Web3PromiEvent();

      let signRawTx = new SignRawTx(host, rawTx);

      let txHashObtained = false,
        nonceTooLowErrorRetryCount = 0,
        chainNodeDownErrorRetryCount = 0;

      const sendSignedTx = function(signTxRsp) {
        const onTxHash = async function(hash) {
          if (!txHashObtained) {
            txHashObtained = true;
            await signRawTx.markAsSuccess(hash);
          }

          hackedReturnedPromiEvent.eventEmitter.emit('rawTransactionDetails', rawTx);
          // Emit rawTransactionDetails before transactionHash returns Promise.resolve().
          hackedReturnedPromiEvent.eventEmitter.emit('transactionHash', hash);

          if (!hackedReturnedPromiEvent.eventEmitter || !hackedReturnedPromiEvent.eventEmitter._events) {
            logger.debug('hackedReturnedPromiEvent.eventEmitter empty', hackedReturnedPromiEvent.eventEmitter);
          }

          if (
            hackedReturnedPromiEvent.eventEmitter &&
            hackedReturnedPromiEvent.eventEmitter._events &&
            hackedReturnedPromiEvent.eventEmitter._events['receipt']
          ) {
            logger.debug('Fetching Receipt for hash: ', hash);
            fetchReceipt(hash)
              .then(function(receipt) {
                onReceipt(receipt);
                onResolve(receipt);
              })
              .catch(function(reason) {
                onReject && onReject(reason);
              });
          } else {
            logger.debug('No need for receipt. Resolving Promise with hash');
            onResolve(hash);
          }
        };

        const onReceipt = function(receipt) {
          hackedReturnedPromiEvent.eventEmitter.emit('receipt', receipt);
        };

        const onError = async function(error) {
          if (moUtils.isNonceTooLowError(error) && nonceTooLowErrorRetryCount < moUtils.nonceTooLowErrorMaxRetryCnt) {
            logger.error('NONCE too low error. retrying with higher nonce.');
            nonceTooLowErrorRetryCount = nonceTooLowErrorRetryCount + 1;

            // resync nonce from chain
            await signRawTx.markAsFailure(true);

            // retry
            executeTx();
          } else if (
            moUtils.isChainNodeDownError(error) &&
            chainNodeDownErrorRetryCount < moUtils.chainNodeDownErrorMaxRetryCnt
          ) {
            chainNodeDownErrorRetryCount = chainNodeDownErrorRetryCount + 1;

            let wsChainNodeUrl =
              signTxRsp['chain_ws_providers'][chainNodeDownErrorRetryCount % signTxRsp['chain_ws_providers'].length];

            logger.error(
              `nodeDownRetryAttemptNo: ${chainNodeDownErrorRetryCount} Chain Node Down error for: ${host}. retrying on same / other node: ${wsChainNodeUrl}. error: ${
                error.message
              }`
            );

            let web3Instance = web3InteractFactory.getInstance('utility', wsChainNodeUrl).web3WsProvider;

            // retry submitting this tx on a given chain node
            moUtils.submitTransactionToChain({
              web3Instance: web3Instance,
              signTxRsp: signTxRsp,
              onError: onError,
              onReject: onReject,
              onTxHash: onTxHash,
              orgCallback: orgCallback
            });
          } else {
            if (txHashObtained) {
              // neglect if hash was already given.
              return;
            }
            logger.error('finalErrorAfterRetrying', error);
            await signRawTx.markAsFailure();
            hackedReturnedPromiEvent.eventEmitter.emit('rawTransactionDetails', rawTx);
            hackedReturnedPromiEvent.eventEmitter.emit('error', error);
            hackedReturnedPromiEvent.reject(error);
          }
        };

        const onResolve = function() {
          hackedReturnedPromiEvent.resolve.apply(hackedReturnedPromiEvent, arguments);
        };

        const onReject = function() {
          logger.error(arguments);
        };

        moUtils.submitTransactionToChain({
          signTxRsp: signTxRsp,
          onError: onError,
          onReject: onReject,
          onTxHash: onTxHash,
          orgCallback: orgCallback,
          web3Instance: oThis
        });

        return Promise.resolve();
      };

      const executeTx = async function() {
        let signTxRsp, serializedTx, err;

        await signRawTx
          .perform()
          .then(function(result) {
            signTxRsp = result;
            serializedTx = signTxRsp.serializedTx;
          })
          .catch(function(reason) {
            logger.error('signRawTx error ::', reason);
            err = reason;
          });

        if (!serializedTx) {
          hackedReturnedPromiEvent.reject(err);
          return Promise.resolve();
        }

        await sendSignedTx(signTxRsp);
      };

      executeTx();

      return hackedReturnedPromiEvent.eventEmitter;
    }
  };

  Object.assign(oThis.sendTransaction, _sendTransaction);

  getReceipt = function(txHash, resolve, reject, maxAttempts, timeInterval) {
    if (maxAttempts > 0) {
      oThis
        .getTransactionReceipt(txHash)
        .then(function(receipt) {
          if (receipt) {
            return resolve(receipt);
          } else {
            maxAttempts--;
            setTimeout(getReceipt, timeInterval, txHash, resolve, reject, maxAttempts, timeInterval);
          }
        })
        .catch(function(reason) {
          if (maxAttempts > 0) {
            //Ignore reason and retry.
            maxAttempts--;
            setTimeout(getReceipt, timeInterval, txHash, resolve, reject, maxAttempts, timeInterval);
          } else {
            //Throw the error out.
            reject(reason);
          }
        });
    } else {
      return resolve(null);
    }
  };

  fetchReceipt = function(txHash) {
    return new Promise(function(resolve, reject) {
      // number of times it will attempt to fetch
      var maxAttempts = 50;

      // time interval
      const timeInterval = 15000;
      setTimeout(getReceipt, timeInterval, txHash, resolve, reject, maxAttempts, timeInterval);
    });
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

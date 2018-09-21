'use strict';

const basePackage = 'web3-eth';

const BasePackage = require(basePackage);

const rootPrefix = '../..';

// Please declare your require variable here.
let responseHelper, logger, coreConstants, SignRawTx, moUtils;

// NOTE :: Please define all your requires inside the function
const initRequires = function() {
  responseHelper = responseHelper || require(rootPrefix + '/lib/formatter/response');
  logger = logger || require(rootPrefix + '/lib/logger/custom_console_logger');
  coreConstants = coreConstants || require(rootPrefix + '/config/core_constants');
  SignRawTx = SignRawTx || require(rootPrefix + '/module_overrides/common/sign_raw_tx');
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

  let fetchReceipt;

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
        retryCount = 0;

      const sendSignedTx = function(serializedTx) {
        const onTxHash = async function(hash) {
          if (!txHashObtained) {
            txHashObtained = true;
            await signRawTx.markAsSuccess();
          }
          hackedReturnedPromiEvent.eventEmitter.emit('transactionHash', hash);

          if (hackedReturnedPromiEvent.eventEmitter._events['receipt']) {
            console.log('Fetching Receipt');
            fetchReceipt(hash).then(function(receipt) {
              onReceipt(receipt);
              onResolve(receipt);
            });
          } else {
            console.log('No need for receipt. Resolving Promise with hash');
            onResolve(hash);
          }
        };

        const onReceipt = function(receipt) {
          hackedReturnedPromiEvent.eventEmitter.emit('receipt', receipt);
        };

        const onError = async function(error) {
          if (moUtils.isNonceTooLowError(error) && retryCount < moUtils.maxRetryCount) {
            logger.error('NONCE too low error. retrying with higher nonce.');
            retryCount = retryCount + 1;

            // clear the nonce
            await signRawTx.markAsFailure(true);

            // retry
            executeTx();
          } else {
            if (txHashObtained) {
              // neglect if hash was already given.
              return;
            }
            logger.error('error', error);
            await signRawTx.markAsFailure();
            hackedReturnedPromiEvent.eventEmitter.emit('error', error);
            hackedReturnedPromiEvent.reject.apply(hackedReturnedPromiEvent, error);
          }
        };

        const onResolve = function() {
          hackedReturnedPromiEvent.resolve.apply(hackedReturnedPromiEvent, arguments);
        };

        const onReject = function() {
          logger.error(arguments);
        };

        // return oThis
        //   .sendSignedTransaction('0x' + serializedTx.toString('hex'))
        //   .once('transactionHash', onTxHash)
        //   .once('receipt', onReceipt)
        //   .on('error', onError)
        //   .then(onResolve, onReject)
        //   .catch(onReject);

        let batchRequest = new oThis.BatchRequest();

        let sendSignedTransactionRequest = oThis.sendSignedTransaction.request('0x' + serializedTx.toString('hex'));
        sendSignedTransactionRequest.callback = function(err, txHash) {
          try {
            err && onError(err);
            err && onReject(err);
          } catch (e) {}
          try {
            txHash && onTxHash(txHash);
          } catch (e) {}
          try {
            orgCallback && orgCallback(err, txHash);
          } catch (e) {}
        };

        batchRequest.add(sendSignedTransactionRequest);
        batchRequest.execute();

        return Promise.resolve();
      };

      const executeTx = async function() {
        let serializedTx, err;

        await signRawTx
          .perform()
          .then(function(result) {
            serializedTx = result;
          })
          .catch(function(reason) {
            logger.error('signRawTx error ::', reason);
            err = reason;
          });

        if (!serializedTx) {
          hackedReturnedPromiEvent.reject({ message: err });
          return Promise.resolve();
        }

        await sendSignedTx(serializedTx);
      };

      executeTx();

      return hackedReturnedPromiEvent.eventEmitter;
    }
  };

  Object.assign(oThis.sendTransaction, _sendTransaction);

  fetchReceipt = function(txHash) {
    return new Promise(function(resolve, reject) {
      // number of times it will attempt to fetch
      var maxAttempts = 50;

      // time interval
      const timeInterval = 15000;

      var getReceipt = async function() {
        if (maxAttempts > 0) {
          const receipt = await oThis.getTransactionReceipt(txHash);

          if (receipt) {
            return resolve(receipt);
          } else {
            maxAttempts--;
            setTimeout(getReceipt, timeInterval);
          }
        } else {
          return resolve(null);
        }
      };

      getReceipt();
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

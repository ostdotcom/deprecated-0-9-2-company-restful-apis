"use strict";

var basePackage = 'web3-eth'
;

const BasePackage = require(basePackage)
  , Buffer = require('safe-buffer').Buffer
  , Tx = require('ethereumjs-tx')
;

const rootPrefix = '..'
;

var requireData
  , resolvedId
  , resolvedFileName
;

for (var k in require.cache) {
  if (k.indexOf("/" + basePackage + "/src/index.js") > -1) {
    requireData = require.cache[k];
    resolvedId = requireData.id;
    resolvedFileName = requireData.filename;
    delete require.cache[k];
  }
}

const Derived = function () {
  var oThis = this;
  console.log("Derived Constructor of ", basePackage, " invoked!");

  //Constructor sometimes return other instance of object.
  //Always have a safety-net
  const output = BasePackage.apply(oThis, arguments);
  //Safety Net
  oThis = output || oThis;

  const _sendTransaction = oThis.sendTransaction;

  oThis.sendTransaction = function () {

    console.log('HACKED sendTransaction INVOKED');
    console.log("arguments of sendTransaction", arguments);

    const chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
      , rawTx = arguments['0']
      , fromAddress = rawTx.from;

    if (chainInteractionConstants.ADDRESSES_TO_UNLOCK_VIA_KEYSTORE_FILE_MAP[fromAddress.toLowerCase()]) {
      console.log('WEB3_OVERRIDE: sendTransaction using passphrase from address:', fromAddress);
      return _sendTransaction.apply(this, arguments);
    } else {
      console.log('WEB3_OVERRIDE: sendTransaction using private key from address:', fromAddress);

      const Web3PromiEvent = require('web3-core-promievent')
        , hackedReturnedPromiEvent = Web3PromiEvent()
        , fetchPrivateKeyKlass = require(rootPrefix + '/lib/key_management/fetch_private_key.js')
      ;

      var privateKeyObj;

      const getPrivateKey = async function () {
        const fetchPrivateKeyObj = new fetchPrivateKeyKlass({'address': fromAddress})
          , fetchPrivateKeyRsp = await fetchPrivateKeyObj.perform()
        ;

        if (fetchPrivateKeyRsp.isFailure()) {
          const errorMsg = 'Private key not found for address: ' + fromAddress;

          hackedReturnedPromiEvent.eventEmitter.emit('error', errorMsg);
          hackedReturnedPromiEvent.reject(errorMsg);

          return Promise.reject(errorMsg);
        }

        // get private key - this should be the private key without 0x at the beginning.
        const privateKey = fetchPrivateKeyRsp.data['private_key_d'];

        privateKeyObj = new Buffer(privateKey, 'hex');

        return Promise.resolve();
      };

      const fetchNonceAndAddToRawTransaction = function () {
        // add the code by Deepesh here.
        var nonce = null;
        nonce = 13;

        rawTx.nonce = nonce;

        return Promise.resolve();
      };

      const signTransactionLocally = function () {
        const tx = new Tx(rawTx);

        tx.sign(privateKeyObj);

        return tx.serialize();
      };

      const sendSignedTx = function () {
        const serializedTx = signTransactionLocally();

        const onTxHash = function (hash) {
          hackedReturnedPromiEvent.eventEmitter.emit('transactionHash', hash);
        };

        const onReceipt = function (receipt) {
          hackedReturnedPromiEvent.eventEmitter.emit('receipt', receipt);
        };

        const onError = function (error) {
          hackedReturnedPromiEvent.eventEmitter.emit('error', error);
        };

        const onResolve = function () {
          hackedReturnedPromiEvent.resolve.apply(hackedReturnedPromiEvent, arguments);
        };

        const onReject = function () {
          hackedReturnedPromiEvent.reject.apply(hackedReturnedPromiEvent, arguments);
        };

        return oThis.sendSignedTransaction('0x' + serializedTx.toString('hex'))
          .on('transactionHash', onTxHash)
          .on('receipt', onReceipt)
          .on('error', onError)
          .then(onResolve, onReject)
        ;
      };

      const asyncPerformer = async function () {

        await getPrivateKey();

        // privateKeyObj = new Buffer('f83bb3e0d8422878a82cdac0cf1618819e9d72ab1b3d73909457c1ca6f112bcd', 'hex');

        await fetchNonceAndAddToRawTransaction();

        await sendSignedTx();

        return Promise.resolve();
      };

      asyncPerformer();

      return hackedReturnedPromiEvent.eventEmitter;
    }
  };

  return oThis;
};

Derived.isOSTVersion = true;

require.cache[resolvedId] = {
  id: resolvedId,
  filename: resolvedFileName,
  loaded: true,
  exports: Derived
};

module.exports = Derived;

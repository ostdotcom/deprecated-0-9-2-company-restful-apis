"use strict";

var basePackage = 'web3-eth'
;

const BasePackage = require(basePackage)
  , Buffer = require('safe-buffer').Buffer
  , Tx = require('ethereumjs-tx')
  , BigNumber = require('bignumber.js')
;

const rootPrefix = '../..'
;

var requireData
  , resolvedId
  , resolvedFileName
  , nonceManagerKlass
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

      const sanitize = function() {
        // convert to hex
        var value = new BigNumber(rawTx.value || 0);
        rawTx.value = value.toString(16);
      };

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
        var privateKey = fetchPrivateKeyRsp.data['private_key_d'];
        if(privateKey.slice(0, 2).toLowerCase() === '0x'){
          privateKey = privateKey.substr(2);
        }

        privateKeyObj = new Buffer(privateKey, 'hex');

        return Promise.resolve();
      };

      const fetchNonceAndAddToRawTransaction = async function () {
        const chainKind = chainInteractionConstants.GETH_PROVIDER_TO_CHAIN_KIND_MAP[oThis.currentProvider.host];
        const nonceManager = new nonceManagerKlass({address: fromAddress, chain_kind: chainKind});

        const getNonceResponse = await nonceManager.getNonce();

        if(getNonceResponse.isFailure()) {
          return Promise.reject('Nonce Manager returned error code:' +
            getNonceResponse.err.code +
            ' message: ' + getNonceResponse.err.msg);
        }

        rawTx.nonce = getNonceResponse.data.nonce;

        return Promise.resolve(nonceManager);
      };

      const signTransactionLocally = function () {
        const tx = new Tx(rawTx);

        tx.sign(privateKeyObj);

        return tx.serialize();
      };

      const sendSignedTx = function (nonceManager) {
        const serializedTx = signTransactionLocally();

        const onTxHash = function (hash) {
          nonceManager.completionWithSuccess();
          hackedReturnedPromiEvent.eventEmitter.emit('transactionHash', hash);
        };

        const onReceipt = function (receipt) {
          hackedReturnedPromiEvent.eventEmitter.emit('receipt', receipt);
        };

        const onError = function (error) {
          // decide if nonce has to be synced or not.
          nonceManager.completionWithFailure();
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

        sanitize();

        await getPrivateKey();

        // privateKeyObj = new Buffer('9d4d735101413ab8091197df5dd84d53fb182969004e95c70a36f3594bafc249', 'hex');

        const nonceManager = await fetchNonceAndAddToRawTransaction();

        await sendSignedTx(nonceManager);

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

// NOTE::THIS SHOULD NOT BE TAKEN AT THE TOP.
nonceManagerKlass = require(rootPrefix + '/module_overrides/web3_eth/nonce_manager');

module.exports = Derived;

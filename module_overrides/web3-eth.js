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

      var Web3PromiEvent = require('web3-core-promievent')
        , hackedReturnedPromiEvent = Web3PromiEvent()
      ;
      // get and add nonce to raw transaction
      var nonce = 12;
      rawTx.nonce = nonce;

      // get private key
      var pk = 'f83bb3e0d8422878a82cdac0cf1618819e9d72ab1b3d73909457c1ca6f112bcd';
      // remove the '0x' from front of private

      const privateKeyObj = new Buffer(pk, 'hex');
      const tx = new Tx(rawTx);
      tx.sign(privateKeyObj);
      const serializedTx = tx.serialize();

      const onTxHash = function(hash){
        hackedReturnedPromiEvent.eventEmitter.emit('transactionHash', hash);
      };

      const onReceipt = function(receipt){
        hackedReturnedPromiEvent.eventEmitter.emit('receipt', receipt);
      };

      const onError = function(error){
        hackedReturnedPromiEvent.eventEmitter.emit('error', error);
      };

      const onResolve = function() {
        hackedReturnedPromiEvent.resolve.apply(hackedReturnedPromiEvent, arguments);
      };

      const onReject = function() {
        hackedReturnedPromiEvent.reject.apply(hackedReturnedPromiEvent, arguments);
      };

      oThis.sendSignedTransaction('0x' + serializedTx.toString('hex'))
        .on('transactionHash', onTxHash)
        .on('receipt', onReceipt)
        .on('error', onError)
        .then(onResolve, onReject)
      ;

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

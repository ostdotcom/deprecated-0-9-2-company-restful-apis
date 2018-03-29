const Buffer = require('safe-buffer').Buffer
  , Tx = require('ethereumjs-tx')
;

const rootPrefix = '..'
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , fetchPrivateKeyKlass = require(rootPrefix + '/lib/key_management/fetch_private_key')
  , nonceHelperKlass = require(rootPrefix + '/module_overrides/web3_eth/nonce_helper')
  , nonceHelper = new nonceHelperKlass()
;

const FillUpMissingNonce = function(params) {
  const oThis = this
  ;

  oThis.fromAddress = params.from_address.toLowerCase();
  oThis.toAddress = params.to_address.toLowerCase();
  oThis.chainKind = params.chain_kind;
  oThis.missingNonce = params.missing_nonce;

  oThis.privateKeyObj = null;
  oThis.rawTx = null;
};

FillUpMissingNonce.prototype = {
  perform: async function() {
    const oThis = this
    ;

    await oThis.initializeRawTx();

    await oThis.setPrivateKey();

    await oThis.sendSignedTx();
  },

  initializeRawTx : function() {
    const oThis = this
    ;

    const gasPrice = (oThis.chainKind == 'value') ? chainInteractionConstants.VALUE_GAS_PRICE :
      chainInteractionConstants.UTILITY_GAS_PRICE;

    oThis.rawTx = {
      from: oThis.fromAddress,
      to: oThis.toAddress,
      value: '0x1',
      gasPrice: gasPrice,
      gas: 25000,
      nonce: oThis.missingNonce
    };

    return Promise.resolve();
  },

  setPrivateKey: async function () {
    const oThis = this
      , fetchPrivateKeyObj = new fetchPrivateKeyKlass({'address': oThis.fromAddress})
      , fetchPrivateKeyRsp = await fetchPrivateKeyObj.perform()
    ;

    if(fetchPrivateKeyRsp.isFailure()) {
      throw 'private key not found';
    }

    // get private key - this should be the private key without 0x at the beginning.
    var privateKey = fetchPrivateKeyRsp.data['private_key_d'];
    if(privateKey.slice(0, 2).toLowerCase() === '0x'){
      privateKey = privateKey.substr(2);
    }

    oThis.privateKeyObj = new Buffer(privateKey, 'hex');

    return Promise.resolve();
  },

  sendSignedTx: function () {
    const oThis = this
    ;

    const tx = new Tx(oThis.rawTx);

    tx.sign(oThis.privateKeyObj);

    const serializedTx =  tx.serialize();

    const provider = (oThis.chainKind == 'value') ? chainInteractionConstants.VALUE_GETH_WS_PROVIDER :
      chainInteractionConstants.UTILITY_GETH_WS_PROVIDER;

    const  providerObj = nonceHelper.getWeb3Instance(provider, oThis.chainKind);

    return providerObj.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
      .once('transactionHash', function(txHash){console.log('transaction_hash:', txHash);})
      .once('receipt', function(receipt){console.log('receipt:', receipt);})
      .on('error', function(error){console.log('error:', error);})
      ;
  }
};

module.exports = FillUpMissingNonce;
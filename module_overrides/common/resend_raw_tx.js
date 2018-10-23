'use strict';

const rootPrefix = '../..',
  SignRawTx = require(rootPrefix + '/module_overrides/common/sign_raw_tx'),
  moUtils = require(rootPrefix + '/module_overrides/common/utils'),
  OSTBase = require('@openstfoundation/openst-base'),
  OstWeb3 = OSTBase.OstWeb3;

const ResendRawTx = function(rawTx, gethUrl) {
  const oThis = this;

  oThis.rawTx = rawTx;
  gethUrl = gethUrl;
  oThis.gethProvider = new OstWeb3.providers.WebsocketProvider(gethUrl);
};

ResendRawTx.prototype = {
  perform: async function() {
    const oThis = this;

    let host = moUtils.getHost(oThis.gethProvider);

    let signRawTx = new SignRawTx(host, oThis.rawTx);
    let serializedTx;

    await signRawTx
      .perform()
      .then(function(result) {
        serializedTx = result;
      })
      .catch(function(reason) {
        logger.error('signRawTx error ::', reason);
      });

    let web3 = new OstWeb3(oThis.gethProvider);
    web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'), (err, hash) => {
      if (err) {
        console.log(err);
        return;
      }

      console.log('Transaction hash: ' + hash);
    });
  }
};

module.exports = ResendRawTx;

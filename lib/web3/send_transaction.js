"use strict";
/*
 * Web3 send transaction
 *
 * * Author: Kedar
 * * Date: 23/10/2017
 * * Reviewed by: Sunil
 */

const web3RpcProvider = require('./rpc_provider')
  , responseHelper = require('../formatter/response');

const web3SendTransaction = {

  perform: function (sigedTx) {

    return new Promise(function (onResolve, onReject) {

      // end the response once you get the transaction hash.
      const onTxHash = function (transactionHash) {
        console.log('--- Transaction hash received successfully.');
        onResolve(responseHelper.successWithData({transaction_hash: transactionHash}));
      };

      const onTxHashError = function (err) {
        console.error('### Error while getting transaction hash.');
        console.error(err);
        onResolve(responseHelper.error('publicGeth(' + err.message + ')', 'transaction hash not obtained.'));
      };

      web3RpcProvider.eth.sendSignedTransaction(sigedTx).once('transactionHash', onTxHash)
        .catch(onTxHashError);

    });
  }

};

module.exports = web3SendTransaction;
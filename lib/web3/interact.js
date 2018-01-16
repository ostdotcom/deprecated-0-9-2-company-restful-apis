"use strict";
/*
 * Web3 WS provider
 *
 * * Author: Kedar, Alpesh
 * * Date: 08/11/2017
 * * Reviewed by: Sunil
 */

const web3RpcProvider = require('./rpc_provider')
  , responseHelper = require('../formatter/response')
  , web3LogsDecoder = require('../web3/logs_decoder');

const _private = {

  // format the transaction receipt and decode the logs.
  formatTxReceipt: function(txReceipt) {

    return new Promise(function(onResolve, onReject){
      return onResolve(web3LogsDecoder.perform(txReceipt));
    });

  },

  formatBlock: function(block) {
    return new Promise(function(onResolve, onReject){
      var r = null;

      if (block) {
        r = responseHelper.successWithData({
          'block_hash': block.hash,
          'block_number': block.number,
          'transactions': block.transactions,
          'timestamp': block.timestamp
        });
      } else {
        r = responseHelper.error('l_w_t_1', 'Block not found.');
      }

      onResolve(r);
    });
  },

  formatHighestBlock: function(blockNumber) {
    return new Promise(function(onResolve, onReject) {

      var r = null;

      if (!blockNumber || blockNumber == 0) {
        r = responseHelper.error('l_w_t_2', 'Highest Block not found.');
      } else {
        r = responseHelper.successWithData({'block_number': blockNumber});
      }

      onResolve(r);
    });
  },

  formatBalance: function(balance) {
    return new Promise(function(onResolve, onReject) {

      var r = null;

      if (!balance) {
        r = responseHelper.error('l_w_t_3', 'Balance not found.');
      } else {
        r = responseHelper.successWithData({'balance': balance});
      }

      onResolve(r);
    });
  }

};

const web3Interact = {

  // get transaction receipt
  getReceipt: function(transactionHash) {
    return web3RpcProvider.eth.getTransactionReceipt(transactionHash)
      .then(_private.formatTxReceipt);
  },

  // get block using a block number
  getBlock: function(blockNumber) {
    return web3RpcProvider.eth.getBlock(blockNumber)
      .then(_private.formatBlock);
  },

  // get highest block number
  highestBlock: function() {
    return web3RpcProvider.eth.getBlockNumber()
      .then(_private.formatHighestBlock);
  },

  getBalance: function(addr) {
    return web3RpcProvider.eth.getBalance(addr)
      .then(_private.formatBalance);
  }

};

module.exports = web3Interact;

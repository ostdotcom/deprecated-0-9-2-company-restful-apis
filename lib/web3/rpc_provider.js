"use strict";
/*
 * Web3 RPC provider
 *
 * * Author: Kedar
 * * Date: 23/10/2017
 * * Reviewed by: Sunil
 */

const coreConstants = require('../../config/core_constants');

const Web3 = require('web3')
  , web3RpcProvider = new Web3(coreConstants.ST_GETH_RPC_PROVIDER);

module.exports = web3RpcProvider;

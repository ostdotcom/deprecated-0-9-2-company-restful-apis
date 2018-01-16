"use strict";
/*
 * Web3 WS provider
 *
 * * Author: Kedar
 * * Date: 23/10/2017
 * * Reviewed by: Sunil
 */

const coreConstants = require('../../config/core_constants');

const Web3 = require('web3')
  , web3WsProvider = new Web3(coreConstants.ST_GETH_WS_PROVIDER);

module.exports = web3WsProvider;

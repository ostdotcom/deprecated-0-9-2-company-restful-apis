"use strict";

const express = require('express')
;

const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , routeHelper = require(rootPrefix + '/routes/helper')
;

const router = express.Router()
;

/**
 * Schedule new airdrop.
 *
 * @name Airdrop Process start
 *
 * @route {POST} {base_url}/airdrops/
 *
 * @routeparam {number} :client_id - client id
 * @routeparam {Decimal} :amount - number of tokens to be airdropped to each shortlisted address.
 * @routeparam {Boolean} :airdropped - true: already airdropped, false: never airdropped
 * @routeparam {string} :user_ids - specific set of users can get shortlisted for airdrop.
 *
 */
router.post('/', function (req, res, next) {

  const StartAirdropKlass = require(rootPrefix + '/app/services/airdrop_management/start');
  req.decodedParams.apiName = 'start_airdrop';

  Promise.resolve(routeHelper.performer(req, res, next, StartAirdropKlass, 'r_v0.1_a_1'));

});
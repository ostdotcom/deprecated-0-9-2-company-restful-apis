"use strict";

const express = require('express')
;

const rootPrefix = '../..'
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

/* Get status of Airdrop request */
/**
 * Get status of airdrop token request
 *
 * @name Airdrop Tokens Status
 *
 * @route {GET} {base_url}/users/airdrop/get-status
 *
 * @routeparam {Decimal} :airdrop_uuid - Token airdrop uuid
 *
 */
router.get('/:airdrop_uuid', function (req, res, next) {

  const getAirdropStatusKlass = require(rootPrefix + '/app/services/airdrop_management/get_airdrop_status');
  req.decodedParams.apiName = 'airdrop_status';

  Promise.resolve(routeHelper.performer(req, res, next, getAirdropStatusKlass, 'r_cu_7'));

});
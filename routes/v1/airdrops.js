'use strict';

const express = require('express');

const rootPrefix = '../..',
  routeHelper = require(rootPrefix + '/routes/helper');

const router = express.Router();

require(rootPrefix + '/app/services/airdrop_management/start');
require(rootPrefix + '/app/services/airdrop_management/get_airdrop_status');
require(rootPrefix + '/app/services/airdrop_management/list');

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
router.post('/', function(req, res, next) {
  req.decodedParams.apiName = 'start_airdrop';

  Promise.resolve(routeHelper.performer(req, res, next, 'getStartAirdropClass', 'r_v1_a_1'));
});

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
router.get('/:airdrop_uuid', function(req, res, next) {
  req.decodedParams.apiName = 'airdrop_status';
  req.decodedParams.airdrop_uuid = req.params.airdrop_uuid;

  Promise.resolve(routeHelper.performer(req, res, next, 'getAirdropStatusClass', 'r_v1_a_3'));
});

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
router.get('/', function(req, res, next) {
  req.decodedParams.apiName = 'list_airdrop';

  Promise.resolve(routeHelper.performer(req, res, next, 'getListAirdropsClass', 'r_v1_a_2'));
});

module.exports = router;

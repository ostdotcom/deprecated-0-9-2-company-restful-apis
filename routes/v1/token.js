'use strict';

const express = require('express');

const rootPrefix = '../..',
  routeHelper = require(rootPrefix + '/routes/helper');

const router = express.Router();

require(rootPrefix + '/app/services/token_management/get');

/**
 *
 * @name Get info about an existing BT
 *
 * @route {GET} {base_url}/token
 *
 */
router.get('/', function(req, res, next) {
  req.decodedParams.apiName = 'fetch_token_details';
  Promise.resolve(routeHelper.performer(req, res, next, 'getBrandedTokenClass', 'r_v1_t_1'));
});

module.exports = router;

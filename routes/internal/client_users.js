const express = require('express')
  , router = express.Router()
  , rootPrefix = '../..'
  , routeHelper = require(rootPrefix + '/routes/helper')
;

/* Get users details for given ethereum addresses. */
router.get('/get-details', function (req, res, next) {

  req.decodedParams.apiName = 'fetch_user_details';

  const getUsersDataKlass = require(rootPrefix + '/app/services/client_users/get_users_data');

  Promise.resolve(routeHelper.performer(req, res, next, getUsersDataKlass, 'r_cuj_1'));

});

router.get('/get-addresses-by-uuid', function (req, res, next) {

  req.decodedParams.apiName = 'fetch_user_addresses';

  const GetAddressesByUuidKlass = require(rootPrefix + '/app/services/client_users/get_addresses_by_uuid');

  Promise.resolve(routeHelper.performer(req, res, next, GetAddressesByUuidKlass, 'r_cuj_2'));

});

/**
 * Airdrop tokens to users
 *
 * @name Airdrop Tokens
 *
 * @route {GET} {base_url}/users/airdrop-tokens
 *
 * @routeparam {Decimal} :amount - Branded token amount to airdrop
 * @routeparam {String} :list_type - List to which tokens need to be airdropped. Possible values: 'all' or 'never_airdropped'. Default is: 'all'
 *
 */
router.post('/airdrop/kit-drop', function (req, res, next) {

  req.decodedParams.apiName = 'kit_airdrop';

  const StartKitAirdropKlass = require(rootPrefix + '/app/services/airdrop_management/kit_drop');

  Promise.resolve(routeHelper.performer(req, res, next, StartKitAirdropKlass, 'r_su_3'));

});

module.exports = router;

const express = require('express');

const rootPrefix = '../..',
  routeHelper = require(rootPrefix + '/routes/helper'),
  AssignStrategiesKlass = require(rootPrefix + '/lib/on_boarding/assign_strategies');

const router = express.Router();

require(rootPrefix + '/app/services/on_boarding/start');
require(rootPrefix + '/app/services/on_boarding/setup_token');
require(rootPrefix + '/app/services/token_management/edit');
require(rootPrefix + '/app/services/on_boarding/create_dummy_users');
require(rootPrefix + '/app/services/on_boarding/fetch_chain_interaction_params');
require(rootPrefix + '/app/services/on_boarding/fetch_balances');
require(rootPrefix + '/app/services/transaction/transfer_simple_token');
require(rootPrefix + '/app/services/transaction/transfer_eth');

/* Start the On-Boarding of a branded token */
router.post('/start', function(req, res, next) {
  req.decodedParams.apiName = 'start_on_boarding';

  Promise.resolve(routeHelper.performer(req, res, next, 'getStartOnBoarding', 'r_ob_1'));
});

/* Grant test OST to user - only for sandbox env */
router.post('/grant-test-ost', function(req, res, next) {
  req.decodedParams.apiName = 'grant_ost';

  Promise.resolve(routeHelper.performer(req, res, next, 'getTransferSimpleTokenClass', 'r_ob_2'));
});

/* Grant testnet ETH to user - only for sandbox */
router.post('/grant-eth', function(req, res, next) {
  req.decodedParams.apiName = 'grant_eth';

  Promise.resolve(routeHelper.performer(req, res, next, 'getTransferEthClass', 'r_ob_3'));
});

/* Set up a branded token - this does not have any block chain setup. This is only saving the information in DB */
router.post('/setup-token', function(req, res, next) {
  req.decodedParams.apiName = 'setup_bt';

  new AssignStrategiesKlass(req.decodedParams['client_id']).perform().then(function(rsp) {
    Promise.resolve(routeHelper.performer(req, res, next, 'getSetupToken', 'r_ob_5'));
  });
});

/* Propose a branded token */
router.post('/edit-token', function(req, res, next) {
  req.decodedParams.apiName = 'edit_bt';

  Promise.resolve(routeHelper.performer(req, res, next, 'getEditBrandedTokenKlass', 'r_ob_6'));
});

router.post('/create-dummy-users', function(req, res, next) {
  req.decodedParams.apiName = 'create_dummy_users';

  Promise.resolve(routeHelper.performer(req, res, next, 'getCreateDummyUsers', 'r_ob_7'));
});

router.get('/get-chain-interaction-params', function(req, res, next) {
  req.decodedParams.apiName = 'fetch_chain_interaction_params';

  Promise.resolve(routeHelper.performer(req, res, next, 'getFetchChainInteractionParams', 'r_ob_8'));
});

router.get('/fetch-balances', function(req, res, next) {
  req.decodedParams.apiName = 'fetch_balances';

  Promise.resolve(routeHelper.performer(req, res, next, 'getFetchBalances', 'r_ob_9'));
});

module.exports = router;

const express = require('express')
  , router = express.Router()
  , BigNumber = require('bignumber.js')
  , openStPlatform = require('@openstfoundation/openst-platform')
;

const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , routeHelper = require(rootPrefix + '/routes/helper')
  , apiVersions = require(rootPrefix + '/lib/global_constant/api_versions')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , errorConfig = basicHelper.fetchErrorConfig(apiVersions.internal)
;

/* On board a branded token */
router.post('/start', function (req, res, next) {

  req.decodedParams.apiName = 'start_on_boarding';

  const StartOnBoardingKlass = require(rootPrefix + '/app/services/on_boarding/start');

  Promise.resolve(routeHelper.performer(req, res, next, StartOnBoardingKlass, 'r_su_3'));

});

/* Grant test OST to user */
router.post('/grant-test-ost', function (req, res, next) {
  const performer = function() {

    if (process.env.CR_ENVIRONMENT == 'production' && process.env.CR_SUB_ENVIRONMENT == 'main') {

      let response = responseHelper.error({
        internal_error_identifier: 'r_ob_gto_1',
        api_error_identifier: 'grant_prohibitedgrant_prohibited',
        debug_options: {}
      });

      return response.renderResponse(res, errorConfig);
    }

    const decodedParams = req.decodedParams
      , ethAddress = decodedParams.ethereum_address
      , amount = decodedParams.amount
      , weiConversion = new BigNumber('1000000000000000000')
    ;

    // handle final response
    const handleResponse = function (response) {
      return response.renderResponse(res, errorConfig);
    };

    const obj = new openStPlatform.services.transaction.transfer.simpleToken({
      sender_name: "foundation",
      recipient_address: ethAddress,
      amount_in_wei: (new BigNumber(amount)).mul(weiConversion).toNumber(),
      options: {tag: "", returnType: "txHash"}
    });
    return obj.perform().then(handleResponse);

  };

  Promise.resolve(performer()).catch(function (err) {
    logger.notify(
      'r_ob_3',
      'Something went wrong',
      err
    );

    responseHelper.error('r_ob_3', 'Something went wrong').renderResponse(res, errorConfig)
  });
});

/* Grant test OST to user */
router.post('/grant-eth', function (req, res, next) {
  const performer = function() {

    if (process.env.CR_ENVIRONMENT == 'production' && process.env.CR_SUB_ENVIRONMENT == 'main') {

      let response = responseHelper.error({
        internal_error_identifier: 'r_ob_gto_1',
        api_error_identifier: 'grant_prohibited',
        debug_options: {}
      });

      return response.renderResponse(res, errorConfig);
    }

    const decodedParams = req.decodedParams
      , ethAddress = decodedParams.ethereum_address
      , amount = decodedParams.amount
      , weiConversion = new BigNumber('1000000000000000000')
    ;

    // handle final response
    const handleResponse = function (response) {
      return response.renderResponse(res, errorConfig);
    };

    const obj = new openStPlatform.services.transaction.transfer.eth({
      sender_name: "foundation",
      recipient_address: ethAddress,
      amount_in_wei: (new BigNumber(amount)).mul(weiConversion).toNumber(),
      options: {tag: "", returnType: "txHash"}
    });
    return obj.perform().then(handleResponse);

  };

  Promise.resolve(performer()).catch(function (err) {
    logger.notify(
      'r_ob_4',
      'Something went wrong',
      err
    );

    responseHelper.error('r_ob_4', 'Something went wrong').renderResponse(res, errorConfig)
  });
});

/* Propose a branded token */
router.post('/setup-token', function (req, res, next) {

  req.decodedParams.apiName = 'setup_bt';

  const SetupTokenKlass = require(rootPrefix + '/app/services/on_boarding/setup_token');

  Promise.resolve(routeHelper.performer(req, res, next, SetupTokenKlass, 'r_ob_5'));

});

/* Propose a branded token */
router.post('/edit-token', function (req, res, next) {

  req.decodedParams.apiName = 'edit_bt';

  const EditTokenKlass = require(rootPrefix + '/app/services/token_management/edit');

  Promise.resolve(routeHelper.performer(req, res, next, EditTokenKlass, 'r_ob_6'));

});

router.post('/create-dummy-users', function (req, res, next) {

  req.decodedParams.apiName = 'create_dummy_users';

  const CreateDummyUsersKlass = require(rootPrefix + '/app/services/on_boarding/create_dummy_users');

  Promise.resolve(routeHelper.performer(req, res, next, CreateDummyUsersKlass, 'r_ob_7'));

});

router.get('/get-chain-interaction-params', function (req, res, next) {

  req.decodedParams.apiName = 'fetch_chain_interaction_params';

  const FetchChainInteractionParamsKlass = require(rootPrefix + '/app/services/on_boarding/fetch_chain_interaction_params');

  Promise.resolve(routeHelper.performer(req, res, next, FetchChainInteractionParamsKlass, 'r_ob_8'));

});

router.get('/fetch-balances', function (req, res, next) {

  req.decodedParams.apiName = 'fetch_balances';

  const FetchBalancesKlass = require(rootPrefix + '/app/services/on_boarding/fetch_balances');

  Promise.resolve(routeHelper.performer(req, res, next, FetchBalancesKlass, 'r_ob_9'));

});

module.exports = router;

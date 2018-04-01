const express = require('express')
  , router = express.Router()
  , BigNumber = require('bignumber.js')
  , openStPlatform = require('@openstfoundation/openst-platform')
;

const rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , routeHelper = require(rootPrefix + '/routes/helper')
;

/* On board a branded token */
router.post('/start', function (req, res, next) {

  const StartOnBoardingKlass = require(rootPrefix + '/app/services/on_boarding/start');

  Promise.resolve(routeHelper.performer(req, res, next, StartOnBoardingKlass, 'r_su_3'));

});

/* Grant test OST to user */
router.post('/grant-test-ost', function (req, res, next) {
  const performer = function() {

    const decodedParams = req.decodedParams
      , ethAddress = decodedParams.ethereum_address
      , amount = decodedParams.amount
      , weiConversion = new BigNumber('1000000000000000000')
    ;

    // handle final response
    const handleResponse = function (response) {
      if(response.isSuccess()){
        return responseHelper.successWithData(response.data).renderResponse(res);
      } else {
        return responseHelper.error(response.err.code, response.err.message).renderResponse(res);
      }
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
    logger.notify('r_ob_3', 'Something went wrong', err);
    responseHelper.error('r_ob_3', 'Something went wrong').renderResponse(res)
  });
});

/* Grant test OST to user */
router.post('/grant-eth', function (req, res, next) {
  const performer = function() {

    const decodedParams = req.decodedParams
      , ethAddress = decodedParams.ethereum_address
      , amount = decodedParams.amount
      , weiConversion = new BigNumber('1000000000000000000')
    ;

    // handle final response
    const handleResponse = function (response) {
      if(response.isSuccess()){
        return responseHelper.successWithData(response.data).renderResponse(res);
      } else {
        return responseHelper.error(response.err.code, response.err.message).renderResponse(res);
      }
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
    logger.notify('r_ob_4', 'Something went wrong', err);
    responseHelper.error('r_ob_4', 'Something went wrong').renderResponse(res)
  });
});

/* Propose a branded token */
router.post('/setup-token', function (req, res, next) {

  const SetupTokenKlass = require(rootPrefix + '/app/services/on_boarding/setup_token');

  Promise.resolve(routeHelper.performer(req, res, next, SetupTokenKlass, 'r_ob_5'));

});

/* Propose a branded token */
router.post('/edit-token', function (req, res, next) {

  const EditTokenKlass = require(rootPrefix + '/app/services/token_management/edit');

  Promise.resolve(routeHelper.performer(req, res, next, EditTokenKlass, 'r_ob_6'));

});

router.post('/create-dummy-users', function (req, res, next) {

  const CreateDummyUsersKlass = require(rootPrefix + '/app/services/on_boarding/create_dummy_users');

  Promise.resolve(routeHelper.performer(req, res, next, CreateDummyUsersKlass, 'r_ob_7'));

});

router.get('/get-chain-interaction-params', function (req, res, next) {

  const FetchChainInteractionParamsKlass = require(rootPrefix + '/app/services/on_boarding/fetch_chain_interaction_params');

  Promise.resolve(routeHelper.performer(req, res, next, FetchChainInteractionParamsKlass, 'r_ob_8'));

});

router.get('/fetch-balances', function (req, res, next) {

  const FetchBalancesKlass = require(rootPrefix + '/app/services/on_boarding/fetch_balances');

  Promise.resolve(routeHelper.performer(req, res, next, FetchBalancesKlass, 'r_ob_9'));

});

router.post('/deploy-airdrop-contract', function (req, res, next) {

  const DeployAirdropContractKlass = require(rootPrefix + '/app/services/on_boarding/deploy_airdrop_contract');

  Promise.resolve(routeHelper.performer(req, res, next, DeployAirdropContractKlass, 'r_ob_10'));

});

router.post('/setops-airdrop', function (req, res, next) {

  const DeployAirdropContractKlass = require(rootPrefix + '/app/services/on_boarding/setops_airdrop_contract');

  Promise.resolve(routeHelper.performer(req, res, next, DeployAirdropContractKlass, 'r_ob_11'));

});

router.post('/set-worker', function (req, res, next) {

  const SetWorkerKlass = require(rootPrefix + '/app/services/on_boarding/set_worker');

  Promise.resolve(routeHelper.performer(req, res, next, SetWorkerKlass, 'r_ob_12'));

});

router.post('/set-price-oracle', function (req, res, next) {

  const SetWorkerKlass = require(rootPrefix + '/app/services/on_boarding/set_price_oracle');

  Promise.resolve(routeHelper.performer(req, res, next, SetWorkerKlass, 'r_ob_13'));

});

router.post('/set-accepted-margin', function (req, res, next) {

  const SetWorkerKlass = require(rootPrefix + '/app/services/on_boarding/set_accepted_margin');

  Promise.resolve(routeHelper.performer(req, res, next, SetWorkerKlass, 'r_ob_14'));

});

module.exports = router;

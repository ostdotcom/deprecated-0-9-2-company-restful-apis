const express = require('express')
  , router = express.Router()
  , BigNumber = require('bignumber.js')
  , openStPlatform = require('@openstfoundation/openst-platform')
;

const rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , SetupTokenKlass = require(rootPrefix + '/app/services/on_boarding/setup_token')
  , EditTokenKlass = require(rootPrefix + '/app/services/token_management/edit')
  , CreateDummyUsersKlass = require(rootPrefix + '/app/services/on_boarding/create_dummy_users')
;

/* Propose a branded token */
router.post('/setup-token', function (req, res, next) {
  const performer = function() {

    // handle final response
    const handleResponse = function (response) {
      return response.renderResponse(res);
    };

    const object = new SetupTokenKlass(req.decodedParams);

    return object.perform().then(handleResponse);

  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_ob_4', 'Something went wrong').renderResponse(res)
  });

});

/* Propose a branded token */
router.post('/edit-token', function (req, res, next) {
  const performer = function() {

    // handle final response
    const handleResponse = function (response) {
      return response.renderResponse(res);
    };

    const object = new EditTokenKlass(req.decodedParams);

    return object.perform().then(handleResponse);

  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_ob_5', 'Something went wrong').renderResponse(res)
  });

});

/* Propose a branded token */
router.post('/propose-branded-token', function (req, res, next) {

  const performer = function() {

    const decodedParams = req.decodedParams
      , tokenSymbol = decodedParams.token_symbol
      , tokenName = decodedParams.token_name
      , tokenConversionRate = decodedParams.token_conversion_rate
    ;

    // handle final response
    const handleResponse = function (proposeResponse) {
      if(proposeResponse.isSuccess()){
        return responseHelper.successWithData(proposeResponse.data).renderResponse(res);
      } else {
        return responseHelper.error(proposeResponse.err.code, proposeResponse.err.message).renderResponse(res);
      }
    };

    const object = new openStPlatform.services.onBoarding.proposeBrandedToken({
      'symbol': tokenSymbol,
      'name': tokenName,
      'conversion_rate': tokenConversionRate
    });

    return object.perform().then(handleResponse);

  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_ob_1', 'Something went wrong').renderResponse(res)
  });

});

/* Propose a branded token */
router.get('/registration-status', function (req, res, next) {

  const performer = function() {

    const decodedParams = req.decodedParams
      , proposeTransactionHash = decodedParams.transaction_hash
    ;

    // handle final response
    const handleResponse = function (registrationResponse) {
      if(registrationResponse.isSuccess()){
        return responseHelper.successWithData(registrationResponse.data).renderResponse(res);
      } else {
        return responseHelper.error(registrationResponse.err.code, registrationResponse.err.message).renderResponse(res);
      }
    };

    const object = new openStPlatform.services.onBoarding.getRegistrationStatus({
      'transaction_hash': proposeTransactionHash
    });

    return object.perform().then(handleResponse);

  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_ob_2', 'Something went wrong').renderResponse(res)
  });

});

/* Grant test OST to user */
router.post('/grant-test-ost', function (req, res, next) {
  const performer = function() {

    const decodedParams = req.decodedParams
      , ethAddress = decodedParams.ethereum_address
      , amount = decodedParams.amount
      , weiConversion = new BigNumber(1000000000000000000)
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
      options: {tag: "testOST", returnType: "txHash"}
    });
    return obj.perform().then(handleResponse);

  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_ob_3', 'Something went wrong').renderResponse(res)
  });
});

router.post('/create-dummy-users', function (req, res, next) {

  const performer = function() {

    const decodedParams = req.decodedParams;

    // handle final response
    const handleResponse = function (response) {
      response.renderResponse(res);
    };

    const object = new CreateDummyUsersKlass(req.decodedParams);

    return object.perform().then(handleResponse);

  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_ob_4', 'Something went wrong').renderResponse(res)
  });

});


module.exports = router;

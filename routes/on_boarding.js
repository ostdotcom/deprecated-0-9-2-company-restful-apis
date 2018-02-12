const express = require('express')
  , router = express.Router()
;

const rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , openStPlatform = require('@openstfoundation/openst-platform')
;

/* Propose a branded token */
router.post('/propose-branded-token', function (req, res, next) {

  const performer = function() {

    const decodedParams = req.decodedParams
      , tokenSymbol = decodedParams.token_symbol
      , tokenName = decodedParams.token_name
      , tokenConversionRate = decodedParams.token_conversion_rate
    ;

    // handle final response
    const handleOpenStPlatformSuccess = function (proposeResponse) {
      return proposeResponse.renderResponse(res);
    };

    const object = new openStPlatform.services.onBoarding.proposeBrandedToken({
      'symbol': tokenSymbol,
      'name': tokenName,
      'conversion_rate': tokenConversionRate
    });

    return object.perform().then(handleOpenStPlatformSuccess);

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
    const handleOpenStPlatformSuccess = function (registrationResponse) {
      return registrationResponse.renderResponse(res);
    };

    const object = new openStPlatform.services.onBoarding.getRegistrationStatus({
      'transaction_hash': proposeTransactionHash
    });

    return object.perform().then(handleOpenStPlatformSuccess);

  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_ob_2', 'Something went wrong').renderResponse(res)
  });

});

/* Create User for a client */
router.post('/grant-test-ost', function (req, res, next) {
  const performer = function() {
    const decodedParams = req.decodedParams
      , allocateOstKlass = require(rootPrefix + '/app/services/client_economy_management/allocate_test_ost')
      , grantOst = new allocateOstKlass(decodedParams)
    ;

    if(coreConstants.SUB_ENV != 'sandbox'){
      return responseHelper.error('r_ob_1', 'Something went wrong').renderResponse(res);
    }

    console.log("decodedParams--", decodedParams);

    const renderResult = function(result) {
      return result.renderResponse(res);
    };

    return grantOst.perform()
      .then(renderResult);
  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_ob_1', 'Something went wrong').renderResponse(res)
  });
});

module.exports = router;

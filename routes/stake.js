const express = require('express')
  , router = express.Router()
;

const rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , openStPlatform = require(coreConstants.OST_PLATFORM_PATH)
;

/* Propose a branded token */
router.post('/approve', function (req, res, next) {
  const performer = function() {

    // handle final response
    const handleOpenStPlatformSuccess = function (transaction_hash) {
      return responseHelper.successWithData({transaction_hash: transaction_hash}).renderResponse(res);
    };

    return openStPlatform.services.stake.approveForStake().then(handleOpenStPlatformSuccess);
  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_su_1', 'Something went wrong').renderResponse(res)
  });
});

/* Propose a branded token */
router.get('/approval-status', function (req, res, next) {
  const performer = function() {
    const decodedParams = req.decodedParams
      , approveTransactionHash = decodedParams.transaction_hash
    ;

    // handle final response
    const handleOpenStPlatformSuccess = function (result) {
      return result.renderResponse(res);
    };

    return openStPlatform.services.stake.getApprovalStatus(approveTransactionHash)
      .then(handleOpenStPlatformSuccess);
  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_su_2', 'Something went wrong').renderResponse(res)
  });
});

/* Propose a branded token */
router.post('/start', function (req, res, next) {
  const performer = function() {
    const decodedParams = req.decodedParams
      , beneficiary = decodedParams.beneficiary
      , toStakeAmount = decodedParams.to_stake_amount
      , uuid = decodedParams.uuid
    ;

    // handle final response
    const handleOpenStPlatformSuccess = function (transaction_hash) {
      return responseHelper.successWithData({transaction_hash: transaction_hash}).renderResponse(res);
    };

    return openStPlatform.services.stake.start(beneficiary, toStakeAmount, uuid)
      .then(handleOpenStPlatformSuccess);
  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_su_3', 'Something went wrong').renderResponse(res)
  });
});

/* Propose a branded token */
router.get('/get-staker-params', function (req, res, next) {

  const performer = function() {

    const decodedParams = req.decodedParams;

    // handle final response
    const handleOpenStPlatformSuccess = function (credentials) {
      console.log(credentials);
      return responseHelper.successWithData(credentials).renderResponse(res);
    };

    return openStPlatform.services.stake.getStakerCredentials()
        .then(handleOpenStPlatformSuccess);
  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_su_4', 'Something went wrong').renderResponse(res)
  });

});

module.exports = router;

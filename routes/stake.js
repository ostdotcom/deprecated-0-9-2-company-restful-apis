const express = require('express')
  , router = express.Router()
;

const rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , openStPlatform = require('@openstfoundation/openst-platform')
;

/* Propose a branded token */
router.post('/approve', function (req, res, next) {
  const performer = function() {

    // handle final response
    const handleOpenStPlatformSuccess = function (approveResponse) {
      return approveResponse.renderResponse(res);
    };

    const object = new openStPlatform.services.stake.approveForStake();

    return object.perform().then(handleOpenStPlatformSuccess);

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

    const object = new openStPlatform.services.stake.getApprovalStatus({
      'transaction_hash': approveTransactionHash
    });

    return object.perform().then(handleOpenStPlatformSuccess);

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
    const handleOpenStPlatformSuccess = function (stakeResponse) {
      return stakeResponse.renderResponse(res);
    };

    const object = new openStPlatform.services.stake.start({
      'beneficiary': beneficiary,
      'to_stake_amount': toStakeAmount,
      'uuid': uuid
    });

    return object.perform().then(handleOpenStPlatformSuccess);

  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_su_3', 'Something went wrong').renderResponse(res)
  });

});

module.exports = router;

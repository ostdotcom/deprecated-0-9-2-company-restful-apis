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
      if(approveResponse.isSuccess()){
        return responseHelper.successWithData(approveResponse.data).renderResponse(res);
      } else {
        return responseHelper.error(approveResponse.err.code, approveResponse.err.message).renderResponse(res);
      }
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
      if(result.isSuccess()){
        return responseHelper.successWithData(result.data).renderResponse(res);
      } else {
        return responseHelper.error(result.err.code, result.err.message).renderResponse(res);
      }
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
      if(stakeResponse.isSuccess()){
        return responseHelper.successWithData(stakeResponse.data).renderResponse(res);
      } else {
        return responseHelper.error(stakeResponse.err.code, stakeResponse.err.message).renderResponse(res);
      }
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

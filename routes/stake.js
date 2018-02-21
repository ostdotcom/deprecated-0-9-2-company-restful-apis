const express = require('express')
  , router = express.Router()
;

const rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
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
    logger.notify('r_su_1', 'Something went wrong', err);
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
    logger.notify('r_su_2', 'Something went wrong', err);
    responseHelper.error('r_su_2', 'Something went wrong').renderResponse(res)
  });

});

/* Propose a branded token */
router.post('/start-bt', function (req, res, next) {
  const performer = function() {
    const decodedParams = req.decodedParams
      , stakeStartBtKlass = require(rootPrefix + '/app/services/stake_and_mint/branded_token')
      , stakeStartBtObj = new stakeStartBtKlass(decodedParams)
    ;

    // handle final response
    const handleResponse = function (stakeResponse) {
      return stakeResponse.renderResponse(res);
    };

    return stakeStartBtObj.perform().then(handleResponse);

  };

  Promise.resolve(performer()).catch(function (err) {
    logger.notify('r_su_3', 'Something went wrong', err);
    responseHelper.error('r_su_3', 'Something went wrong').renderResponse(res)
  });

});

/* Propose a branded token */
router.post('/start-st-prime', function (req, res, next) {
  const performer = function() {
    const decodedParams = req.decodedParams
      , stakeStartStPrimeKlass = require(rootPrefix + '/app/services/stake_and_mint/st_prime')
      , stakeStartStPrimeObj = new stakeStartStPrimeKlass(decodedParams)
    ;

    // handle final response
    const handleResponse = function (stakeResponse) {
      return stakeResponse.renderResponse(res);
    };

    return stakeStartStPrimeObj.perform().then(handleResponse);

  };

  Promise.resolve(performer()).catch(function (err) {
    logger.notify('r_su_4', 'Something went wrong', err);
    responseHelper.error('r_su_4', 'Something went wrong').renderResponse(res)
  });

});

router.get('/get-receipt', function (req, res, next) {
  const performer = function() {
    const decodedParams = req.decodedParams
      , getReceiptKlass = require(rootPrefix + '/app/services/transaction/get_receipt')
      , getReceiptObj = new getReceiptKlass(decodedParams)
    ;

    // handle final response
    const handleResponse = function (response) {
      return response.renderResponse(res);
    };

    return getReceiptObj.perform().then(handleResponse);
  };

  Promise.resolve(performer()).catch(function (err) {
    logger.notify('r_su_5', 'Something went wrong', err);
    responseHelper.error('r_su_5', 'Something went wrong').renderResponse(res)
  });
});

router.get('/get-staked-amount', function (req, res, next) {

  const performer = function() {

    const decodedParams = req.decodedParams;

    // handle final response
    const handleOpenStPlatformSuccess = function (getStakedAmountRsp) {
      if(getStakedAmountRsp.isSuccess()){
        return responseHelper.successWithData(getStakedAmountRsp.data).renderResponse(res);
      } else {
        return responseHelper.error(getStakedAmountRsp.err.code, getStakedAmountRsp.err.message).renderResponse(res);
      }
    };

    const object = new openStPlatform.services.stake.getStakedAmount(decodedParams.simple_stake_contract_address);

    return object.perform().then(handleOpenStPlatformSuccess);

  };

  Promise.resolve(performer()).catch(function (err) {
    logger.error(err);
    responseHelper.error('r_t_3', 'Something went wrong').renderResponse(res)
  });

});


module.exports = router;

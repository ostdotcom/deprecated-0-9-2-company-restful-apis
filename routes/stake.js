const express = require('express')
  , router = express.Router()
;

const rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , openStPlatform = require('@openstfoundation/openst-platform')
  , routeHelper = require(rootPrefix + '/routes/helper')
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

  const stakeStartBtKlass = require(rootPrefix + '/app/services/stake_and_mint/branded_token');

  Promise.resolve(routeHelper.performer(req, res, next, stakeStartBtKlass, 'r_su_3'));

});

/* Propose a branded token */
router.post('/start-st-prime', function (req, res, next) {

  const stakeStartStPrimeKlass = require(rootPrefix + '/app/services/stake_and_mint/st_prime');

  Promise.resolve(routeHelper.performer(req, res, next, stakeStartStPrimeKlass, 'r_su_4'));

});

router.get('/get-receipt', function (req, res, next) {

  const getReceiptKlass = require(rootPrefix + '/app/services/transaction/get_receipt');

  Promise.resolve(routeHelper.performer(req, res, next, getReceiptKlass, 'r_su_5'));

});

router.get('/get-staked-amount', function (req, res, next) {

  const GetStakedAmountKlass = require(rootPrefix + '/app/services/stake_and_mint/get_staked_amount');

  Promise.resolve(routeHelper.performer(req, res, next, GetStakedAmountKlass, 'r_su_6'));

});


module.exports = router;

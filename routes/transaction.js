const express = require('express')
  , router = express.Router()
  , rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response');

/* Get transaction block info for a transaction hash */
router.get('/kind/get-all', function (req, res, next) {
  const performer = function() {
    const decodedParams = req.decodedParams
      , transactionListKlass = require(rootPrefix + '/app/services/transaction_kind/list')
      , transactionList = new transactionListKlass(decodedParams)
      ;

    console.log("decodedParams--", decodedParams);

    const renderResult = function(result) {
      return result.renderResponse(res);
    };

    return transactionList.perform()
      .then(renderResult);
  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_t_1', 'Something went wrong').renderResponse(res)
  });
});

router.post('/kind/new', function (req, res, next) {
  const performer = function() {
    const decodedParams = req.decodedParams
      , newTransactionKlass = require(rootPrefix + '/app/services/transaction_kind/add_new')
      , newTransaction = new newTransactionKlass(decodedParams)
    ;

    console.log("decodedParams--", decodedParams);

    const renderResult = function(result) {
      return result.renderResponse(res);
    };

    return newTransaction.perform()
      .then(renderResult);
  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_t_1', 'Something went wrong').renderResponse(res)
  });
});

router.post('/kind/edit', function (req, res, next) {
  const performer = function() {
    const decodedParams = req.decodedParams
      , editTransactionKlass = require(rootPrefix + '/app/services/transaction_kind/edit')
      , editTransaction = new editTransactionKlass(decodedParams)
    ;

    console.log("decodedParams--", decodedParams);

    const renderResult = function(result) {
      return result.renderResponse(res);
    };

    return editTransaction.perform()
      .then(renderResult);
  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_t_1', 'Something went wrong').renderResponse(res)
  });
});

module.exports = router;

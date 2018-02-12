const express = require('express')
  , router = express.Router()
  , rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response');

/* Fetch Transaction Receipt from transaction hash */
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
    console.error(err);
    responseHelper.error('r_t_2', 'Something went wrong').renderResponse(res)
  });
});

module.exports = router;

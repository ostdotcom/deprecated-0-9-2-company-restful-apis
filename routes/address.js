const express = require('express')
  , router = express.Router()
  , rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response');

/* Create Ethereum address with given passphrase */
router.post('/create', function (req, res, next) {
  const performer = function() {
    const decodedParams = req.decodedParams
      , generateAddress = require(rootPrefix + '/app/services/generate_address')
    ;

    console.log("decodedParams--", decodedParams);
    var passphrase = decodedParams["passphrase"];
    if(!passphrase){
      return responseHelper.error("r_adc_2", "Mandatory parameters missing").renderResponse(res);
    }

    // handle final response
    const handleResponse = function (data) {
      return responseHelper.successWithData(data).renderResponse(res);
    };
    return generateAddress.perform(passphrase).then(handleResponse);
  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_adc_1', 'Something went wrong').renderResponse(res)
  });
});

module.exports = router;

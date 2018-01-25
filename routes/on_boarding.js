const express = require('express')
  , router = express.Router()
;

const rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  // TODO - change the following
  , openStPlatform = require('/Users/kedarchandrayan/workspace/openst-platform/index')
;

/* Propose a branded token */
router.post('/propose-branded-token', function (req, res, next) {
  const performer = function() {
    const decodedParams = req.decodedParams
      , senderAddress = decodedParams.sender_address
      , senderPassphrase = decodedParams.sender_passphrase
      , tokenSymbol = decodedParams.token_symbol
      , tokenName = decodedParams.token_name
      , tokenConversionRate = decodedParams.token_conversion_rate
    ;

    // handle final response
    const handleOpenStPlatformSuccess = function (transaction_hash) {
      return responseHelper.successWithData({transaction_hash: transaction_hash}).renderResponse(res);
    };

    return openStPlatform.services.onBoarding.proposeBt(
      senderAddress,
      senderPassphrase,
      tokenSymbol,
      tokenName,
      tokenConversionRate
    ).then(handleOpenStPlatformSuccess);
  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_ob_1', 'Something went wrong').renderResponse(res)
  });
});

module.exports = router;

const express = require('express')
  , router = express.Router()
  , rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response');

/* Create User for a client */
router.post('/create', function (req, res, next) {
  const performer = function() {
    const decodedParams = req.decodedParams
      , userCreateKlass = require(rootPrefix + '/app/services/client_users_management/create_user')
      , createUser = new userCreateKlass(decodedParams)
      ;

    console.log("decodedParams--", decodedParams);

    const renderResult = function(result) {
      return result.renderResponse(res);
    };

    return createUser.perform()
      .then(renderResult);
  };

  Promise.resolve(performer()).catch(function (err) {
    console.error(err);
    responseHelper.error('r_cu_1', 'Something went wrong').renderResponse(res)
  });
});

module.exports = router;

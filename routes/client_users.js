const express = require('express')
  , router = express.Router()
  , rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

/* Create User for a client */
router.post('/create', function (req, res, next) {
  const performer = function() {
    const decodedParams = req.decodedParams
      , generateAddress = require(rootPrefix + '/app/services/address/generate')
    ;
    var clientId = decodedParams.client_id;
    var name = decodedParams.name;

    // handle final response
    const handleResponse = function (response) {
      return response.renderResponse(res);
    };
    return generateAddress.perform(clientId, name).then(handleResponse);
  };

  Promise.resolve(performer()).catch(function (err) {
    logger.error(err);
    responseHelper.error('r_cu_1', 'Something went wrong').renderResponse(res)
  });
});

/* Edit User of a client */
router.post('/edit', function (req, res, next) {
  const performer = function() {
    const decodedParams = req.decodedParams
      , editUser = require(rootPrefix + '/app/services/client_users/edit_user')
    ;
    var clientId = decodedParams.client_id;
    var uuid = decodedParams.user_id;
    var name = decodedParams.name;

    // handle final response
    const handleResponse = function (response) {
      return response.renderResponse(res);
    };
    return editUser.perform(clientId, uuid, name).then(handleResponse);
  };

  Promise.resolve(performer()).catch(function (err) {
    logger.error(err);
    responseHelper.error('r_cu_2', 'Something went wrong').renderResponse(res)
  });
});

module.exports = router;

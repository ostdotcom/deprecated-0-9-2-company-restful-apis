const express = require('express')
  , router = express.Router()
  , rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , listAddressesKlass = require(rootPrefix + '/app/services/client_users/list')
  , getUsersDataKlass = require(rootPrefix + '/app/services/client_users/get_users_data')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , routeHelper = require(rootPrefix + '/routes/helper')
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
    return generateAddress.perform(clientId, managedAddressesConst.userAddressType, name).then(handleResponse);
  };

  Promise.resolve(performer()).catch(function (err) {
    logger.notify('r_cu_1', 'Something went wrong', err);
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
    var uuid = decodedParams.address_uuid;
    var name = decodedParams.name;

    // handle final response
    const handleResponse = function (response) {
      return response.renderResponse(res);
    };
    return editUser.perform(clientId, uuid, name).then(handleResponse);
  };

  Promise.resolve(performer()).catch(function (err) {
    logger.notify('r_cu_2', 'Something went wrong', err);
    responseHelper.error('r_cu_2', 'Something went wrong').renderResponse(res)
  });
});

/* List User for a client */
router.post('/list', function (req, res, next) {

  const performer = function() {

      const decodedParams = req.decodedParams
          , listAddresses = new listAddressesKlass();

    // handle final response
    const handleResponse = function (response) {
      return response.renderResponse(res);
    };

    return listAddresses.perform(decodedParams).then(handleResponse);

  };

  Promise.resolve(performer()).catch(function (err) {
    logger.notify('r_cu_3', 'Something went wrong', err);
    responseHelper.error('r_cu_3', 'Something went wrong').renderResponse(res)
  });

});

/* List User for a client */
router.get('/get-users-details', function (req, res, next) {

  Promise.resolve(routeHelper.performer(req, res, next, getUsersDataKlass, 'r_cu_5'));

});

module.exports = router;

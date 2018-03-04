const express = require('express')
  , router = express.Router()
  , rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , listAddressesKlass = require(rootPrefix + '/app/services/client_users/list')
  , startAirdropKlass = require(rootPrefix + '/app/services/airdrop_management/start_airdrop')
  , getAirdropStatusKlass = require(rootPrefix + '/app/services/airdrop_management/get_airdrop_status')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , routeHelper = require(rootPrefix + '/routes/helper')
;

/**
 * Create a new user
 *
 * @name Create User
 *
 * @route {GET} {base_url}/users/create
 *
 * @routeparam {String} :name - Name of the user
 *
 */
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

/**
 * Edit existing user details
 *
 * @name Edit User
 *
 * @route {GET} {base_url}/users/edit
 *
 * @routeparam {String} :uuid - User's uuid whose details need to be updated
 * @routeparam {String} :name - New name of the user
 *
 */
router.post('/edit', function (req, res, next) {
  const performer = function() {
    const decodedParams = req.decodedParams
      , editUser = require(rootPrefix + '/app/services/client_users/edit_user')
    ;
    var clientId = decodedParams.client_id;
    var uuid = decodedParams.uuid;
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

/**
 * List all users
 *
 * @name List Users
 *
 * @route {GET} {base_url}/users/list
 *
 * @routeparam {Integer} :page_no - page number
 * @routeparam {String} :filter - filter to be applied on list. Possible values: 'all' or 'never_airdropped'. Default is: 'all'
 * @routeparam {String} :order_by - Order the list by 'creation_time' or 'name'. Default is: 'name'
 * @routeparam {String} :order - Order users in 'desc' or 'asc'. Default is: 'desc'
 *
 */
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

/**
 * Airdrop tokens to users
 *
 * @name Airdrop Tokens
 *
 * @route {GET} {base_url}/users/airdrop-tokens
 *
 * @routeparam {Decimal} :amount - Branded token amount to airdrop
 * @routeparam {String} :list_type - List to which tokens need to be airdropped. Possible values: 'all' or 'never_airdropped'. Default is: 'all'
 *
 */
router.post('/airdrop-tokens', function (req, res, next) {

  const performer = function() {

    const decodedParams = req.decodedParams
      , startAirdropObj = new startAirdropKlass(decodedParams);

    // handle final response
    const handleResponse = function (response) {
      return response.renderResponse(res);
    };

    return startAirdropObj.perform().then(handleResponse);

  };

  Promise.resolve(performer()).catch(function (err) {
    logger.notify('r_cu_6', 'Something went wrong', err);
    responseHelper.error('r_cu_6', 'Something went wrong').renderResponse(res)
  });

});

/* Get status of Airdrop request */
/**
 * Get status of airdrop token request
 *
 * @name Airdrop Tokens Status
 *
 * @route {GET} {base_url}/users/airdrop/get-status
 *
 * @routeparam {Decimal} :airdrop_uuid - Token airdrop uuid
 *
 */
router.get('/airdrop/get-status', function (req, res, next) {

  Promise.resolve(routeHelper.performer(req, res, next, getAirdropStatusKlass, 'r_cu_7'));

});

module.exports = router;

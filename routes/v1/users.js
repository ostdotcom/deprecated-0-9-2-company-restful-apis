'use strict';

const express = require('express');

const rootPrefix = '../..',
  managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses'),
  routeHelper = require(rootPrefix + '/routes/helper');

const router = express.Router();

require(rootPrefix + '/app/services/client_users/edit_user');
require(rootPrefix + '/app/services/address/generate');
require(rootPrefix + '/app/services/client_users/list');
require(rootPrefix + '/app/services/client_users/fetch_user');

/**
 *
 * @name Edit an existing User
 *
 * @route {POST} {base_url}/users/:id
 *
 * @routeparam {number} :id - identifier of user which is to be updated
 * @routeparam {string} :name - name with which user is to be created
 *
 */

router.post('/:id', function(req, res, next) {
  req.decodedParams.apiName = 'edit_user';
  req.decodedParams.id = req.params.id;

  Promise.resolve(routeHelper.performer(req, res, next, 'getEditUserClass', 'r_v1_u_1'));
});

/**
 *
 * @name Create a new user
 *
 * @route {POST} {base_url}/users/
 *
 * @routeparam {string} :name - name with which user is to be created
 *
 */
router.post('/', function(req, res, next) {
  req.decodedParams.apiName = 'create_user';
  req.decodedParams.address_type = managedAddressesConst.userAddressType;

  Promise.resolve(routeHelper.performer(req, res, next, 'getGenerateAddressClass', 'r_v1_u_2'));
});

/**
 *
 * @name Fetch a list of users
 *
 * @route {GET} {base_url}/users/
 *
 * @routeparam {string} :page_no - page_no of the list
 * @routeparam {string} :airdropped - fliter param
 * @routeparam {string} :order_by - order by param
 * @routeparam {string} :order - order ASC / DESC
 * @routeparam {string} :limit - page size
 *
 */
router.get('/', function(req, res, next) {
  req.decodedParams.apiName = 'list_users';

  Promise.resolve(routeHelper.performer(req, res, next, 'getListUserClass', 'r_v1_u_4'));
});

/**
 *
 * @name Fetch info for a given user identifier
 *
 * @route {GET} {base_url}/users/:id
 *
 * @routeparam {string} :id - identifier of user which is to be fetched
 *
 */
router.get('/:id', function(req, res, next) {
  req.decodedParams.apiName = 'fetch_user';
  req.decodedParams.id = req.params.id;

  Promise.resolve(routeHelper.performer(req, res, next, 'getFetchUserClass', 'r_v1_u_3'));
});

module.exports = router;

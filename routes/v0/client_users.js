"use strict";

const express = require('express')
;

const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , getAirdropStatusKlass = require(rootPrefix + '/app/services/airdrop_management/get_airdrop_status')
  , ucBalanceFetcherKlass = require(rootPrefix + '/app/services/address/utilityChainBalancesFetcher')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , routeHelper = require(rootPrefix + '/routes/helper')
  , apiVersions = require(rootPrefix + '/lib/global_constant/api_versions')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , util = require(rootPrefix + '/lib/util')
  , clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop')
  , UserEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/v0/user')
  , AirdropEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/v0/airdrop')
  , errorConfig = basicHelper.fetchErrorConfig(apiVersions.v0)
;

const router = express.Router()
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

  req.decodedParams.apiName = 'create_user';
  req.decodedParams.address_type = managedAddressesConst.userAddressType;

  const CreateUserKlass = require(rootPrefix + '/app/services/address/generate');

  const dataFormatterFunc = async function(response) {

    const userEntityFormatterRsp = await new UserEntityFormatterKlass(response.data.user).perform();

    delete response.data.user;

    response.data.result_type = 'economy_users';
    response.data.economy_users = [userEntityFormatterRsp.data]

  };

  Promise.resolve(routeHelper.performer(
      req, res, next, CreateUserKlass, 'r_v0_u_1',
      null, dataFormatterFunc
  ));

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

  req.decodedParams.apiName = 'edit_user';

  const EditUserKlass = require(rootPrefix + '/app/services/client_users/edit_user');

  const afterValidationFunc = async function(serviceParamsPerThisVersion) {

    const serviceParamsPerLatestVersion = util.clone(serviceParamsPerThisVersion);

    routeHelper.replaceKey(serviceParamsPerLatestVersion, 'uuid', 'id');

    return serviceParamsPerLatestVersion;

  };

  const dataFormatterFunc = async function(response) {

    const userEntityFormatterRsp = await new UserEntityFormatterKlass(response.data.user).perform();

    delete response.data.user;

    response.data.result_type = 'economy_users';
    response.data.economy_users = [userEntityFormatterRsp.data]

  };

  Promise.resolve(routeHelper.performer(
      req, res, next,
      EditUserKlass, 'r_v0_u_2',
      afterValidationFunc, dataFormatterFunc
  ));

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
router.get('/list', function (req, res, next) {

  req.decodedParams.apiName = 'list_users';

  const ListUsersKlass = require(rootPrefix + '/app/services/client_users/list');

  const afterValidationFunc = async function(serviceParamsPerThisVersion) {

    const serviceParamsPerLatestVersion = util.clone(serviceParamsPerThisVersion);

    if(serviceParamsPerLatestVersion.order_by === 'creation_time') {
      serviceParamsPerLatestVersion.order_by = 'created'
    }

    const filter = serviceParamsPerLatestVersion.filter;
    delete serviceParamsPerLatestVersion['filter'];

    if(filter === clientAirdropConst.neverAirdroppedAddressesAirdropListType) {
      serviceParamsPerLatestVersion.airdropped = false;
    }

    serviceParamsPerLatestVersion.limit = 25;

    return serviceParamsPerLatestVersion;

  };

  const dataFormatterFunc = async function(serviceResponse) {

    const users = serviceResponse.data.users
        , formattedusers = []
    ;

    delete serviceResponse.data.users;

    for(var i=0; i<users.length; i++) {

      const userEntityFormatterRsp = await new UserEntityFormatterKlass(users[i]).perform();
      formattedusers.push(userEntityFormatterRsp.data);

    }

    const nextPagePayload = serviceResponse.data.meta.next_page_payload;

    if (nextPagePayload.page_no) {
      if (nextPagePayload.order_by === 'created') {nextPagePayload.order_by = 'creation_time'}
      if (nextPagePayload.hasOwnProperty('airdropped') && !nextPagePayload.airdropped) {
        delete nextPagePayload.airdropped;
        nextPagePayload.filter = clientAirdropConst.neverAirdroppedAddressesAirdropListType;
      }
    }

    serviceResponse.data.result_type = 'economy_users';
    serviceResponse.data.economy_users = formattedusers

  };

  Promise.resolve(routeHelper.performer(
      req, res, next,
      ListUsersKlass, 'r_v0_u_3',
      afterValidationFunc, dataFormatterFunc
  ));

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
router.post('/airdrop/drop', function (req, res, next) {

  req.decodedParams.apiName = 'start_airdrop';

  const StartAirdropKlass = require(rootPrefix + '/app/services/airdrop_management/start');

  const afterValidationFunc = async function(serviceParamsPerThisVersion) {

    const serviceParamsPerLatestVersion = util.clone(serviceParamsPerThisVersion);

    const list_type = serviceParamsPerLatestVersion.list_type;
    delete serviceParamsPerLatestVersion['list_type'];

    if(list_type === clientAirdropConst.neverAirdroppedAddressesAirdropListType) {
      serviceParamsPerLatestVersion.airdropped = false;
    }

    return serviceParamsPerLatestVersion;

  };

  const dataFormatterFunc = async function(response) {

    const airdropEntityFormatterRsp = await new AirdropEntityFormatterKlass(response.data.airdrop).perform();

    response.data = {
      airdrop_uuid: airdropEntityFormatterRsp.data.airdrop_uuid
    };
  };

  Promise.resolve(routeHelper.performer(
    req, res, next,
    StartAirdropKlass, 'r_su_3',
    afterValidationFunc, dataFormatterFunc
  ));

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
router.get('/airdrop/status', function (req, res, next) {

  req.decodedParams.apiName = 'airdrop_status';

  const dataFormatterFunc = async function(response) {

    const airdropEntityFormatterRsp = await new AirdropEntityFormatterKlass(response.data.airdrop).perform();

    delete response.data.airdrop;

    response.data = airdropEntityFormatterRsp.data;
  };

  Promise.resolve(routeHelper.performer(
    req, res, next,
    getAirdropStatusKlass, 'r_cu_7',
    null, dataFormatterFunc
  ));

});

/* Get status of Airdrop request */
router.get('/get-st-prime-balance', function (req, res, next) {

  const performer = function () {

    const decodedParams = req.decodedParams
      ,
      params = {'client_id': decodedParams.client_id, 'address_uuid': decodedParams.uuid, 'balance_types': ['ostPrime']}
      , ucBalanceFetcher = new ucBalanceFetcherKlass(params);

    // handle final response
    const handleResponse = function (response) {
      return response.renderResponse(res, errorConfig);
    };

    return ucBalanceFetcher.perform().then(handleResponse);

  };

  Promise.resolve(performer()).catch(function (err) {
    logger.notify(
      'r_cu_8',
      'Something went wrong',
      err
    );

    responseHelper.error('r_cu_8', 'Something went wrong').renderResponse(res, errorConfig)
  });

});

module.exports = router;

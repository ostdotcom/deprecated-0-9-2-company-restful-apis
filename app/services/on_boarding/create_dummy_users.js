"use strict";

/**
 * Create Dummy Users
 *
 * @module app/services/on_boarding/create_dummy_users
 *
 */

const uuid = require('uuid')
;

const rootPrefix = '../../..'
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , generateAddress = require(rootPrefix + '/app/services/address/generate')
    , ClientBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token')
    , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

/**
 * Setup token constructor
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id for whom users are to be created.
 * @param {number} params.number_of_users - number_of_users to be geenrated
 *
 */
const CreateDummyUsers = function(params){

  this.clientId = params.client_id;
  this.numberOfUsers = parseInt(params.number_of_users);

};

CreateDummyUsers.prototype = {

  /**
   * Perform<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  perform: async function () {

    const oThis = this;

    var r = null;

    r = await oThis.validateParams();
    if(r.isFailure()) return r;

    // Do NOT wait for this promise to resolve to end request
    oThis.createUserInBackground();

    return responseHelper.successWithData({});

  },

  /**
   * Validate parameters.
   *
   * @return {promise<result>}
   *
   */
  validateParams: async function () {

    const oThis = this;

    if(!oThis.numberOfUsers){
      return Promise.resolve(responseHelper.error(
          'ob_cdu_1', 'Invlaid numberOfUsers')
      );
    }

    if(!oThis.clientId){
      return Promise.resolve(responseHelper.error(
          'ob_cdu_2', 'missing clientId')
      );
    }

    const clientBrandedTokenCache = new ClientBrandedTokenCacheKlass({'clientId': oThis.clientId})
        , clientDetail = await clientBrandedTokenCache.fetch();

    if(clientDetail.isFailure()){
      return Promise.resolve(responseHelper.error(
        'ob_cdu_3', 'Invlaid Client')
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Create USers.
   *
   * @return {promise<result>}
   *
   */
  createUserInBackground: async function () {

    const oThis = this;

    var promiseResolvers = [];

    for(var i=0; i<oThis.numberOfUsers; i++) {
      promiseResolvers.push(generateAddress.perform(oThis.clientId, "User "+i));
    }

    const resolversData = await Promise.all(promiseResolvers);

    for(var i=0; i<resolversData.length; i++) {

      if(resolversData[i].isFailure()) {
        logger.error(resolversData[i]);
      }

    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

module.exports = CreateDummyUsers;
'use strict';

/**
 * Create Dummy Users
 *
 * @module app/services/on_boarding/create_dummy_users
 *
 */

const uuid = require('uuid');

const rootPrefix = '../../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  notifier = require(rootPrefix + '/helpers/notifier'),
  managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/app/services/address/generate');
require(rootPrefix + '/lib/cache_management/client_branded_token');

/**
 * Setup token constructor
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id for whom users are to be created.
 * @param {number} params.number_of_users - number_of_users to be generated
 *
 */
const CreateDummyUsers = function(params) {
  this.clientId = params.client_id;
  this.numberOfUsers = parseInt(params.number_of_users);
};

CreateDummyUsers.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 'ob_cdu_4',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   * Perform<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  asyncPerform: async function() {
    const oThis = this;

    await oThis.validateParams();

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
  validateParams: async function() {
    const oThis = this,
      ClientBrandedTokenCacheKlass = oThis.ic().getClientBrandedTokenCache();

    //Block request in Main Environment
    if (basicHelper.isMainSubEnvironment()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'ob_cdu_5',
          api_error_identifier: 'route_prohibited_in_main',
          debug_options: {}
        })
      );
    }

    if (!oThis.numberOfUsers) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 'ob_cdu_1',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['missing_number_of_users'],
          debug_options: {}
        })
      );
    }

    if (oThis.numberOfUsers > 25) {
      oThis.numberOfUsers = 25;
    }

    if (!oThis.clientId) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 'ob_cdu_2',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['missing_client_id'],
          debug_options: {}
        })
      );
    }

    const clientBrandedTokenCache = new ClientBrandedTokenCacheKlass({ clientId: oThis.clientId }),
      clientDetail = await clientBrandedTokenCache.fetch();

    if (clientDetail.isFailure()) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 'ob_cdu_3',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_client_id'],
          debug_options: {}
        })
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
  createUserInBackground: async function() {
    const oThis = this,
      GenerateEthAddressKlass = oThis.ic().getGenerateAddressClass();

    var promiseResolvers = [];

    for (var i = 0; i < oThis.numberOfUsers; i++) {
      const generateEthAddress = new GenerateEthAddressKlass({
        address_type: managedAddressesConst.userAddressType,
        client_id: oThis.clientId,
        name: 'User ' + i
      });

      promiseResolvers.push(generateEthAddress.perform());
    }

    const resolversData = await Promise.all(promiseResolvers);

    for (var i = 0; i < resolversData.length; i++) {
      if (resolversData[i].isFailure()) {
        notifier.notify('c_d_u_1', 'Something Went Wrong', resolversData[i], { clientId: oThis.clientId });
      }
    }

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

InstanceComposer.registerShadowableClass(CreateDummyUsers, 'getCreateDummyUsers');

module.exports = CreateDummyUsers;

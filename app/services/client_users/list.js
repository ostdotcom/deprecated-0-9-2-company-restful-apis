'use strict';

const rootPrefix = '../../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  EconomyUserBalanceKlass = require(rootPrefix + '/lib/economy_user_balance'),
  UserEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/user'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  commonValidator = require(rootPrefix + '/lib/validators/common');

/**
 *
 * @constructor
 *
 * @param {object} params - this is object with keys.
 * @param {integer} params.client_id - client_id for which users are to be fetched
 * @param {integer} [params.page_no] - page no
 * @param {boolean} [params.airdropped] - true / false to filter on users who have (or not) been airdropped
 * @param {string} [params.id] - comma seperated list of uuids on which filter is to be applied
 * @param {string} [params.order_by] - ordereing of results to be done by this column
 * @param {integer} [params.order] - ASC / DESC
 * @param {integer} [params.limit] - number of results to be returned on this page
 *
 */
const listUserKlass = function(params) {
  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.pageNo = params.page_no;
  oThis.airdropped = params.airdropped;
  oThis.orderBy = params.order_by;
  oThis.order = params.order;
  oThis.limit = params.limit;
  oThis.uuidsString = params.id;
  oThis.uuidsForFiltering = [];
};

listUserKlass.prototype = {
  /**
   *
   * Perform
   *
   * @return {Promise<result>}
   *
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 's_cu_l_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   *
   * Perform
   *
   * @private
   *
   * @return {Promise<result>}
   *
   */
  asyncPerform: async function() {
    const oThis = this;

    await oThis.validateAndSanitize();

    const queryResponse = await new ManagedAddressModel().getByFilterAndPaginationParams({
      client_id: oThis.clientId,
      airdropped: oThis.airdropped,
      order_by: oThis.orderBy,
      order: oThis.order,
      offset: oThis.offset,
      limit: oThis.limit + 1,
      uuids: oThis.uuidsForFiltering
    });

    var usersList = [],
      ethereumAddresses = [],
      hasMore = false;

    for (var i = 0; i < queryResponse.length; i++) {
      const object = queryResponse[i];

      if (i === oThis.limit) {
        continue;
      } // as we fetched limit + 1, ignore that extra one

      ethereumAddresses.push(object['ethereum_address']);
    }

    var balanceHashData = {};

    if (ethereumAddresses.length > 0) {
      const economyUserBalance = new EconomyUserBalanceKlass({
          client_id: oThis.clientId,
          ethereum_addresses: ethereumAddresses
        }),
        userBalancesResponse = await economyUserBalance.perform();

      if (!userBalancesResponse.isFailure()) {
        balanceHashData = userBalancesResponse.data;
      }
    }

    for (var i = 0; i < queryResponse.length; i++) {
      const object = queryResponse[i];

      if (i === oThis.limit) {
        // as we fetched limit + 1, if that was returned set hasMore to true and ignore this extra one
        hasMore = true;
        continue;
      }

      var balanceData = balanceHashData[object['ethereum_address']];
      if (!balanceData) {
        var lowerCasedAddr = object['ethereum_address'].toLowerCase();
        balanceData = balanceHashData[lowerCasedAddr];
      }

      var userData = {
        id: object['uuid'],
        name: object['name'] || '',
        uuid: object['uuid'],
        address: object['ethereum_address'],
        total_airdropped_tokens: basicHelper.convertToNormal((balanceData || {}).totalAirdroppedTokens).toString(10),
        token_balance: basicHelper.convertToNormal((balanceData || {}).tokenBalance).toString(10)
      };

      const userEntityFormatter = new UserEntityFormatterKlass(userData),
        userEntityFormatterRsp = await userEntityFormatter.perform();

      usersList.push(userEntityFormatterRsp.data);
    }

    let next_page_payload = {};

    if (hasMore) {
      next_page_payload = {
        order_by: oThis.orderBy,
        order: oThis.order,
        page_no: oThis.pageNo + 1,
        limit: oThis.limit
      };

      if (!commonValidator.isVarNull(oThis.airdropped)) {
        next_page_payload.airdropped = oThis.airdropped;
      }
    }

    return Promise.resolve(
      responseHelper.successWithData({
        result_type: 'users',
        users: usersList,
        meta: {
          next_page_payload: next_page_payload
        }
      })
    );
  },

  /**
   *
   * Validate & Sanitize Params
   *
   * @private
   *
   * @return {Promise<result>}
   *
   */
  validateAndSanitize: async function() {
    const oThis = this,
      errors_object = [];

    let pageNoVas = commonValidator.validateAndSanitizePageNo(oThis.pageNo);

    if (!pageNoVas[0]) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_cu_l_2',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_page_no'],
          debug_options: {}
        })
      );
    }
    oThis.pageNo = pageNoVas[1];

    let limitVas = commonValidator.validateAndSanitizeLimit(oThis.limit);

    if (!limitVas[0]) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_cu_l_3',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_pagination_limit'],
          debug_options: {}
        })
      );
    }
    oThis.limit = limitVas[1];

    oThis.offset = (oThis.pageNo - 1) * oThis.limit;

    if (!commonValidator.isVarNull(oThis.airdropped) && !commonValidator.isValidBoolean(oThis.airdropped)) {
      errors_object.push('invalid_filter_user_list');
    }

    if (!oThis.orderBy) {
      oThis.orderBy = 'created';
    } else if (!['name', 'created'].includes(oThis.orderBy.toLowerCase())) {
      errors_object.push('invalid_order_by_user_list');
    }

    if (!oThis.order) {
      oThis.order = 'desc';
    } else if (!commonValidator.isValidOrderingString(oThis.order)) {
      errors_object.push('invalid_order');
    }

    if (oThis.uuidsString) {
      oThis.uuidsForFiltering = basicHelper.commaSeperatedStrToArray(oThis.uuidsString);
      if (oThis.uuidsForFiltering.length > 100) {
        errors_object.push('invalid_id_user_list');
      } else {
        if (!commonValidator.isValidUuidArray(oThis.uuidsForFiltering)) {
          errors_object.push('invalid_id_user_list');
        }
      }
    }

    if (errors_object.length > 0) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_cu_l_4',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: errors_object,
          debug_options: {}
        })
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

module.exports = listUserKlass;

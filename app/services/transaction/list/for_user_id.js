"use strict";

const rootPrefix = '../../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , BaseKlass = require(rootPrefix + '/app/services/transaction/list/base')
;

const GetTransactionList = function(params) {
  const oThis = this
  ;

  oThis.clientId = params.client_id;
  oThis.user_uuid = params.uuid;
  oThis.status = params.status;
};

GetTransactionList.prototype = Object.create(BaseKlass.prototype);

GetTransactionListForUser.prototype = {
  /**
   *
   * Perform
   *
   * @return {Promise}
   *
   */
  perform: function () {
    const oThis = this
    ;

    return oThis.asyncPerform()
      .catch(function (error) {
        if (responseHelper.isCustomResult(error)) {
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);
          return responseHelper.error({
            internal_error_identifier: 's_t_l_fci_1',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
        }
      });
  },

  /**
   * asyncPerform
   *
   * @return {Promise}
   */
  asyncPerform: async function() {
    const oThis = this
    ;

    await oThis.validateAndSanitize();

    await oThis.getFilteredUuids();

    return oThis.getDataForUuids();

  },

  /**
   * validateAndSanitize
   * 
   */
  validateAndSanitize: function () {
    const oThis = this
    ;

  },

  getFilteredUuids: function () {
    const oThis = this
    ;



  }

};

Object.assign(GetTransactionList.prototype, GetTransactionListForUser);

module.exports = GetTransactionList;
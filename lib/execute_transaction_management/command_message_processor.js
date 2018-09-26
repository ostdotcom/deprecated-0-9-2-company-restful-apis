'use strict';
const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response');

const CommandMessageProcessor = function() {};

CommandMessageProcessor.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 'l_obg_as_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  asyncPerform: async function() {
    return Promise.resolve();
  }
};

module.exports = CommandMessageProcessor;

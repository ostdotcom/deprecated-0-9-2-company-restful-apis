'use strict';

const rootPrefix = '../../..',
  v1ErrorConfig = require(rootPrefix + '/config/api_params/v1/error_config');

const v1Dot1ErrorConfig = {
  invalid_status_transactions_ledger: {
    parameter: 'status',
    code: 'invalid',
    message: 'status should have comma seperated status filters (eg: processing,waiting_for_mining,complete,failed)'
  }
};

module.exports = Object.assign({}, v1ErrorConfig, v1Dot1ErrorConfig);

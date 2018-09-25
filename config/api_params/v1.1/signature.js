'use strict';

const rootPrefix = '../../..',
  v1Signature = require(rootPrefix + '/config/api_params/v1/signature');

const v1Dot1Signature = {
  get_balance: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'id',
        error_identifier: 'missing_id'
      }
    ],
    optional: []
  },
  get_transaction_ledger: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'id',
        error_identifier: 'missing_id'
      }
    ],
    optional: ['page_no', 'order_by', 'order', 'limit', 'status']
  }
};

module.exports = Object.assign({}, v1Signature, v1Dot1Signature);

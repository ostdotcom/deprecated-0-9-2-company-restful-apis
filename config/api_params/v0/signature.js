'use strict';

const signature = {
  create_user: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'address_type',
        error_identifier: 'missing_address_type'
      }
    ],
    optional: ['name', 'eth_address', 'private_key']
  },
  edit_user: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'uuid',
        error_identifier: 'missing_uuid'
      },
      {
        parameter: 'name',
        error_identifier: 'missing_name'
      }
    ],
    optional: []
  },
  list_users: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      }
    ],
    optional: ['page_no', 'filter', 'order_by', 'order']
  },
  start_airdrop: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'amount',
        error_identifier: 'missing_airdrop_amount'
      },
      {
        parameter: 'list_type',
        error_identifier: 'invalid_airdrop_list_type'
      }
    ],
    optional: ['user_ids']
  },
  airdrop_status: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'airdrop_uuid',
        error_identifier: 'airdrop_uuid_missing'
      }
    ],
    optional: []
  },
  create_new_action: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'kind',
        error_identifier: 'missing_kind'
      },
      {
        parameter: 'name',
        error_identifier: 'missing_name'
      },
      {
        parameter: 'currency_type',
        error_identifier: 'missing_currency_type'
      },
      {
        parameter: 'currency_value',
        error_identifier: 'missing_currency_value'
      }
    ],
    optional: ['commission_percent']
  },
  update_action: {
    mandatory: [
      {
        parameter: 'client_transaction_id',
        error_identifier: 'missing_client_transaction_id'
      },
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      }
    ],
    optional: ['name', 'currency_type', 'currency_value', 'commission_percent']
  },
  list_actions: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      }
    ],
    optional: ['extra_entities']
  },
  execute_transaction: {
    mandatory: [
      {
        parameter: 'from_uuid',
        error_identifier: 'missing_from_uuid'
      },
      {
        parameter: 'to_uuid',
        error_identifier: 'missing_to_uuid'
      },
      {
        parameter: 'transaction_kind',
        error_identifier: 'missing_transaction_kind'
      },
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      }
    ],
    optional: []
  },
  get_transaction_detail: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'transaction_uuids',
        error_identifier: 'missing_transaction_uuids'
      }
    ],
    optional: []
  }
};

module.exports = signature;

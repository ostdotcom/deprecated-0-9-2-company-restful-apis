'use strict';

const signature = {
  edit_user: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'id',
        error_identifier: 'missing_id'
      },
      {
        parameter: 'name',
        error_identifier: 'missing_name'
      }
    ],
    optional: []
  },
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
  fetch_user: {
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
  list_users: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      }
    ],
    optional: ['page_no', 'airdropped', 'order_by', 'order', 'limit', 'id']
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
      }
    ],
    optional: ['airdropped', 'user_ids']
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
  list_airdrop: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      }
    ],
    optional: ['page_no', 'order_by', 'order', 'limit', 'id', 'current_status']
  },
  fetch_token_details: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      }
    ],
    optional: []
  },
  create_new_action: {
    mandatory: [
      {
        parameter: 'name',
        error_identifier: 'missing_name'
      },
      {
        parameter: 'kind',
        error_identifier: 'missing_kind'
      },
      {
        parameter: 'currency',
        error_identifier: 'missing_currency'
      },
      {
        parameter: 'arbitrary_amount',
        error_identifier: 'missing_arbitrary_amount'
      },
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      }
    ],
    optional: ['arbitrary_commission', 'amount', 'commission_percent']
  },
  update_action: {
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
    optional: ['arbitrary_amount', 'arbitrary_commission', 'name', 'currency', 'amount', 'commission_percent']
  },
  list_actions: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      }
    ],
    optional: [
      'id',
      'name',
      'kind',
      'currency',
      'arbitrary_amount',
      'arbitrary_commission',
      'page_no',
      'order_by',
      'order',
      'limit'
    ]
  },
  get_action: {
    mandatory: [
      {
        parameter: 'id',
        error_identifier: 'missing_id'
      },
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      }
    ]
  },
  execute_transaction: {
    mandatory: [
      {
        parameter: 'action_id',
        error_identifier: 'missing_action_id'
      },
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      }
    ],
    optional: ['from_user_id', 'to_user_id', 'amount', 'commission_percent']
  },
  list_transactions: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      }
    ],
    optional: ['page_no', 'order_by', 'order', 'limit', 'id']
  },
  get_transaction: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'id',
        error_identifier: 'missing_id_param'
      }
    ],
    optional: []
  },
  execute_stp_transfer: {
    mandatory: [
      {
        parameter: 'to_address',
        error_identifier: 'missing_to_address'
      },
      {
        parameter: 'amount',
        error_identifier: 'missing_amount'
      },
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      }
    ],
    optional: []
  },
  list_stp_transfers: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      }
    ],
    optional: ['page_no', 'order_by', 'order', 'limit', 'id']
  },
  get_stp_transfer: {
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
  }
};

module.exports = signature;

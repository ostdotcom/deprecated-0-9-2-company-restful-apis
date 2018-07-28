'use strict';

const signature = {
  fetch_client_stats: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      }
    ],
    optional: []
  },
  fetch_user_details: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'ethereum_addresses',
        error_identifier: 'missing_ethereum_addresses'
      }
    ],
    optional: []
  },
  fetch_user_addresses: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'uuids',
        error_identifier: 'missing_uuids'
      }
    ],
    optional: []
  },
  kit_airdrop: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'token_symbol',
        error_identifier: 'missing_token_symbol'
      },
      {
        parameter: 'amount',
        error_identifier: 'missing_amount'
      },
      {
        parameter: 'client_token_id',
        error_identifier: 'missing_client_token_id'
      }
    ],
    optional: ['airdropped', 'list_type']
  },
  start_on_boarding: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'client_token_id',
        error_identifier: 'missing_client_token_id'
      },
      {
        parameter: 'token_symbol',
        error_identifier: 'missing_token_symbol'
      },
      {
        parameter: 'stake_and_mint_params',
        error_identifier: 'missing_stake_and_mint_params'
      },
      {
        parameter: 'airdrop_params',
        error_identifier: 'missing_airdrop_params'
      }
    ],
    optional: []
  },
  setup_bt: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'symbol',
        error_identifier: 'missing_token_symbol'
      },
      {
        parameter: 'name',
        error_identifier: 'missing_token_name'
      },
      {
        parameter: 'symbol_icon',
        error_identifier: 'missing_token_symbol_icon'
      }
    ],
    optional: []
  },
  edit_bt: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'symbol',
        error_identifier: 'missing_token_symbol'
      }
    ],
    optional: ['name', 'symbol_icon', 'token_erc20_address', 'airdrop_contract_addr', 'token_uuid', 'conversion_factor']
  },
  create_dummy_users: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'number_of_users',
        error_identifier: 'missing_number_of_users'
      }
    ],
    optional: []
  },
  fetch_chain_interaction_params: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      }
    ],
    optional: []
  },
  fetch_balances: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'balances_to_fetch',
        error_identifier: 'missing_balances_to_fetch'
      }
    ],
    optional: []
  },
  simulate_random_transaction: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'token_symbol',
        error_identifier: 'missing_token_symbol'
      }
    ],
    optional: ['prioritize_company_txs']
  },
  fetch_transaction_details: {
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
  },
  fetch_staked_ost_amount: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'token_symbol',
        error_identifier: 'missing_token_symbol'
      }
    ],
    optional: []
  },
  start_stake_and_mint: {
    mandatory: [
      {
        parameter: 'client_id',
        error_identifier: 'missing_client_id'
      },
      {
        parameter: 'token_symbol',
        error_identifier: 'missing_token_symbol'
      },
      {
        parameter: 'stake_and_mint_params',
        error_identifier: 'missing_stake_and_mint_params'
      },
      {
        parameter: 'client_token_id',
        error_identifier: 'missing_client_token_id'
      }
    ],
    optional: []
  }
};

module.exports = signature;

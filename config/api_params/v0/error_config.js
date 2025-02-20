'use strict';

const errorConfig = {
  missing_client_id: {
    parameter: 'client_id',
    code: 'missing',
    message: 'Unauthorized access'
  },
  invalid_client_id: {
    parameter: 'client_id',
    code: 'invalid',
    message: 'Invalid client id'
  },
  missing_address_type: {
    parameter: 'address_type',
    code: 'missing',
    message: 'Missing address_type'
  },
  missing_uuid: {
    parameter: 'uuid',
    code: 'missing',
    message: 'Missing uuid'
  },
  missing_name: {
    parameter: 'name',
    code: 'missing',
    message: 'Missing name'
  },
  missing_kind: {
    parameter: 'kind',
    code: 'missing',
    message: 'Missing kind'
  },
  missing_currency_type: {
    parameter: 'currency_type',
    code: 'missing',
    message: 'Missing currency type'
  },
  missing_currency_value: {
    parameter: 'currency_value',
    code: 'missing',
    message: 'Missing currency value'
  },
  invalid_username: {
    parameter: 'name',
    message:
      'Must be a minimum of 3 characters, a maximum of 20 characters, and can contain only letters, numbers, and spaces, along with other common sense limitations.'
  },
  inappropriate_username: {
    parameter: 'name',
    message: 'Come on, the name you entered is inappropriate. Please choose a nicer word.'
  },
  invalid_page_no: {
    parameter: 'page_no',
    code: 'invalid',
    message: 'Invalid page_no'
  },
  invalid_limit: {
    parameter: 'limit',
    code: 'invalid',
    message: 'Invalid limit'
  },
  invalid_pagination_limit: {
    parameter: 'limit',
    code: 'invalid',
    message: 'Invalid limit'
  },
  invalid_order_by_user_list: {
    parameter: 'order_by',
    code: 'invalid',
    message: "order the list by 'created' (default) or 'name'"
  },
  invalid_order: {
    parameter: 'order',
    code: 'invalid',
    message: "Order users in 'desc' (default) or 'asc' order."
  },
  invalid_id_user: {
    parameter: 'uuid',
    code: 'invalid',
    message: 'Invalid uuid passed'
  },
  invalid_filter_user_list: {
    parameter: 'filter',
    code: 'invalid',
    message: 'Invalid filter'
  },
  invalid_airdrop_uuid: {
    parameter: 'airdrop_uuid',
    code: 'invalid',
    message: 'Invalid airdrop uuid'
  },
  missing_airdrop_amount: {
    parameter: 'amount',
    code: 'missing',
    message: 'Invalid airdrop amount'
  },
  invalid_airdrop_amount: {
    parameter: 'amount',
    code: 'invalid',
    message: 'Invalid airdrop amount'
  },
  insufficient_airdrop_amount: {
    parameter: 'amount',
    code: 'invalid',
    message:
      'Available token amount is insufficient. Please mint more tokens or reduce the amount to complete the process.'
  },
  airdropped_filter_empty_list: {
    parameter: 'airdropped',
    code: 'invalid',
    message: 'No users found to airdrop for the filters selected'
  },
  invalid_airdrop_list_type: {
    parameter: 'list_type',
    message: 'Invalid List type to airdrop users.'
  },
  no_users_for_airdrop_list_type: {
    parameter: 'airdrop_list_type',
    message: 'No users found to airdrop for this list type.'
  },
  invalid_token_symbol: {
    parameter: 'token_symbol',
    message: 'Invalid Token Symbol'
  },
  invalid_transaction_name: {
    parameter: 'name',
    message: 'Only letters, numbers and spaces allowed. (3 to 20 characters).'
  },
  inappropriate_transaction_name: {
    parameter: 'name',
    message:
      'Must be a minimum of 3 characters, a maximum of 20 characters, and can contain only numbers, letters, and spaces, along with other common sense limitations.'
  },
  invalid_transactionkind: {
    parameter: 'kind',
    message: 'Invalid transaction kind.'
  },
  duplicate_transaction_name: {
    parameter: 'name',
    message: 'An action with that name already exists.'
  },
  out_of_bound_transaction_usd_value: {
    parameter: 'currency_value',
    message: 'Can be 0.01 to 100'
  },
  out_of_bound_transaction_bt_value: {
    parameter: 'currency_value',
    code: 'invalid',
    message: 'Can be 0.00001 to 100'
  },
  invalid_currency_type: {
    parameter: 'currency_type',
    code: 'invalid',
    message: "Must be either 'USD' (fixed) or 'BT' (floating)."
  },
  invalid_commission_percent: {
    parameter: 'commission_percent',
    message: "Can only be set for 'user_to_user' actions and can be 0 to 100."
  },
  missing_client_transaction_id: {
    parameter: 'client_transaction_id',
    message: 'Missing client_transaction_id'
  },
  invalid_client_transaction_id: {
    parameter: 'client_transaction_id',
    message: 'Invalid client_transaction_id'
  },
  invalid_amount_arbitrary_combination: {
    parameter: 'currency_value',
    code: 'invalid',
    message: 'Currency value is not valid'
  },
  invalid_amount: {
    parameter: 'currency_value',
    code: 'invalid',
    message: 'Invalid currency value.'
  },
  invalid_commission_arbitrary_combination: {
    parameter: 'commission_percent',
    code: 'invalid',
    message: 'Commission percent is not valid'
  },
  invalid_from_user_uuid: {
    parameter: 'from_uuid',
    message: 'Invalid from_uuid'
  },
  invalid_to_user_uuid: {
    parameter: 'to_uuid',
    message: 'Invalid to_uuid'
  },
  invalid_action_id: {
    parameter: 'transaction_kind',
    code: 'invalid',
    message: 'Invalid transaction_kind'
  },
  airdrop_uuid_missing: {
    parameter: 'airdrop_uuid',
    code: 'missing',
    message: 'Airdrop UUID missing.'
  },
  invalid_airdrop_uuids: {
    parameter: 'user_ids',
    code: 'invalid',
    message: 'Some of user ids passed for Airdrop are invalid.'
  },
  missing_from_uuid: {
    parameter: 'from_uuid',
    code: 'missing',
    message: 'Missing from_uuid'
  },
  missing_to_uuid: {
    parameter: 'to_uuid',
    code: 'missing',
    message: 'Missing to_uuid'
  },
  missing_transaction_kind: {
    parameter: 'transaction_kind',
    code: 'missing',
    message: 'Missing transaction_kind'
  },
  missing_transaction_uuids: {
    parameter: 'transaction_uuids',
    code: 'missing',
    message: 'Missing transaction_uuids'
  },
  invalid_from_user_id: {
    parameter: 'from_uuid',
    code: 'invalid',
    message: 'Invalid from_uuid'
  },
  invalid_to_user_id: {
    parameter: 'to_uuid',
    code: 'invalid',
    message: 'Invalid to_uuid'
  },
  invalid_airdropped_filter: {
    parameter: 'airdropped',
    code: 'invalid',
    message: 'airdropped can be True of False'
  }
};

module.exports = errorConfig;

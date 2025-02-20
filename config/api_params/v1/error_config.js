'use strict';

const errorConfig = {
  missing_client_id: {
    parameter: 'client_id',
    code: 'missing',
    message: 'Invalid client id'
  },
  missing_address_type: {
    parameter: 'address_type',
    code: 'missing',
    message: 'Missing address_type'
  },
  missing_id: {
    parameter: 'id',
    code: 'missing',
    message: 'missing id'
  },
  missing_name: {
    parameter: 'name',
    code: 'missing',
    message: 'missing name'
  },
  missing_kind: {
    parameter: 'kind',
    code: 'missing',
    message: 'missing kind'
  },
  missing_currency: {
    parameter: 'currency',
    code: 'missing',
    message: 'missing currency'
  },
  missing_arbitrary_amount: {
    parameter: 'arbitrary_amount',
    code: 'missing',
    message: 'missing arbitrary amount'
  },
  missing_arbitrary_commission: {
    parameter: 'arbitrary_commission',
    code: 'missing',
    message: 'missing arbitrary commission'
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
  invalid_transaction_name: {
    parameter: 'name',
    message: 'Only letters, numbers and spaces allowed. (3 to 20 characters).'
  },
  invalid_transactionkind: {
    parameter: 'kind',
    message: 'Invalid transaction kind.'
  },
  inappropriate_transaction_name: {
    parameter: 'name',
    message:
      'Must be a minimum of 3 characters, a maximum of 20 characters, and can contain only numbers, letters, and spaces, along with other common sense limitations.'
  },
  duplicate_transaction_name: {
    parameter: 'name',
    message: 'An action with that name already exists.'
  },
  invalid_filter_user_list: {
    parameter: 'airdropped',
    code: 'invalid',
    message: 'Invalid airdropped'
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
    message: 'Min 1, Max 100, Default 10.'
  },
  invalid_order_by_user_list: {
    parameter: 'order_by',
    code: 'invalid',
    message: "order the list by 'created' (default) or 'name'"
  },
  invalid_order: {
    parameter: 'order',
    code: 'invalid',
    message: "order in 'desc' (default) or 'asc' order."
  },
  invalid_id_user_list: {
    parameter: 'id',
    code: 'invalid',
    message: 'id should have comma seperated values (max 100)'
  },
  invalid_id_transaction_get: {
    parameter: 'id',
    code: 'invalid',
    message: 'invalid id passed.'
  },
  invalid_transaction_status: {
    parameter: 'status',
    code: 'invalid',
    message: 'invalid status passed.'
  },
  invalid_id_transfer_get: {
    parameter: 'id',
    code: 'invalid',
    message: 'invalid id passed.'
  },
  invalid_client_transaction_id: {
    parameter: 'id',
    code: 'invalid',
    message: 'invalid id passed.'
  },
  missing_id_param: {
    parameter: 'id',
    code: 'missing',
    message: 'Missing id.'
  },
  invalid_id_user: {
    parameter: 'id',
    code: 'invalid',
    message: 'invalid id passed'
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
  invalid_airdropped_filter: {
    parameter: 'airdropped',
    code: 'invalid',
    message: 'airdropped can be True of False'
  },
  invalid_client_id: {
    parameter: 'client_id',
    code: 'invalid',
    message: 'Unauthorized access'
  },
  airdropped_filter_empty_list: {
    parameter: 'airdropped',
    code: 'invalid',
    message: 'No users found to airdrop for the filters selected'
  },
  insufficient_airdrop_amount: {
    parameter: 'amount',
    code: 'invalid',
    message:
      'Available token amount is insufficient. Please mint more tokens or reduce the amount to complete the process.'
  },
  invalid_token_symbol: {
    parameter: 'token_symbol',
    message: 'Invalid Token Symbol'
  },
  invalid_amount_arbitrary_combination: {
    parameter: 'amount',
    code: 'invalid',
    message: 'Amount and arbitrary amount combination is not valid'
  },
  invalid_commission_arbitrary_combination: {
    parameter: 'commission_percent',
    code: 'invalid',
    message: 'Commission percent and arbitrary commission combination is not valid'
  },
  out_of_bound_transaction_usd_value: {
    parameter: 'amount',
    code: 'invalid',
    message: 'Can be 0.01 to 100'
  },
  out_of_bound_transaction_bt_value: {
    parameter: 'amount',
    code: 'invalid',
    message: 'Can be 0.00001 to 100'
  },
  airdrop_uuid_missing: {
    parameter: 'airdrop_uuid',
    code: 'missing',
    message: 'Airdrop UUID missing.'
  },
  invalid_airdrop_uuid: {
    parameter: 'id',
    code: 'invalid',
    message: 'Invalid airdrop uuid'
  },
  invalid_airdrop_uuids: {
    parameter: 'user_ids',
    code: 'invalid',
    message: 'Some of user ids passed for Airdrop are invalid.'
  },
  invalid_order_by_airdrop_list: {
    parameter: 'order_by',
    code: 'invalid',
    message: "order the list by 'created' (default) for Now."
  },
  invalid_id_filter: {
    parameter: 'id',
    code: 'invalid',
    message: 'id should have comma separated airdrop ids (max 100)'
  },
  invalid_current_status_airdrop_list: {
    parameter: 'current_status',
    code: 'invalid',
    message: 'current status should have comma seperated status filters (eg: incomplete,processing,complete,failed)'
  },
  invalid_order_by: {
    parameter: 'order_by',
    message: 'Order by not valid on this field'
  },
  invalid_arbitrary_amount_filter: {
    parameter: 'arbitrary_amount',
    message: 'Filter on arbitrary_amount can have only one value'
  },
  invalid_arbitrary_commission_filter: {
    parameter: 'arbitrary_commission',
    code: 'invalid',
    message: 'Filter on arbitrary_commission can have only one value and should be a valid boolean'
  },
  invalid_arbitrary_commission: {
    parameter: 'arbitrary_commission',
    code: 'invalid',
    message: 'Invalid arbitrary_commission'
  },
  invalid_currency_type: {
    parameter: 'currency',
    code: 'invalid',
    message: "Must be either 'USD' (fixed) or 'BT' (floating)."
  },
  invalid_currency_filter: {
    parameter: 'currency',
    message: 'Filter on currency can have only one value'
  },
  invalid_amount: {
    parameter: 'amount',
    code: 'invalid',
    message: 'Invalid amount.'
  },
  invalid_arbitrary_amount: {
    parameter: 'arbitrary_amount',
    code: 'invalid',
    message: 'Invalid arbitrary_amount.'
  },
  invalid_commission_percent: {
    parameter: 'commission_percent',
    code: 'invalid',
    message: 'Invalid commision percent.'
  },
  arbitrary_commission_already_set_to_true: {
    parameter: 'commission_percent',
    code: 'invalid',
    message:
      'Arbitrary commission is already set to True. To make commission_percent non arbritrary, please send arbitrary_commission as false.'
  },
  invalid_from_user_id: {
    parameter: 'from_user_id',
    message: 'Invalid from user id.'
  },
  invalid_to_user_id: {
    parameter: 'to_user_id',
    message: 'Invalid to user id.'
  },
  missing_from_user_id: {
    parameter: 'from_user_id',
    code: 'missing',
    message: 'Missing from_user_id'
  },
  missing_to_user_id: {
    parameter: 'to_user_id',
    code: 'missing',
    message: 'Missing to_user_id'
  },
  missing_action_id: {
    parameter: 'action_id',
    code: 'missing',
    message: 'Missing action_id'
  },
  invalid_action_id: {
    parameter: 'action_id',
    code: 'invalid',
    message: 'Invalid action_id'
  },
  invalid_id: {
    parameter: 'id',
    code: 'invalid',
    message: 'Missing id'
  },
  missing_amount: {
    parameter: 'amount',
    code: 'missing',
    message: 'Missing amount'
  },
  missing_to_address: {
    parameter: 'to_address',
    code: 'missing',
    message: 'Missing to_address'
  },
  invalid_transaction_get: {
    parameter: 'transaction_type',
    message: 'Requested transfer data for invalid transaction type.'
  },
  invalid_transfer_amount: {
    parameter: 'amount',
    message: 'Transfer amount should be between 0 and 100 ST Prime. Amount should be in Weis.'
  },
  invalid_to_address: {
    parameter: 'to_address',
    code: 'invalid',
    message: 'Invalid to_address'
  }
};

module.exports = errorConfig;

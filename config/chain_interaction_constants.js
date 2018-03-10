"use strict";

function define(name, value) {
  Object.defineProperty(exports, name, {
    value: value,
    enumerable: true
  });
}

// Constants which are needed to interact with Utility Chain
define("UTILITY_CHAIN_OWNER_ADDR", process.env.OST_UTILITY_CHAIN_OWNER_ADDR);
define("STAKER_ADDR", process.env.OST_STAKER_ADDR);
define("REDEEMER_ADDR", process.env.OST_REDEEMER_ADDR);
define("VALUE_REGISTRAR_ADDR", process.env.OST_VALUE_REGISTRAR_ADDR);
define("VALUE_DEPLOYER_ADDR", process.env.OST_VALUE_DEPLOYER_ADDR);
define("VALUE_OPS_ADDR", process.env.OST_VALUE_OPS_ADDR);

define("UTILITY_REGISTRAR_ADDR", process.env.OST_UTILITY_REGISTRAR_ADDR);
define("UTILITY_OPS_ADDR", process.env.OST_UTILITY_OPS_ADDR);

define("FOUNDATION_ADDR", process.env.OST_FOUNDATION_ADDR);

define("UTILITY_CHAIN_ID", process.env.OST_UTILITY_CHAIN_ID);
define("UTILITY_GAS_PRICE", process.env.OST_UTILITY_GAS_PRICE);
define("UTILITY_GETH_RPC_PROVIDER", process.env.OST_UTILITY_GETH_RPC_PROVIDER);
define("UTILITY_OPS_ADDR", process.env.OST_UTILITY_OPS_ADDR);
define("UTILITY_OPS_PASSPHRASE", process.env.OST_UTILITY_OPS_PASSPHRASE);

define("UTILITY_DEPLOYER_ADDR", process.env.OST_UTILITY_DEPLOYER_ADDR);
define("UTILITY_DEPLOYER_PASSPHRASE", process.env.OST_UTILITY_DEPLOYER_PASSPHRASE);

// Constants which are needed to interact with Value Chain
define("VALUE_CHAIN_ID", process.env.OST_VALUE_CHAIN_ID);
define("VALUE_GAS_PRICE", process.env.OST_VALUE_GAS_PRICE);
define("VALUE_GETH_RPC_PROVIDER", process.env.OST_VALUE_GETH_RPC_PROVIDER);

define("ST_PRIME_UUID", process.env.OST_OPENSTUTILITY_ST_PRIME_UUID);

// Contract addresses
define("SIMPLE_TOKEN_CONTRACT_ADDR", process.env.OST_SIMPLE_TOKEN_CONTRACT_ADDR);
define("STAKER_ADDR", process.env.OST_STAKER_ADDR);

const OST_VALUE_GETH_RPC_PROVIDERS = JSON.parse(process.env.OST_VALUE_GETH_RPC_PROVIDERS);
define('OST_VALUE_GETH_RPC_PROVIDERS', OST_VALUE_GETH_RPC_PROVIDERS);

const OST_UTILITY_GETH_RPC_PROVIDERS = JSON.parse(process.env.OST_UTILITY_GETH_RPC_PROVIDERS);
define('OST_UTILITY_GETH_RPC_PROVIDERS', OST_UTILITY_GETH_RPC_PROVIDERS);

const providerHostToChainKindMap = {};

for(var i = 0; i < OST_VALUE_GETH_RPC_PROVIDERS.length; i ++) {
  providerHostToChainKindMap[OST_VALUE_GETH_RPC_PROVIDERS[i]] = 'value';
}

for(var i = 0; i < OST_UTILITY_GETH_RPC_PROVIDERS.length; i ++) {
  providerHostToChainKindMap[OST_UTILITY_GETH_RPC_PROVIDERS[i]] = 'utility';
}

define('GETH_PROVIDER_TO_CHAIN_KIND_MAP', providerHostToChainKindMap);

// Price oracle details
var po_contracts = {};
try {
  po_contracts = JSON.parse(process.env.OST_UTILITY_PRICE_ORACLES);
} catch(err) {
}
define("UTILITY_PRICE_ORACLES", po_contracts);

//Workers contract address to setup workers and deploy airdropcontract
define('UTILITY_WORKERS_CONTRACT_ADDRESS', process.env.OST_UTILITY_WORKERS_CONTRACT_ADDRESS);

//Map of all addresses which would be needed to unlocked via Key Store File
//Every other address will be unlocked via private_key
const addresses_to_unlock_via_keystore_file = ['OST_UTILITY_INITIAL_ST_PRIME_HOLDER_ADDR'];

var addresses_to_unlock_via_keystore_file_map = {};
for(var i=0; i<addresses_to_unlock_via_keystore_file.length; i++) {
  var addr = process.env[addresses_to_unlock_via_keystore_file[i]];
  if (addr) {
    addresses_to_unlock_via_keystore_file_map[addr.toLowerCase()] = 1;
  }
}

define('ADDRESSES_TO_UNLOCK_VIA_KEYSTORE_FILE_MAP', addresses_to_unlock_via_keystore_file_map);
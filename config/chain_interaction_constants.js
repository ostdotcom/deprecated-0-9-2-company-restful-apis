"use strict";

function define(name, value) {
  Object.defineProperty(exports, name, {
    value: value,
    enumerable: true
  });
}

// Constants which are needed to interact with Utility Chain
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

// Price oracle details
var po_contracts = {};
try {
  po_contracts = JSON.parse(process.env.OST_UTILITY_PRICE_ORACLES);
} catch(err) {
}
define("UTILITY_PRICE_ORACLES", po_contracts);

//Workers contract address to setup workers and deploy airdropcontract
define('UTILITY_WORKERS_CONTRACT_ADDRESS', process.env.OST_UTILITY_WORKERS_CONTRACT_ADDRESS);
"use strict";

function define(name, value) {
  Object.defineProperty(exports, name, {
    value: value,
    enumerable: true
  });
}

// Constants which are needed to interact with Utility Chain
define("UTILITY_CHAIN_ID", process.env.OST_UTILITY_CHAIN_ID);
define("UTILITY_GETH_RPC_PROVIDER", process.env.OST_UTILITY_GETH_RPC_PROVIDER);

// Constants which are needed to interact with Value Chain
define("VALUE_CHAIN_ID", process.env.OST_VALUE_CHAIN_ID);
define("VALUE_GETH_RPC_PROVIDER", process.env.OST_VALUE_GETH_RPC_PROVIDER);

define("SIMPLE_TOKEN_CONTRACT_ADDR", process.env.OST_SIMPLE_TOKEN_CONTRACT_ADDR);
define("STAKER_ADDR", process.env.OST_STAKER_ADDR);
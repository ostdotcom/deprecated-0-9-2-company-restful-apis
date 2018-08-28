'use strict';
const rootPrefix = '.',
  fs = require('fs');

let originalConfigStrategy = require(rootPrefix + '/uc_1000.json'),
  homeAbsolutePath = process.env.HOME,
  correctConfigStrategy = require(homeAbsolutePath +
    '/openst-setup/bin/utility-chain-1000/openst_platform_config.json');

// Update addresses here.

originalConfigStrategy['OST_STAKER_ADDR'] = correctConfigStrategy['OST_STAKER_ADDR'];
originalConfigStrategy['OST_REDEEMER_ADDR'] = correctConfigStrategy['OST_REDEEMER_ADDR'];
originalConfigStrategy['OST_OPENSTUTILITY_ST_PRIME_UUID'] = correctConfigStrategy['OST_OPENSTUTILITY_ST_PRIME_UUID'];
originalConfigStrategy['OST_UTILITY_CHAIN_OWNER_ADDR'] = correctConfigStrategy['OST_UTILITY_CHAIN_OWNER_ADDR'];
originalConfigStrategy['OST_UTILITY_INITIAL_ST_PRIME_HOLDER_ADDR'] =
  correctConfigStrategy['OST_UTILITY_INITIAL_ST_PRIME_HOLDER_ADDR'];
originalConfigStrategy['OST_UTILITY_REGISTRAR_ADDR'] = correctConfigStrategy['OST_UTILITY_REGISTRAR_ADDR'];
originalConfigStrategy['OST_OPENSTUTILITY_CONTRACT_ADDR'] = correctConfigStrategy['OST_OPENSTUTILITY_CONTRACT_ADDR'];
originalConfigStrategy['OST_UTILITY_REGISTRAR_CONTRACT_ADDR'] =
  correctConfigStrategy['OST_UTILITY_REGISTRAR_CONTRACT_ADDR'];
originalConfigStrategy['OST_UTILITY_DEPLOYER_ADDR'] = correctConfigStrategy['OST_UTILITY_DEPLOYER_ADDR'];
originalConfigStrategy['OST_UTILITY_OPS_ADDR'] = correctConfigStrategy['OST_UTILITY_OPS_ADDR'];
originalConfigStrategy['OST_STPRIME_CONTRACT_ADDR'] = correctConfigStrategy['OST_STPRIME_CONTRACT_ADDR'];
originalConfigStrategy['OST_OPENSTVALUE_CONTRACT_ADDR'] = correctConfigStrategy['OST_OPENSTVALUE_CONTRACT_ADDR'];
originalConfigStrategy['OST_VALUE_REGISTRAR_ADDR'] = correctConfigStrategy['OST_VALUE_REGISTRAR_ADDR'];
originalConfigStrategy['OST_VALUE_DEPLOYER_ADDR'] = correctConfigStrategy['OST_VALUE_DEPLOYER_ADDR'];
originalConfigStrategy['OST_VALUE_CORE_CONTRACT_ADDR'] = correctConfigStrategy['OST_VALUE_CORE_CONTRACT_ADDR'];
originalConfigStrategy['OST_VALUE_REGISTRAR_CONTRACT_ADDR'] =
  correctConfigStrategy['OST_VALUE_REGISTRAR_CONTRACT_ADDR'];
originalConfigStrategy['OST_FOUNDATION_ADDR'] = correctConfigStrategy['OST_FOUNDATION_ADDR'];
originalConfigStrategy['OST_SIMPLE_TOKEN_CONTRACT_ADDR'] = correctConfigStrategy['OST_SIMPLE_TOKEN_CONTRACT_ADDR'];
originalConfigStrategy['OST_SEALER_ADDR'] = correctConfigStrategy['OST_SEALER_ADDR'];
originalConfigStrategy['OST_VALUE_OPS_ADDR'] = correctConfigStrategy['OST_VALUE_OPS_ADDR'];
originalConfigStrategy['OST_VALUE_ADMIN_ADDR'] = correctConfigStrategy['OST_VALUE_ADMIN_ADDR'];

fs.writeFile(rootPrefix + '/uc_10000.json', originalConfigStrategy, 'utf8', function(err) {
  if (err) {
    return console.log(err);
  }
  console.log('The config strategy addresses were updated.');
});

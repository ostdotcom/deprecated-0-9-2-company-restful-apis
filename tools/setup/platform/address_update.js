/**
 * [DEV ENV ONLY] This script is used to copy addresses from openst_platform_config.json to the config strategy being used.
 *
 * The script defaults to use chain id 1000. Please make the necessary changes in the file paths for updating addresses
 * for a different utility chain id.
 *
 * @module tools/setup/platform/address_update.js
 */

'use strict';

const rootPrefix = '../../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
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

// Please pass absolute file path here.
fs.writeFile(process.cwd() + '/uc_1000.json', JSON.stringify(originalConfigStrategy), 'utf8', function(err) {
  if (err) {
    return logger.log(err);
  }
  logger.log('The config strategy addresses were updated.');
  process.exit(0);
});

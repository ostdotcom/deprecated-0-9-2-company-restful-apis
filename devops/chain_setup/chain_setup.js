'use strict';

// Declaration of all the constants and requiring all the required files

const rootPrefix = '../../';

require(rootPrefix + 'module_overrides/index');
process.env.OST_UTILITY_GAS_PRICE = '0x0';
const populateConfig = require('./contract_deploy/populate_config_strategy.js');
const fs = require('fs');
const program = require('commander');
const contractDeploy = require('./contract_deploy/contract_deploy.js');

const templateFile = './contract_deploy/configTemplate.json';

// Parsing of arguments using the commmander module

program
  .option('-c, --config-file [value]', 'Init with config strategy')
  .option('-v, --deploy-value', 'Deploy value contracts')
  .option('-u, --deploy-utility', 'Deploy utility contracts')
  .option('-g, --group-id [value]', 'Group id for different side chain');

program.on('--help', function() {
  console.log(' \n \n \n    node chain_setup.js   -c config_file.json -u true -v true  \n \n ');
});

program.parse(process.argv);

const groupId = program.groupId;

var ChainSetup = function() {};

ChainSetup.prototype = {};

// Main function
async function main() {
  let rsp;
  var chainSetupObj = new ChainSetup();
  var configParse = require(templateFile);
  if (program.configFile) {
    var devopsConfig = require(program.configFile);
    let populateConfigObj = new populateConfig();
    rsp = await populateConfigObj.init();
    if (!groupId) {
      throw new Error('Group ID mandatory!');
    }

    let addresstoBeFunded = {};
    for (let key = 0; key < configParse.length; key++) {
      console.log('Insert kinds ', configParse[key].name);

      let temp_groupId = null;
      if (configParse[key].require_group_id) {
        temp_groupId = groupId;
      }

      rsp = await populateConfigObj.populateKind(configParse[key], devopsConfig, temp_groupId);

      if (configParse[key].name == 'utility_constants') {
        addresstoBeFunded['OST_UTILITY_CHAIN_OWNER_ADDR'] = rsp['OST_UTILITY_CHAIN_OWNER_ADDR'];
      }

      if (configParse[key].name == 'value_constants') {
        addresstoBeFunded['OST_FOUNDATION_ADDR'] = rsp['OST_FOUNDATION_ADDR'];
      }

      if (!rsp) {
        throw new Error(`Insert failed for ${configParse[key].name}`);
      }
    }

    console.log('\n\n Address to be funded: %s \n\n', JSON.stringify(addresstoBeFunded));
  } else if (program.deployValue) {
    var contractDeployObj = new contractDeploy();
    rsp = await contractDeployObj.deployValue();
    if (!rsp) {
      console.log('Failed in Value contract deployment ');
      return false;
    }
  } else if (program.deployUtility) {
    if (!groupId) {
      throw new Error('Group ID mandatory!');
    }
    contractDeployObj = new contractDeploy(groupId);
    rsp = await contractDeployObj.deployUtility();
    if (!rsp) {
      console.log('Failed in Utility contract deployment ');
      return false;
    }
  }
}

main()
  .then(function(rsp) {
    process.exit(0);
  })
  .catch(function(rsp) {
    console.log('Failed and the rsp was ', rsp);
    process.exit(1);
  });

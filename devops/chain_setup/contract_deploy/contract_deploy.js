'use strict';

const rootPrefix = '../../../',
  byGroupIdHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id.js'),
  ConfigStrategyOps = require('./configDbOps.js'),
  valueContractsList = [
    'OST_SIMPLE_TOKEN_CONTRACT_ADDR',
    'OST_SIMPLE_TOKEN_CONTRACT_ADDR_FINALIZE',
    'FUND_USERS_WITH_ST',
    'OST_VALUE_REGISTRAR_CONTRACT_ADDR',
    'OST_OPENSTVALUE_CONTRACT_ADDR',
    'SET_VALUE_ADMIN'
  ],
  utilityContractsList = [
    'OST_UTILITY_REGISTRAR_CONTRACT_ADDR',
    'OST_OPENSTUTILITY_CONTRACT_ADDR',
    'OST_VALUE_CORE_CONTRACT_ADDR',
    'OST_STPRIME_CONTRACT_ADDR',
    'ST_PRIME_FINALIZE',
    'OST_UTILITY_PRICE_ORACLES',
    'OST_UTILITY_WORKERS_CONTRACT_ADDRESS'
  ];
require(rootPrefix + '/module_overrides/index');
require(rootPrefix + '/lib/providers/platform');
require(rootPrefix + '/lib/providers/price_oracle');
require(rootPrefix + '/lib/providers/payments');
const fs = require('fs');
var performer = null,
  deployerResponse = null,
  valueStatusFile,
  utilityStatusFile,
  oThis;

let createdContractAddress = null,
  updrsp,
  updrsp_uuid,
  ConfigStrategyObj,
  createdUuid;

/*  Constructor that makes the object according to the chain
    i.e the object for utility chain or valiue chain
 */
var ContractDeploy = function(groupId) {
  oThis = this;
  oThis.groupId = groupId;
  if (oThis.groupId) {
    oThis.obj = new byGroupIdHelperKlass(oThis.groupId);
    utilityStatusFile = `${__dirname}/../../../../shared/${oThis.groupId}.json`;
    ConfigStrategyObj = new ConfigStrategyOps(groupId);
    oThis.kind = 'utility_constants';
  } else {
    oThis.obj = new byGroupIdHelperKlass();
    valueStatusFile = `${__dirname}/../../../../shared/valueDeployStatus.json`;
    ConfigStrategyObj = new ConfigStrategyOps();
    oThis.kind = 'value_constants';
  }
};

ContractDeploy.prototype = {
  // This function is for contract deployment based on the input of contract name
  makeStatusFile: async function(listOfTasks, statusFile) {
    if (!fs.existsSync(statusFile)) {
      let statusJson = {};
      for (let key = 0; key < listOfTasks.length; key++) {
        statusJson[listOfTasks[key]] = 'PENDING';
      }
      fs.writeFileSync(statusFile, JSON.stringify(statusJson));
    }
  },

  ContractDeployer: async function(contractName) {
    var configStrategyRsp;

    if (!oThis.groupId) {
      configStrategyRsp = await oThis.obj.get();
    } else {
      configStrategyRsp = await oThis.obj.getCompleteHash();
    }

    let InstanceComposer = require(rootPrefix + '/instance_composer'),
      configStrategyHash = configStrategyRsp.data,
      instanceComposer = new InstanceComposer(configStrategyHash),
      platformProvider = instanceComposer.getPlatformProvider(),
      poProvider = instanceComposer.getPriceOracleProvider(),
      wProvider = instanceComposer.getPaymentsProvider(),
      openSTPlaform = platformProvider.getInstance();
    let openStPayments = wProvider.getInstance();
    let setWorkerKlass = openStPayments.services.workers.deployWorkersAndSetOps;
    let setWorkerObj = new setWorkerKlass();
    switch (contractName) {
      case 'OST_UTILITY_REGISTRAR_CONTRACT_ADDR':
        performer = openSTPlaform.services.setup.utilityRegistrarDeployer;
        if (!eval(`configStrategyHash.${contractName}`)) {
          deployerResponse = await performer.perform();
          createdContractAddress = deployerResponse.data['address'];
          updrsp = await ConfigStrategyObj.updateConfigStrategy(createdContractAddress, contractName, oThis.kind);
        } else {
          return false;
        }
        break;
      case 'OST_OPENSTUTILITY_CONTRACT_ADDR':
        if (!eval(`configStrategyHash.${contractName}`)) {
          performer = openSTPlaform.services.setup.openStUtilityDeployer;
          deployerResponse = await performer.perform();
          createdContractAddress = deployerResponse.data['address'];
          updrsp = await ConfigStrategyObj.updateConfigStrategy(createdContractAddress, contractName, oThis.kind);
        } else {
          return false;
        }
        break;
      case 'OST_VALUE_CORE_CONTRACT_ADDR':
        if (!eval(`configStrategyHash.${contractName}`)) {
          performer = openSTPlaform.services.setup.valueCoreDeployer;
          deployerResponse = await performer.perform();
          createdContractAddress = deployerResponse.data['address'];

          updrsp = await ConfigStrategyObj.updateConfigStrategy(createdContractAddress, contractName, oThis.kind);
        } else {
          return false;
        }
        break;
      case 'OST_STPRIME_CONTRACT_ADDR':
        if (!eval(`configStrategyHash.${contractName}`)) {
          process.env.OST_UTILITY_INITIAL_ST_PRIME_HOLDER_PASSPHRASE =
            configStrategyHash.OST_UTILITY_INITIAL_ST_PRIME_HOLDER_PASSPHRASE;
          process.env.OST_UTILITY_INITIAL_ST_PRIME_HOLDER_ADDR =
            configStrategyHash.OST_UTILITY_INITIAL_ST_PRIME_HOLDER_ADDR;
          performer = openSTPlaform.services.setup.stPrimeDeployer;
          deployerResponse = await performer.perform();
          createdContractAddress = deployerResponse.data['address'];
          createdUuid = deployerResponse.data['uuid'];

          updrsp = await ConfigStrategyObj.updateConfigStrategy(createdContractAddress, contractName, oThis.kind);
          updrsp_uuid = await ConfigStrategyObj.updateConfigStrategy(
            createdUuid,
            'OST_OPENSTUTILITY_ST_PRIME_UUID',
            oThis.kind
          );
        } else {
          return false;
        }
        break;
      case 'ST_PRIME_FINALIZE':
        performer = openSTPlaform.services.setup.registerSTPrime;
        deployerResponse = await performer.perform();
        break;

      case 'FUND_USERS':
        performer = openSTPlaform.services.setup.fundUsersWithSTPrime;
        deployerResponse = await performer.perform();
        break;
      case 'STAKE_AND_MINT':
        performer = openSTPlaform.services.setup.stPrimeMinter;
        deployerResponse = await performer.perform();
        break;
      case 'OST_UTILITY_PRICE_ORACLES':
        let DeployAndSetOpsKlass = poProvider.getInstance().deployAndSetOps;
        const deployerObj = new DeployAndSetOpsKlass();
        deployerResponse = await deployerObj.perform({
          gasPrice: configStrategyHash['OST_UTILITY_GAS_PRICE'],
          baseCurrency: 'OST',
          quoteCurrency: 'USD'
        });
        createdContractAddress = { OST: { USD: deployerResponse['contractAddress'] } };
        updrsp = await ConfigStrategyObj.updateConfigStrategy(createdContractAddress, contractName, oThis.kind);
        if (updrsp) {
          deployerResponse = null; // made null as the promise doesnt contain success message and update is successfull
        }
        break;

      case 'OST_UTILITY_WORKERS_CONTRACT_ADDRESS':
        deployerResponse = await setWorkerObj.perform({
          gasPrice: configStrategyHash.OST_UTILITY_GAS_PRICE,
          chainId: configStrategyHash.OST_UTILITY_CHAIN_ID
        });
        console.log(deployerResponse);
        createdContractAddress = deployerResponse.data['workerContractAddress'];
        updrsp = await ConfigStrategyObj.updateConfigStrategy(createdContractAddress, contractName, oThis.kind);

        break;
      case 'OST_SIMPLE_TOKEN_CONTRACT_ADDR':
        if (!eval(`configStrategyHash.${contractName}`)) {
          performer = openSTPlaform.services.setup.simpleTokenDeploy;
          deployerResponse = await performer.perform();
          createdContractAddress = deployerResponse.data['address'];
          updrsp = await ConfigStrategyObj.updateConfigStrategy(createdContractAddress, contractName, oThis.kind);
        } else {
          return false;
        }
        break;
      case 'OST_SIMPLE_TOKEN_CONTRACT_ADDR_FINALIZE':
        performer = openSTPlaform.services.setup.finalizeSimpleToken;
        deployerResponse = await performer.perform();

        break;

      case 'FUND_USERS_WITH_ST':
        performer = openSTPlaform.services.setup.fundUsersWithST;
        deployerResponse = await performer.perform();

        break;
      case 'OST_VALUE_REGISTRAR_CONTRACT_ADDR':
        if (!eval(`configStrategyHash.${contractName}`)) {
          performer = openSTPlaform.services.setup.deployValueRegistrarContract;
          deployerResponse = await performer.perform();
          createdContractAddress = deployerResponse.data['address'];
          updrsp = await ConfigStrategyObj.updateConfigStrategy(createdContractAddress, contractName, oThis.kind);
        } else {
          return false;
        }
        break;
      case 'OST_OPENSTVALUE_CONTRACT_ADDR':
        if (!eval(`configStrategyHash.${contractName}`)) {
          performer = openSTPlaform.services.setup.openStValueDeployer;
          deployerResponse = await performer.perform();
          createdContractAddress = deployerResponse.data['address'];
          updrsp = await ConfigStrategyObj.updateConfigStrategy(createdContractAddress, contractName, oThis.kind);
        } else {
          return false;
        }
        break;
      case 'SET_VALUE_ADMIN':
        performer = openSTPlaform.services.setup.openStValueDeployerAdminSetter;
        deployerResponse = await performer.perform();
        break;
      default:
        console.log('wrong contract not known to the automation ');
        process.exit(0);
    }
    if (!deployerResponse) {
      return true;
    } else if (deployerResponse.isFailure()) {
      console.error('failed: ', deployerResponse.toHash());
      return false;
    } else {
      if (updrsp) {
        if (contractName === 'OST_STPRIME_CONTRACT_ADDR') {
          if (!updrsp_uuid) {
            return false;
          }
        }
        console.log('update successfull ');
        return true;
      } else {
        return false;
      }
    }
  },

  deployValue: async function() {
    let rsp;
    await oThis.makeStatusFile(valueContractsList, valueStatusFile);
    var file = require(valueStatusFile);
    for (let i = 0; i < valueContractsList.length; i++) {
      if (file[valueContractsList[i]] === 'PENDING' || file[valueContractsList[i]] === 'FAILED') {
        rsp = await oThis.ContractDeployer(valueContractsList[i]);
        if (!rsp) {
          file[valueContractsList[i]] = 'FAILED';
          fs.writeFileSync(utilityStatusFile, JSON.stringify(file));

          return false;
        }
        file[valueContractsList[i]] = 'SUCCESS';
        fs.writeFileSync(valueStatusFile, JSON.stringify(file));
      }
    }
    return true;
  },

  deployUtility: async function() {
    let rsp;
    await oThis.makeStatusFile(utilityContractsList, utilityStatusFile);
    var file = require(utilityStatusFile);

    for (let i = 0; i < utilityContractsList.length; i++) {
      if (file[utilityContractsList[i]] === 'PENDING' || file[utilityContractsList[i]] === 'FAILED') {
        console.log(utilityContractsList[i]);
        rsp = await oThis.ContractDeployer(utilityContractsList[i]);
        if (!rsp) {
          file[utilityContractsList[i]] = 'FAILED';
          fs.writeFileSync(utilityStatusFile, JSON.stringify(file));

          return false;
        }
        file[utilityContractsList[i]] = 'SUCCESS';
        fs.writeFileSync(utilityStatusFile, JSON.stringify(file));
      }
    }
    return true;
  }
};

module.exports = ContractDeploy;

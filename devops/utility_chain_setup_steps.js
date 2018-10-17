rootPrefix = '.';

// create new salt id
// node executables/one_timers/insert_managed_address_salt_id.js
// set in var managed_address_salt_id
managed_address_salt_id = '1';

// set group id
groupId = '1';

modelKlass = require(rootPrefix + '/app/models/config_strategy.js');
byGroupIdHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id.js');

// Insert Dynamo Config

performer = async function(groupId) {
  config_strategy_params = {
    OS_DYNAMODB_SECRET_ACCESS_KEY: 'x',
    OS_DYNAMODB_ACCESS_KEY_ID: 'x',
    OS_DYNAMODB_SSL_ENABLED: '0',
    OS_DYNAMODB_ENDPOINT: 'http://localhost:8001',
    OS_DYNAMODB_API_VERSION: '2012-08-10',
    OS_DYNAMODB_REGION: 'localhost',
    OS_DYNAMODB_LOGGING_ENABLED: '0',
    OS_DYNAMODB_TABLE_NAME_PREFIX: 'd_pk_',
    OS_DYNAMODB_TOKEN_BALANCE_SHARDS_ARRAY: ['d_pk_token_balances_shard_001', 'd_pk_token_balances_shard_002'],
    OS_DYNAMODB_TRANSACTION_LOG_SHARDS_ARRAY: ['d_pk_transaction_logs_shard_001', 'd_pk_transaction_logs_shard_002'],
    OS_DAX_ENABLED: '0'
  };
  helperObj = new byGroupIdHelperKlass(groupId);
  console.log('inserting data');
  insertRsp = await helperObj.addForKind('dynamo', config_strategy_params, managed_address_salt_id);
  if (insertRsp.isFailure()) {
    console.error('insert failed with: ', insertRsp.toHash());
  } else {
    console.log('inserted data in row: ', insertRsp.data);
  }
  modelObj = new modelKlass();
  fetchRsp = await modelObj.getByIds([insertRsp.data]);
  console.log('insertedData: ', JSON.stringify(fetchRsp));
};

performer(groupId);

// Insert DAX Config

performer = async function(groupId) {
  config_strategy_params = {
    OS_DAX_SECRET_ACCESS_KEY: 'x',
    OS_DAX_API_VERSION: '2017-04-19',
    OS_DAX_ACCESS_KEY_ID: 'x',
    OS_DAX_REGION: 'localhost',
    OS_DAX_ENDPOINT: 'http://localhost:188',
    OS_DAX_SSL_ENABLED: '0'
  };
  helperObj = new byGroupIdHelperKlass(groupId);
  console.log('inserting data');
  insertRsp = await helperObj.addForKind('dax', config_strategy_params, managed_address_salt_id);
  if (insertRsp.isFailure()) {
    console.error('insert failed with: ', insertRsp.toHash());
  } else {
    console.log('inserted data in row: ', insertRsp.data);
  }
  modelObj = new modelKlass();
  fetchRsp = await modelObj.getByIds([insertRsp.data]);
  console.log('insertedData: ', JSON.stringify(fetchRsp));
};

performer(1);

// Insert memcached Config

performer = async function(groupId) {
  config_strategy_params = {
    OST_MEMCACHE_SERVERS: '127.0.0.1:11211'
  };
  helperObj = new byGroupIdHelperKlass(groupId);
  console.log('inserting data');
  insertRsp = await helperObj.addForKind('memcached', config_strategy_params, managed_address_salt_id);
  if (insertRsp.isFailure()) {
    console.error('insert failed with: ', insertRsp.toHash());
  } else {
    console.log('inserted data in row: ', insertRsp.data);
  }
  modelObj = new modelKlass();
  fetchRsp = await modelObj.getByIds([insertRsp.data]);
  console.log('insertedData: ', JSON.stringify(fetchRsp));
};

performer(1);

// Insert utility geth Config

performer = async function(groupId) {
  config_strategy_params = {
    OST_UTILITY_GETH_RPC_PROVIDER: 'http://127.0.0.1:9548',
    OST_UTILITY_GETH_RPC_PROVIDERS: ['http://127.0.0.1:9548'],
    OST_UTILITY_GETH_WS_PROVIDER: 'ws://127.0.0.1:19548',
    OST_UTILITY_GETH_WS_PROVIDERS: ['ws://127.0.0.1:19548'],
    OST_UTILITY_CHAIN_ID: 1002,
    OST_UTILITY_CHAIN_TYPE: 'geth'
  };
  helperObj = new byGroupIdHelperKlass(groupId);
  console.log('inserting data');
  insertRsp = await helperObj.addForKind('utility_geth', config_strategy_params, managed_address_salt_id);
  if (insertRsp.isFailure()) {
    console.error('insert failed with: ', insertRsp.toHash());
  } else {
    console.log('inserted data in row: ', insertRsp.data);
  }
  modelObj = new modelKlass();
  fetchRsp = await modelObj.getByIds([insertRsp.data]);
  console.log('insertedData: ', JSON.stringify(fetchRsp));
};

performer(1);

// Insert utility geth constants Config

performer = async function(groupId) {
  config_strategy_params = {
    OST_UTILITY_CHAIN_OWNER_PASSPHRASE: 'testtest',
    OST_UTILITY_INITIAL_ST_PRIME_HOLDER_PASSPHRASE: 'testtest',
    OST_UTILITY_REGISTRAR_PASSPHRASE: 'testtest',
    OST_UTILITY_DEPLOYER_PASSPHRASE: 'testtest',
    OST_UTILITY_OPS_PASSPHRASE: 'testtest',
    OST_UTILITY_ADMIN_PASSPHRASE: 'testtest',
    OST_UTILITY_GAS_PRICE: '0x3B9ACA00',
    OST_OPENSTUTILITY_ST_PRIME_UUID: '',
    OST_UTILITY_CHAIN_OWNER_ADDR: '0x616F76d7e749a68b24f5449bcA520f30CA0F7Aa6',
    OST_UTILITY_INITIAL_ST_PRIME_HOLDER_ADDR: '0x6a1acfc350146662ca1c2068beedb3c9207c5fe8',
    OST_UTILITY_REGISTRAR_ADDR: '0x9d874cd442d71A99Bc8f54BD2fB2D85cbC3C1BDa',
    OST_OPENSTUTILITY_CONTRACT_ADDR: '',
    OST_UTILITY_REGISTRAR_CONTRACT_ADDR: '',
    OST_UTILITY_DEPLOYER_ADDR: '0xeB85d9fE123A76Bd01d78a0C3F103216a56cbA33',
    OST_UTILITY_OPS_ADDR: '0x212BfDb84298B5F3C343E7eef57bf8Eabd6020Dc',
    OST_UTILITY_ADMIN_ADDR: '0x6C69aAC3B4Ce7a296C5F10494Db81703DD97137C',
    OST_STPRIME_CONTRACT_ADDR: '',
    OST_UTILITY_PRICE_ORACLES: {
      OST: {
        USD: ''
      }
    },
    OST_UTILITY_WORKERS_CONTRACT_ADDRESS: '',
    OST_VALUE_CORE_CONTRACT_ADDR: ''
  };
  helperObj = new byGroupIdHelperKlass(groupId);
  console.log('inserting data');
  insertRsp = await helperObj.addForKind('utility_constants', config_strategy_params, managed_address_salt_id);
  if (insertRsp.isFailure()) {
    console.error('insert failed with: ', insertRsp.toHash());
  } else {
    console.log('inserted data in row: ', insertRsp.data);
  }
  modelObj = new modelKlass();
  fetchRsp = await modelObj.getByIds([insertRsp.data]);
  console.log('insertedData: ', JSON.stringify(fetchRsp));
};

performer(1);

// Insert autoscaling constants Config

performer = async function(groupId) {
  config_strategy_params = {
    OS_AUTOSCALING_SECRET_ACCESS_KEY: 'x',
    OS_AUTOSCALING_API_VERSION: '2016-02-06',
    OS_AUTOSCALING_ACCESS_KEY_ID: 'x',
    OS_AUTOSCALING_REGION: 'localhost',
    OS_AUTOSCALING_ENDPOINT: 'http://localhost:8001',
    OS_AUTOSCALING_SSL_ENABLED: '0',
    OS_AUTOSCALING_LOGGING_ENABLED: '0',
    AUTO_SCALE_DYNAMO: '0',
    OS_DYNAMODB_TABLE_NAME_PREFIX: 'd_pk_'
  };
  helperObj = new byGroupIdHelperKlass(groupId);
  console.log('inserting data');
  insertRsp = await helperObj.addForKind('autoscaling', config_strategy_params, managed_address_salt_id);
  if (insertRsp.isFailure()) {
    console.error('insert failed with: ', insertRsp.toHash());
  } else {
    console.log('inserted data in row: ', insertRsp.data);
  }
  modelObj = new modelKlass();
  fetchRsp = await modelObj.getByIds([insertRsp.data]);
  console.log('insertedData: ', JSON.stringify(fetchRsp));
};

performer(1);

// Insert ES constants Config

performer = async function(groupId) {
  config_strategy_params = {
    AWS_ES_SECRET_KEY: '<na>',
    CR_ES_HOST: 'http://localhost:9201',
    AWS_ES_ACCESS_KEY: '<na>',
    AWS_ES_REGION: 'us-east-1'
  };
  helperObj = new byGroupIdHelperKlass(groupId);
  console.log('inserting data');
  insertRsp = await helperObj.addForKind('es', config_strategy_params, managed_address_salt_id);
  if (insertRsp.isFailure()) {
    console.error('insert failed with: ', insertRsp.toHash());
  } else {
    console.log('inserted data in row: ', insertRsp.data);
  }
  modelObj = new modelKlass();
  fetchRsp = await modelObj.getByIds([insertRsp.data]);
  console.log('insertedData: ', JSON.stringify(fetchRsp));
};

performer(1);

// Insert redis constants Config

performer = async function(groupId) {
  config_strategy_params = {
    OST_REDIS_HOST: '127.0.0.1',
    OST_REDIS_PORT: '6379',
    OST_REDIS_TLS_ENABLED: '0',
    OST_REDIS_PASS: 'st123'
  };
  helperObj = new byGroupIdHelperKlass(groupId);
  console.log('inserting data');
  insertRsp = await helperObj.addForKind('redis', config_strategy_params, managed_address_salt_id);
  if (insertRsp.isFailure()) {
    console.error('insert failed with: ', insertRsp.toHash());
  } else {
    console.log('inserted data in row: ', insertRsp.data);
  }
  modelObj = new modelKlass();
  fetchRsp = await modelObj.getByIds([insertRsp.data]);
  console.log('insertedData: ', JSON.stringify(fetchRsp));
};

performer(1);

/* 1.
 ***** DynamoDB migrations *****
    cd /mnt/st-company/apps/saasApi/current
    node executables/create_init_shards.js 2
*/

// Set ENV var of UC Gas Price to 0
// export OST_UTILITY_GAS_PRICE=0x0

/* 4.
 ***** Deploy Utility Contracts  *****
*/
rootPrefix = '.';
//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

performer = async function(groupId) {
  byGroupIdHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id.js');
  obj = new byGroupIdHelperKlass(groupId);
  configStrategyRsp = await obj.getCompleteHash();
  InstanceComposer = require(rootPrefix + '/instance_composer');
  configStrategyHash = configStrategyRsp.data;
  console.log('configStrategyHash', configStrategyHash);
  instanceComposer = new InstanceComposer(configStrategyHash);
  require(rootPrefix + '/lib/providers/platform');
  platformProvider = instanceComposer.getPlatformProvider();
  openSTPlaform = platformProvider.getInstance();
  performer = openSTPlaform.services.setup.utilityRegistrarDeployer;
  rsp = await performer.perform();
  if (rsp.isFailure()) {
    console.error('failed: ', rsp.toHash());
    return Promise.resolve(rsp);
  } else {
    utilityRegistrarContractAddr = rsp.data['address'];
    configStrategyRsp = await obj.getForKind('utility_constants');
    if (configStrategyRsp.isFailure()) {
      console.error('configStrategyRsp: ', configStrategyRsp.toHash());
      return Promise.resolve(configStrategyRsp);
    } else {
      existingData = configStrategyRsp.data[Object.keys(configStrategyRsp.data)[0]];
      toBeUpdatedData = JSON.parse(JSON.stringify(existingData));
      toBeUpdatedData['OST_UTILITY_REGISTRAR_CONTRACT_ADDR'] = utilityRegistrarContractAddr;
      console.log('would update to', toBeUpdatedData);
      updateRsp = await new byGroupIdHelperKlass(groupId).updateForKind(
        'utility_constants',
        toBeUpdatedData,
        existingData
      );
      if (updateRsp.isFailure()) {
        console.error('updateRsp: ', updateRsp.toHash());
      }
      return Promise.resolve(updateRsp);
    }
  }
};

performer(1)
  .then(function(rsp) {
    console.log(rsp);
    process.exit(0);
  })
  .catch(function(rsp) {
    console.error(rsp);
    process.exit(0);
  });

//Update OST_UTILITY_REGISTRAR_CONTRACT_ADDR in config strategy file

/*5   openStUtilityDeployer contract


*/

rootPrefix = '.';
//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

performer = async function(groupId) {
  byGroupIdHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id.js');
  obj = new byGroupIdHelperKlass(groupId);
  configStrategyRsp = await obj.getCompleteHash();
  InstanceComposer = require(rootPrefix + '/instance_composer');
  configStrategyHash = configStrategyRsp.data;
  console.log('configStrategyHash', configStrategyHash);
  instanceComposer = new InstanceComposer(configStrategyHash);
  require(rootPrefix + '/lib/providers/platform');
  platformProvider = instanceComposer.getPlatformProvider();
  openSTPlaform = platformProvider.getInstance();
  performer = openSTPlaform.services.setup.openStUtilityDeployer;
  rsp = await performer.perform();
  if (rsp.isFailure()) {
    console.error('failed: ', rsp.toHash());
    return Promise.resolve(rsp);
  } else {
    console.log('deployment rsp: ', rsp.data);
    openSTUtilityContractAddr = rsp.data['address'];
    configStrategyRsp = await obj.getForKind('utility_constants');
    if (configStrategyRsp.isFailure()) {
      console.error('configStrategyRsp: ', configStrategyRsp.toHash());
      return Promise.resolve(configStrategyRsp);
    } else {
      existingData = configStrategyRsp.data[Object.keys(configStrategyRsp.data)[0]];
      toBeUpdatedData = JSON.parse(JSON.stringify(existingData));
      toBeUpdatedData['OST_OPENSTUTILITY_CONTRACT_ADDR'] = openSTUtilityContractAddr;
      console.log('would update to', toBeUpdatedData);
      updateRsp = await new byGroupIdHelperKlass(groupId).updateForKind(
        'utility_constants',
        toBeUpdatedData,
        existingData
      );
      if (updateRsp.isFailure()) {
        console.error('updateRsp: ', updateRsp.toHash());
      }
      return Promise.resolve(updateRsp);
    }
  }
};

performer(1)
  .then(function(rsp) {
    console.log(rsp);
    process.exit(0);
  })
  .catch(function(rsp) {
    console.error(rsp);
    process.exit(0);
  });

//Update OST_OPENSTUTILITY_CONTRACT_ADDR in config strategy file

/*6
* Value core contract deploy
* */

rootPrefix = '.';
//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

performer = async function(groupId) {
  byGroupIdHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id.js');
  obj = new byGroupIdHelperKlass(groupId);
  configStrategyRsp = await obj.getCompleteHash();
  InstanceComposer = require(rootPrefix + '/instance_composer');
  configStrategyHash = configStrategyRsp.data;
  console.log('configStrategyHash', configStrategyHash);
  instanceComposer = new InstanceComposer(configStrategyHash);
  require(rootPrefix + '/lib/providers/platform');
  platformProvider = instanceComposer.getPlatformProvider();
  openSTPlaform = platformProvider.getInstance();
  performer = openSTPlaform.services.setup.valueCoreDeployer;
  rsp = await performer.perform();
  if (rsp.isFailure()) {
    console.error('failed: ', rsp.toHash());
    return Promise.resolve(rsp);
  } else {
    console.log('deployment rsp: ', rsp.data);
    valueCoreContractAddr = rsp.data['address'];
    configStrategyRsp = await obj.getForKind('utility_constants');
    if (configStrategyRsp.isFailure()) {
      console.error('configStrategyRsp: ', configStrategyRsp.toHash());
      return Promise.resolve(configStrategyRsp);
    } else {
      existingData = configStrategyRsp.data[Object.keys(configStrategyRsp.data)[0]];
      toBeUpdatedData = JSON.parse(JSON.stringify(existingData));
      toBeUpdatedData['OST_VALUE_CORE_CONTRACT_ADDR'] = valueCoreContractAddr;
      console.log('would update to', toBeUpdatedData);
      updateRsp = await new byGroupIdHelperKlass(groupId).updateForKind(
        'utility_constants',
        toBeUpdatedData,
        existingData
      );
      if (updateRsp.isFailure()) {
        console.error('updateRsp: ', updateRsp.toHash());
      }
      return Promise.resolve(updateRsp);
    }
  }
};

performer(1)
  .then(function(rsp) {
    console.log(rsp);
    process.exit(0);
  })
  .catch(function(rsp) {
    console.error(rsp);
    process.exit(0);
  });

//Update value core contract address OST_VALUE_CORE_CONTRACT_ADDR

// stPrimeDeployer address in env
// OST_UTILITY_INITIAL_ST_PRIME_HOLDER_ADDR

rootPrefix = '.';
//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

performer = async function(groupId) {
  byGroupIdHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id.js');
  obj = new byGroupIdHelperKlass(groupId);
  configStrategyRsp = await obj.getCompleteHash();
  InstanceComposer = require(rootPrefix + '/instance_composer');
  configStrategyHash = configStrategyRsp.data;
  console.log('configStrategyHash', configStrategyHash);
  instanceComposer = new InstanceComposer(configStrategyHash);
  require(rootPrefix + '/lib/providers/platform');
  platformProvider = instanceComposer.getPlatformProvider();
  openSTPlaform = platformProvider.getInstance();
  performer = openSTPlaform.services.setup.stPrimeDeployer;
  rsp = await performer.perform();
  if (rsp.isFailure()) {
    console.error('failed: ', rsp.toHash());
    return Promise.resolve(rsp);
  } else {
    console.log('deployment rsp: ', rsp.data);
    stPrimeContractAddr = rsp.data['address'];
    stPrimeUUID = rsp.data['uuid'];
    configStrategyRsp = await obj.getForKind('utility_constants');
    if (configStrategyRsp.isFailure()) {
      console.error('configStrategyRsp: ', configStrategyRsp.toHash());
      return Promise.resolve(configStrategyRsp);
    } else {
      existingData = configStrategyRsp.data[Object.keys(configStrategyRsp.data)[0]];
      toBeUpdatedData = JSON.parse(JSON.stringify(existingData));
      toBeUpdatedData['OST_STPRIME_CONTRACT_ADDR'] = stPrimeContractAddr;
      toBeUpdatedData['OST_OPENSTUTILITY_ST_PRIME_UUID'] = stPrimeUUID;
      console.log('would update to', toBeUpdatedData);
      updateRsp = await new byGroupIdHelperKlass(groupId).updateForKind(
        'utility_constants',
        toBeUpdatedData,
        existingData
      );
      if (updateRsp.isFailure()) {
        console.error('updateRsp: ', updateRsp.toHash());
      }
      return Promise.resolve(updateRsp);
    }
  }
};

performer(1)
  .then(function(rsp) {
    console.log(rsp);
    process.exit(0);
  })
  .catch(function(rsp) {
    console.error(rsp);
    process.exit(0);
  });

// update OST_OPENSTUTILITY_ST_PRIME_UUID & OST_STPRIME_CONTRACT_ADDR

rootPrefix = '.';
//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

performer = async function(groupId) {
  byGroupIdHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id.js');
  obj = new byGroupIdHelperKlass(groupId);
  configStrategyRsp = await obj.getCompleteHash();
  InstanceComposer = require(rootPrefix + '/instance_composer');
  configStrategyHash = configStrategyRsp.data;
  console.log('configStrategyHash', configStrategyHash);
  instanceComposer = new InstanceComposer(configStrategyHash);
  require(rootPrefix + '/lib/providers/platform');
  platformProvider = instanceComposer.getPlatformProvider();
  openSTPlaform = platformProvider.getInstance();
  performer = openSTPlaform.services.setup.registerSTPrime;
  rsp = await performer.perform();
  return Promise.resolve(rsp);
};

performer(1)
  .then(function(rsp) {
    console.log(rsp);
    process.exit(0);
  })
  .catch(function(rsp) {
    console.error(rsp);
    process.exit(0);
  });

// Foundation side
// touch /mnt/st-foundation/apps/saasApi/shared/stake_and_mint.json
// echo '{"lastProcessedBlock":1, "lastProcessedTransactionIndex":14916}' > /mnt/st-foundation/apps/saasApi/shared/stake_and_mint.json

// touch /mnt/st-foundation/apps/saasApi/shared/register_branded_token.json
// echo '{"lastProcessedBlock":1,"lastProcessedTransactionIndex":265}' > /mnt/st-foundation/apps/saasApi/shared/register_branded_token.json

// Company side
// touch /mnt/st-company/apps/saasApi/shared/stake_and_mint_processor.json
// echo '{"lastProcessedBlock":1,"lastProcessedTransactionIndex":265}' > /mnt/st-company/apps/saasApi/shared/stake_and_mint_processor.json

// Start intercoms on both company and foundation after making utility  gas price 0

/* Stake and mint*/

rootPrefix = '.';
//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

performer = async function(groupId) {
  byGroupIdHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id.js');
  obj = new byGroupIdHelperKlass(groupId);
  configStrategyRsp = await obj.getCompleteHash();
  InstanceComposer = require(rootPrefix + '/instance_composer');
  configStrategyHash = configStrategyRsp.data;
  console.log('configStrategyHash', configStrategyHash);
  instanceComposer = new InstanceComposer(configStrategyHash);
  require(rootPrefix + '/lib/providers/platform');
  platformProvider = instanceComposer.getPlatformProvider();
  openSTPlaform = platformProvider.getInstance();
  performer = openSTPlaform.services.setup.stPrimeMinter;
  rsp = await performer.perform();
  console.log('rsp: ', rsp.toHash());
  return Promise.resolve(rsp);
};

performer(1)
  .then(function(rsp) {
    console.log(rsp);
    process.exit(0);
  })
  .catch(function(rsp) {
    console.error(rsp);
    process.exit(0);
  });

// CHeck Balance of UTILITY_CHAIN_OWNER should have 10000 ST prime after the transaction is successfull

// fund users with St Prime

rootPrefix = '.';
//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

performer = async function(groupId) {
  byGroupIdHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id.js');
  obj = new byGroupIdHelperKlass(groupId);
  configStrategyRsp = await obj.getCompleteHash();
  InstanceComposer = require(rootPrefix + '/instance_composer');
  configStrategyHash = configStrategyRsp.data;
  console.log('configStrategyHash', configStrategyHash);
  instanceComposer = new InstanceComposer(configStrategyHash);
  require(rootPrefix + '/lib/providers/platform');
  platformProvider = instanceComposer.getPlatformProvider();
  openSTPlaform = platformProvider.getInstance();
  performer = openSTPlaform.services.setup.fundUsersWithSTPrime;
  rsp = await performer.perform();
  console.log('rsp: ', rsp);
  return Promise.resolve(rsp);
};

performer(1)
  .then(function(rsp) {
    console.log(rsp);
    process.exit(0);
  })
  .catch(function(rsp) {
    console.error(rsp);
    process.exit(0);
  });

// Remove Zero UC Gas

// Setup Price Oracle
// node tools/setup/price-oracle/deploy.js [groupId]

// Setup Workers Contract
// node tools/setup/payments/set_worker.js [groupId]

// Activate Group
performer = async function(groupId) {
  byGroupIdHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id.js');
  obj = new byGroupIdHelperKlass(groupId);
  rsp = await obj.activate();
  console.log('rsp: ', rsp.toHash());
  return Promise.resolve(rsp);
};

performer(groupId)
  .then(function(rsp) {
    console.log(rsp);
    process.exit(0);
  })
  .catch(function(rsp) {
    console.error(rsp);
    process.exit(0);
  });

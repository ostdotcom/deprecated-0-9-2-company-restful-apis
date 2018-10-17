// ================================================================================================================

//2. Set utility gas price as "0" during setup.
//   export OST_UTILITY_GAS_PRICE='0x0'

// ================================================================================================================

//3. Create salt

rootPrefix = '.';

// create new salt id
// node executables/one_timers/insert_managed_address_salt_id.js
// set in var managed_address_salt_id
managed_address_salt_id = '60296';

// 4. create internal addresses

performer = async function() {
  rootPrefix = '.';
  require(rootPrefix + '/tools/setup/platform/generate_internal_addresses.js');
  InstanceComposer = require(rootPrefix + '/instance_composer');
  instanceComposer = new InstanceComposer({});

  generateInternalAddressesKlass = instanceComposer.getGenerateInternalAddressesClass();
  generateInternalAddressesObj = new generateInternalAddressesKlass({ addresses_count: 15 });
  let addressesArr = await generateInternalAddressesObj.perform();

  addresses_to_generate = [
    'OST_UTILITY_CHAIN_OWNER',
    'OST_STAKER',
    'OST_REDEEMER',
    'OST_UTILITY_DEPLOYER',
    'OST_UTILITY_OPS',
    'OST_VALUE_DEPLOYER',
    'OST_VALUE_OPS',
    'OST_FOUNDATION',
    'OST_VALUE_REGISTRAR',
    'OST_UTILITY_REGISTRAR',
    'OST_VALUE_ADMIN_ADDR',
    'OST_UTILITY_ADMIN_ADDR'
  ];

  for (let i = 0; i < addresses_to_generate.length; i++) {
    console.log('"%s_ADDR": "\'%s\'",', addresses_to_generate[i], addressesArr[i].address);
    console.log('"%s_PASSPHRASE": "\'<na>\'",', addresses_to_generate[i]);
    process.env[addresses_to_generate[i] + '_ADDR'] = addressesArr[i].address;
  }
};

performer();

// 5. create config strategies

modelKlass = require(rootPrefix + '/app/models/config_strategy.js');
byGroupIdHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id.js');

performer = async function() {
  config_strategy_params = { OST_INMEMORY_CACHE_NAMESPACE: 'd_pk_' };
  helperObj = new byGroupIdHelperKlass();
  console.log('inserting data');
  insertRsp = await helperObj.addForKind('in_memory', config_strategy_params, managed_address_salt_id);
  if (insertRsp.isFailure()) {
    console.error('insert failed with: ', insertRsp.toHash());
  } else {
    console.log('inserted data in row: ');
  }
};

performer();

performer = async function() {
  config_strategy_params = {
    OST_STAKER_ADDR: '0x49F6A23D93e49Cd82A987834bC8178B7d7b1cca5',
    OST_STAKER_PASSPHRASE: '<na>',
    OST_REDEEMER_ADDR: '0xACeE8Fe40E429B8374e2606967fbc91C2eB62117',
    OST_REDEEMER_PASSPHRASE: '<na>',
    OST_CACHING_ENGINE: 'memcached',
    OST_DEFAULT_TTL: 2000000,
    OST_CACHE_CONSISTENT_BEHAVIOR: '0',
    OST_STANDALONE_MODE: 0
  };
  helperObj = new byGroupIdHelperKlass();
  console.log('inserting data');
  insertRsp = await helperObj.addForKind('constants', config_strategy_params, managed_address_salt_id);
  if (insertRsp.isFailure()) {
    console.error('insert failed with: ', insertRsp.toHash());
  } else {
    console.log('inserted data in row: ');
  }
};

performer();

performer = async function() {
  config_strategy_params = {
    OST_VALUE_GAS_PRICE: '0x174876E800',
    OST_VALUE_REGISTRAR_ADDR: '0xA391f49397951fE0c884e5457C26D23cc8A12471',
    OST_VALUE_REGISTRAR_PASSPHRASE: '<na>',
    OST_VALUE_DEPLOYER_ADDR: '0x284257106707bd0b83d5e2298659be88984De08C',
    OST_VALUE_DEPLOYER_PASSPHRASE: '<na>',
    OST_VALUE_OPS_ADDR: '0xE174b0dEf3987016FdeEca031d12414D2B1512FA',
    OST_VALUE_OPS_PASSPHRASE: '<na>',
    OST_FOUNDATION_ADDR: '0x23B7EF64ACbf20F3b38c44c25e735907E0afcF1e',
    OST_FOUNDATION_PASSPHRASE: '<na>',
    OST_VALUE_ADMIN_ADDR: '0x40A0d9E6480f3342B7E8f097c144B5f2b2EA11ad',
    OST_VALUE_ADMIN_PASSPHRASE: '<na>',

    OST_VALUE_REGISTRAR_CONTRACT_ADDR: '',
    OST_OPENSTVALUE_CONTRACT_ADDR: '',
    OST_SIMPLE_TOKEN_CONTRACT_ADDR: ''
  };
  helperObj = new byGroupIdHelperKlass();
  console.log('inserting data');
  insertRsp = await helperObj.addForKind('value_constants', config_strategy_params, managed_address_salt_id);
  if (insertRsp.isFailure()) {
    console.error('insert failed with: ', insertRsp.toHash());
  } else {
    console.log('inserted data in row: ');
  }
};

performer();

performer = async function() {
  config_strategy_params = {
    OST_VALUE_GETH_RPC_PROVIDER: 'http://127.0.0.1:8545',
    OST_VALUE_GETH_RPC_PROVIDERS: ['http://127.0.0.1:8545'],
    OST_VALUE_GETH_WS_PROVIDER: 'ws://127.0.0.1:8546',
    OST_VALUE_GETH_WS_PROVIDERS: ['ws://127.0.0.1:8546'],
    OST_VALUE_CHAIN_ID: 2001,
    OST_VALUE_CHAIN_TYPE: 'parity'
  };
  helperObj = new byGroupIdHelperKlass();
  console.log('inserting data');
  insertRsp = await helperObj.addForKind('value_geth', config_strategy_params, managed_address_salt_id);
  if (insertRsp.isFailure()) {
    console.error('insert failed with: ', insertRsp.toHash());
  } else {
    console.log('inserted data in row: ');
  }
};

performer();

// ================================================================================================================

// Fund ETH to addresses (manually for now)

// 6. Deploy and Finalize Simple Token Contract and update ENV

rootPrefix = '.';
//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

performer = async function() {
  byGroupIdHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id.js');
  obj = new byGroupIdHelperKlass();
  configStrategyRsp = await obj.get();
  InstanceComposer = require(rootPrefix + '/instance_composer');
  configStrategyHash = configStrategyRsp.data;
  console.log('configStrategyHash', configStrategyHash);
  instanceComposer = new InstanceComposer(configStrategyHash);
  require(rootPrefix + '/lib/providers/platform');
  platformProvider = instanceComposer.getPlatformProvider();
  openSTPlaform = platformProvider.getInstance();
  performer = openSTPlaform.services.setup.simpleTokenDeploy;
  rsp = await performer.perform();
  if (rsp.isFailure()) {
    console.error('failed: ', rsp.toHash());
    return Promise.resolve(rsp);
  } else {
    simpleTokenContractAddr = rsp.data['address'];
    configStrategyRsp = await obj.getForKind('value_constants');
    if (configStrategyRsp.isFailure()) {
      console.error('configStrategyRsp: ', configStrategyRsp.toHash());
      return Promise.resolve(configStrategyRsp);
    } else {
      existingData = configStrategyRsp.data[Object.keys(configStrategyRsp.data)[0]];
      toBeUpdatedData = JSON.parse(JSON.stringify(existingData));
      toBeUpdatedData['OST_SIMPLE_TOKEN_CONTRACT_ADDR'] = simpleTokenContractAddr;
      console.log('would update to', toBeUpdatedData);
      updateRsp = await new byGroupIdHelperKlass().updateForKind('value_constants', toBeUpdatedData, existingData);
      if (updateRsp.isFailure()) {
        console.error('updateRsp: ', updateRsp.toHash());
      }
      return Promise.resolve(updateRsp);
    }
  }
};

performer()
  .then(function(rsp) {
    console.log(rsp);
    process.exit(0);
  })
  .catch(function(rsp) {
    console.error(rsp);
    process.exit(0);
  });

//Finalize ST contract
rootPrefix = '.';
//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

performer = async function() {
  byGroupIdHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id.js');
  obj = new byGroupIdHelperKlass();
  configStrategyRsp = await obj.get();
  InstanceComposer = require(rootPrefix + '/instance_composer');
  configStrategyHash = configStrategyRsp.data;
  console.log('configStrategyHash', configStrategyHash);
  instanceComposer = new InstanceComposer(configStrategyHash);
  require(rootPrefix + '/lib/providers/platform');
  platformProvider = instanceComposer.getPlatformProvider();
  openSTPlaform = platformProvider.getInstance();

  performer = openSTPlaform.services.setup.finalizeSimpleToken;
  performer
    .perform()
    .then(console.log)
    .catch(console.log);
};

performer()
  .then(function(rsp) {
    console.log(rsp);
    process.exit(0);
  })
  .catch(function(rsp) {
    console.error(rsp);
    process.exit(0);
  });

// ================================================================================================================

// 7. Fund required addresses with ST

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

  performer = openSTPlaform.services.setup.fundUsersWithST;
  performer
    .perform()
    .then(console.log)
    .catch(console.log);
};

performer(groupId);

// ================================================================================================================

// 8. Deploy Value Registrar Contract and update ENV

rootPrefix = '.';
//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

performer = async function() {
  byGroupIdHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id.js');
  obj = new byGroupIdHelperKlass();
  configStrategyRsp = await obj.get();
  InstanceComposer = require(rootPrefix + '/instance_composer');
  configStrategyHash = configStrategyRsp.data;
  console.log('configStrategyHash', configStrategyHash);
  instanceComposer = new InstanceComposer(configStrategyHash);
  require(rootPrefix + '/lib/providers/platform');
  platformProvider = instanceComposer.getPlatformProvider();
  openSTPlaform = platformProvider.getInstance();
  performer = openSTPlaform.services.setup.deployValueRegistrarContract;
  rsp = await performer.perform();
  if (rsp.isFailure()) {
    console.error('failed: ', rsp.toHash());
    return Promise.resolve(rsp);
  } else {
    valueRegistrarContractAddr = rsp.data['address'];
    configStrategyRsp = await obj.getForKind('value_constants');
    if (configStrategyRsp.isFailure()) {
      console.error('configStrategyRsp: ', configStrategyRsp.toHash());
      return Promise.resolve(configStrategyRsp);
    } else {
      existingData = configStrategyRsp.data[Object.keys(configStrategyRsp.data)[0]];
      toBeUpdatedData = JSON.parse(JSON.stringify(existingData));
      toBeUpdatedData['OST_VALUE_REGISTRAR_CONTRACT_ADDR'] = valueRegistrarContractAddr;
      console.log('would update to', toBeUpdatedData);
      updateRsp = await new byGroupIdHelperKlass().updateForKind('value_constants', toBeUpdatedData, existingData);
      if (updateRsp.isFailure()) {
        console.error('updateRsp: ', updateRsp.toHash());
      }
      return Promise.resolve(updateRsp);
    }
  }
};

performer()
  .then(function(rsp) {
    console.log(rsp);
    process.exit(0);
  })
  .catch(function(rsp) {
    console.error(rsp);
    process.exit(0);
  });

// ================================================================================================================

// 9. Deploy OpenST Value Contract and update ENV

rootPrefix = '.';
//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

performer = async function() {
  byGroupIdHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id.js');
  obj = new byGroupIdHelperKlass();
  configStrategyRsp = await obj.get();
  InstanceComposer = require(rootPrefix + '/instance_composer');
  configStrategyHash = configStrategyRsp.data;
  console.log('configStrategyHash', configStrategyHash);
  instanceComposer = new InstanceComposer(configStrategyHash);
  require(rootPrefix + '/lib/providers/platform');
  platformProvider = instanceComposer.getPlatformProvider();
  openSTPlaform = platformProvider.getInstance();
  performer = openSTPlaform.services.setup.openStValueDeployer;
  rsp = await performer.perform();
  if (rsp.isFailure()) {
    console.error('failed: ', rsp.toHash());
    return Promise.resolve(rsp);
  } else {
    openstValueContractAddr = rsp.data['address'];
    configStrategyRsp = await obj.getForKind('value_constants');
    if (configStrategyRsp.isFailure()) {
      console.error('configStrategyRsp: ', configStrategyRsp.toHash());
      return Promise.resolve(configStrategyRsp);
    } else {
      existingData = configStrategyRsp.data[Object.keys(configStrategyRsp.data)[0]];
      toBeUpdatedData = JSON.parse(JSON.stringify(existingData));
      toBeUpdatedData['OST_OPENSTVALUE_CONTRACT_ADDR'] = openstValueContractAddr;
      console.log('would update to', toBeUpdatedData);
      updateRsp = await new byGroupIdHelperKlass().updateForKind('value_constants', toBeUpdatedData, existingData);
      if (updateRsp.isFailure()) {
        console.error('updateRsp: ', updateRsp.toHash());
      }
      return Promise.resolve(updateRsp);
    }
  }
};

performer()
  .then(function(rsp) {
    console.log(rsp);
    process.exit(0);
  })
  .catch(function(rsp) {
    console.error(rsp);
    process.exit(0);
  });

// ================================================================================================================

// 10. Set Admin address for openST Value

rootPrefix = '.';
//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

performer = async function() {
  byGroupIdHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_group_id.js');
  obj = new byGroupIdHelperKlass();
  configStrategyRsp = await obj.get();
  InstanceComposer = require(rootPrefix + '/instance_composer');
  configStrategyHash = configStrategyRsp.data;
  console.log('configStrategyHash', configStrategyHash);
  instanceComposer = new InstanceComposer(configStrategyHash);
  require(rootPrefix + '/lib/providers/platform');
  platformProvider = instanceComposer.getPlatformProvider();
  openSTPlaform = platformProvider.getInstance();

  performer = openSTPlaform.services.setup.openStValueDeployerAdminSetter;
  performer
    .perform()
    .then(console.log)
    .catch(console.log);
};

performer();

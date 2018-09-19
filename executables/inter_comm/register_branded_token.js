'use strict';

/**
 * This executable / script is intermediate communicator between value chain and utility chain used for the registering branded token.
 *
 * It listens to the ProposedBrandedToken event emitted by proposeBrandedToken method of openSTUtility contract.
 * On getting this event, it calls registerBrandedToken method of utilityRegistrar contract followed
 * by calling registerUtilityToken method of valueRegistrar contract.
 *
 * Usage: node executables/inter_comm/register_branded_token.js filePath group_id
 *
 * Command Line Parameters Description:
 * filePath: file path for last ProcessedBlock and last Processed Transaction Index.
 * group_id: group_id for fetching config strategy
 *
 * Example: node executables/inter_comm/register_branded_token.js $HOME/openst-setup/logs/register_branded_token.data ~/config.json
 *
 * @module executables/inter_comm/register_branded_token
 */

const rootPrefix = '../..';
//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

require(rootPrefix + '/lib/providers/platform');

const InstanceComposer = require(rootPrefix + '/instance_composer'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

const usageDemo = function() {
  logger.log('usage:', 'node ./executables/inter_comm/register_branded_token.js blockNoFilePath group_id');
  logger.log('* blockNoFilePath is the file path for last ProcessedBlock and last Processed Transaction Index.');
  logger.log('* group should be passed to fetch config strategy');
};

const args = process.argv,
  filePath = args[2].trim(),
  group_id = args[3];

let configStrategy = {};

const validateAndSanitize = function() {
  if (args.length < 4) {
    logger.error('Invalid arguments !!!');
    usageDemo();
    process.exit(1);
  }

  if (!filePath) {
    logger.error('filePath Not Found!!');
    process.exit(1);
  }

  if (!group_id) {
    logger.error('group_id Not Found!!');
    process.exit(1);
  }
};

// validate and sanitize the input params
validateAndSanitize();

process.on('uncaughtException', function(args) {
  logger.error('Received uncaughtException', args);
  setTimeout(function() {
    process.exit(1);
  }, 60000);
});

const StartIntercomm = function() {
  const oThis = this;
};

StartIntercomm.prototype = {
  perform: async function() {
    const oThis = this,
      strategyByGroupHelperObj = new StrategyByGroupHelper(group_id),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash(),
      configStrategy = configStrategyResp.data,
      ic = new InstanceComposer(configStrategy),
      platformProvider = ic.getPlatformProvider(),
      openStPlatform = platformProvider.getInstance(),
      RegisterBrandedTokenInterComm = openStPlatform.services.interComm.registerBrandedToken;

    const registerBrandedTokenInterCommObj = new RegisterBrandedTokenInterComm({ file_path: filePath });
    registerBrandedTokenInterCommObj.registerInterruptSignalHandlers();
    registerBrandedTokenInterCommObj.init();
    logger.win('InterComm Script for Register Branded Token initiated.');
  }
};

let startIntercomm = new StartIntercomm();

startIntercomm.perform().then(function(r) {
  process.exit(0);
});

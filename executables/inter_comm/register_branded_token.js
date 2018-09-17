'use strict';

/**
 * This executable / script is intermediate communicator between value chain and utility chain used for the registering branded token.
 *
 * It listens to the ProposedBrandedToken event emitted by proposeBrandedToken method of openSTUtility contract.
 * On getting this event, it calls registerBrandedToken method of utilityRegistrar contract followed
 * by calling registerUtilityToken method of valueRegistrar contract.
 *
 * Usage: node executables/inter_comm/register_branded_token.js filePath configStrategyFilePath
 *
 * Command Line Parameters Description:
 * filePath: file path for last ProcessedBlock and last Processed Transaction Index.
 * configStrategyFilePath: path to the file which is storing the config strategy info.
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
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

const usageDemo = function() {
  logger.log(
    'usage:',
    'node ./executables/inter_comm/register_branded_token.js blockNoFilePath configStrategyFilePath'
  );
  logger.log('* blockNoFilePath is the file path for last ProcessedBlock and last Processed Transaction Index.');
  logger.log('* configStrategyFilePath is the path to the file which is storing the config strategy info.');
};

const args = process.argv,
  filePath = args[2].trim(),
  configStrategyFilePath = args[3].trim();

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

  if (!configStrategyFilePath) {
    logger.error('configStrategyFilePath Not Found!!');
    process.exit(1);
  }

  configStrategy = require(configStrategyFilePath);
};

// validate and sanitize the input params
validateAndSanitize();

const ic = new InstanceComposer(configStrategy),
  platformProvider = ic.getPlatformProvider(),
  openStPlatform = platformProvider.getInstance(),
  RegisterBrandedTokenInterComm = openStPlatform.services.interComm.registerBrandedToken;

const registerBrandedTokenInterCommObj = new RegisterBrandedTokenInterComm({ file_path: filePath });
registerBrandedTokenInterCommObj.registerInterruptSignalHandlers();
registerBrandedTokenInterCommObj.init();
logger.win('InterComm Script for Register Branded Token initiated.');

process.on('uncaughtException', function(args) {
  logger.error('Received uncaughtException', args);
  setTimeout(function() {
    process.exit(1);
  }, 60000);
});

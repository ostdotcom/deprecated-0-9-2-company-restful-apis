'use strict';
/**
 * Start openST Platform utility chain services.
 *
 * @module tools/setup/start_utility_services.js
 */

const rootPrefix = '.';

require(rootPrefix + '/module_overrides/index');
require(rootPrefix + '/lib/providers/platform');

const shellAsyncCmd = require('node-cmd');

// load shelljs and disable output
let shell = require('shelljs');
shell.config.silent = true;

const InstanceComposer = require(rootPrefix + '/instance_composer'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger.js'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  homeAbsolutePath = process.env.HOME,
  startServicesHelper = require(rootPrefix +
    '/node_modules/@openstfoundation/openst-platform/tools/setup/start_services_helper');

const args = process.argv,
  group_id = args[2];

if (!group_id) {
  logger.error('Please pass group_id for config fetching. Run the code as: \nnode start_utility_services group_id');
  process.exit(1);
}

const strategyByGroupHelperObj = new StrategyByGroupHelper(group_id);

/**
 * Constructor for start services
 *
 * @constructor
 */
const StartServicesKlass = function() {};

StartServicesKlass.prototype = {
  /**
   * Start all platform services
   */
  perform: async function() {
    const oThis = this,
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash(),
      configStrategy = configStrategyResp.data,
      ic = new InstanceComposer(configStrategy),
      platformProvider = ic.getPlatformProvider(),
      openSTPlatform = platformProvider.getInstance(),
      utilityChainStatus = openSTPlatform.services.utils.utilityChainStatus,
      utilityChainId = configStrategy.OST_UTILITY_CHAIN_ID,
      servicesList = [];

    // Start DynamoDB server
    logger.step('** Starting DynamoDB');
    let cmd =
      'java -Djava.library.path=' +
      homeAbsolutePath +
      '/dynamodb_local_latest/DynamoDBLocal_lib/ -jar ' +
      homeAbsolutePath +
      '/dynamodb_local_latest/DynamoDBLocal.jar -sharedDb -dbPath ' +
      homeAbsolutePath +
      '/openst-setup/logs/utility-chain-' +
      utilityChainId;
    // + ' -port 8001'
    // servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    // Start Utility Chain
    logger.step('** Start utility chain');
    cmd =
      'sh ' +
      startServicesHelper.setupFolderAbsolutePath() +
      '/' +
      startServicesHelper.utilityChainBinFilesFolder(utilityChainId) +
      '/run-utility.sh';
    servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    // Wait for 5 seconds for geth to come up
    const sleep = function(ms) {
      return new Promise(function(resolve) {
        setTimeout(resolve, ms);
      });
    };
    await sleep(5000);

    // Check geths are up and running
    logger.step('** Check utility chain is up and responding');
    const statusObj = new utilityChainStatus(),
      servicesResponse = await statusObj.perform();
    if (servicesResponse.isFailure()) {
      logger.error('* Error ', servicesResponse);
      process.exit(1);
    } else {
      logger.info('Utility Chain:', servicesResponse.data.chain.utility);
    }

    // Start intercom processes in openST env
    logger.step('** Starting Register Branded Token Intercom');
    cmd =
      'node executables/inter_comm/register_branded_token.js ' +
      homeAbsolutePath +
      '/openst-setup/data/utility-chain-' +
      utilityChainId +
      '/' +
      'register_branded_token.data ' +
      group_id +
      ' >> ' +
      homeAbsolutePath +
      '/openst-setup/logs/utility-chain-' +
      utilityChainId +
      '/' +
      'register_branded_token.log';
    servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    logger.step('** Starting Stake & Mint Intercom');
    cmd =
      'node executables/inter_comm/stake_and_mint.js ' +
      homeAbsolutePath +
      '/openst-setup/data/utility-chain-' +
      utilityChainId +
      '/' +
      'stake_and_mint.data ' +
      group_id +
      ' >> ' +
      homeAbsolutePath +
      '/openst-setup/logs/utility-chain-' +
      utilityChainId +
      '/' +
      'stake_and_mint.log';
    servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    logger.step('** Starting Stake & Mint Processor Intercomm');
    cmd =
      'node executables/inter_comm/stake_and_mint_processor.js 2' +
      ' >> ' +
      homeAbsolutePath +
      '/openst-setup/logs/utility-chain-' +
      utilityChainId +
      '/' +
      'stake_and_mint_processor.log';
    servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    // logger.step('** Starting Block Scanner to mark mined transactions as done');
    // cmd =
    //   'node executables/block_scanner/for_tx_status_and_balance_sync.js 1 ' +
    //   homeAbsolutePath +
    //   '/openst-setup/data/utility-chain-' +
    //   utilityChainId + '/' +
    //   'block_scanner_execute_transaction.data ' +
    //   homeAbsolutePath +
    //   '/openst-setup/logs/utility-chain-' +
    //   utilityChainId + '/' +
    //   'block_scanner_benchmark.csv ' +
    //   ' >> ' +
    //   homeAbsolutePath +
    //   '/openst-setup/logs/utility-chain-' +
    //   utilityChainId + '/' +
    //   'block_scanner_execute_transaction.log';
    // servicesList.push(cmd);
    // oThis._asyncCommand(cmd);

    logger.win(
      '\n** Congratulations! All services are up and running. \n' +
        'NOTE: We will keep monitoring the services, and notify you if any service stops.'
    );

    // Check all services are running
    oThis._uptime(servicesList);
  },

  /**
   * Run async command
   *
   * @params {string} cmd - command to start the service
   * @private
   */
  _asyncCommand: function(cmd) {
    const oThis = this;
    logger.info(cmd);
    shellAsyncCmd.run(cmd);
  },

  /**
   * Check if all services are up and running
   *
   * @params {array} cmds - Array of all running service commands
   * @private
   */
  _uptime: function(cmds) {
    setInterval(function() {
      for (let i = 0; i < cmds.length; i++) {
        let processID = (shell.exec("ps -ef | grep '" + cmds[i] + "' | grep -v grep | awk '{print $2}'") || {}).stdout;
        if (processID === '') {
          logger.error('* Process stopped:', cmds[i], ' Please restart the services.');
        }
      }
    }, 5000);
  }
};

const services = new StartServicesKlass();
services.perform();

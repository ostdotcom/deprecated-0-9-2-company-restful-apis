'use strict';
/**
 * Start openST Platform value chain services.
 *
 * @module tools/setup/start_value_services.js
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
  binFolderAbsolutePath = homeAbsolutePath + '/openst-setup/bin';

const args = process.argv,
  group_id = args[2];

if (!group_id) {
  logger.error('Please pass group_id for fetching strategy. Run the code as: \nnode start_value_services group_id');
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
      openSTPlaform = platformProvider.getInstance(),
      valueChainStatus = openSTPlaform.services.utils.valueChainStatus,
      servicesList = [];

    // Start REDIS server
    logger.step('** Starting Redis Server');
    let cmd =
      "redis-server --port 6379  --requirepass 'st123'" + ' >> ' + homeAbsolutePath + '/openst-setup/logs/redis.log';
    // servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    // Start Memcached server
    logger.step('** Starting Memcached Server');
    cmd = 'memcached -p 11211 -d' + ' >> ' + homeAbsolutePath + '/openst-setup/logs/memcached.log';
    // servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    // Start RabbitMQ server
    logger.step('** Starting RabbitMQ Server');
    cmd = 'rabbitmq-server' + ' >> ' + homeAbsolutePath + '/openst-setup/logs/rabbitmq.log';
    // servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    // Start Value Chain
    logger.step('** Start value chain');
    cmd = 'sh ' + binFolderAbsolutePath + '/run-value.sh';
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
    logger.step('** Check value chain is up and responding');
    const statusObj = new valueChainStatus(),
      servicesResponse = await statusObj.perform();
    if (servicesResponse.isFailure()) {
      logger.error('* Error ', servicesResponse);
      process.exit(1);
    } else {
      logger.info('* Value Chain:', servicesResponse.data.chain.value);
    }

    logger.step('** Starting Processor to execute transactions');
    cmd =
      'node executables/rmq_subscribers/execute_transaction.js 1' +
      ' >> ' +
      homeAbsolutePath +
      '/openst-setup/logs/execute_transaction.log';
    servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    /*logger.step('** Starting Slow Processor to execute transactions');
    cmd =
      'node executables/rmq_subscribers/execute_transaction.js 2 slow' +
      ' >> ' +
      homeAbsolutePath +
      '/openst-setup/logs/slow_execute_transaction.log';
    servicesList.push(cmd);
    oThis._asyncCommand(cmd);*/

    logger.step('** Starting worker to process events');
    cmd =
      'node executables/rmq_subscribers/factory.js 1 \'temp\' \'["on_boarding.#","airdrop_allocate_tokens","stake_and_mint.#","event.stake_and_mint_processor.#","event.block_scanner.#","airdrop.approve.contract", "transaction.stp_transfer"]\'' +
      ' >> ' +
      homeAbsolutePath +
      '/openst-setup/logs/executables_rmq_subscribers_factory.log';
    // servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    logger.step('** Starting allocate airdrop worker');
    cmd =
      'node executables/rmq_subscribers/start_airdrop.js' +
      ' >> ' +
      homeAbsolutePath +
      '/openst-setup/logs/start_airdrop.log';
    servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    logger.step('** Starting SAAS App');
    cmd = 'node app.js' + ' >> ' + homeAbsolutePath + '/openst-setup/logs/node_app.log';
    servicesList.push(cmd);
    oThis._asyncCommand(cmd);

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

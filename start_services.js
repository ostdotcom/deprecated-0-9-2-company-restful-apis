
"use strict";
/**
 * Start All openST Platform Services
 *
 * @module tools/setup/start_services.js
 */

const rootPrefix = ".";

require(rootPrefix + '/module_overrides/index');

const shellAsyncCmd = require('node-cmd')
  , Path = require('path')
  , os = require('os')
;

// load shelljs and disable output
var shell = require('shelljs');
shell.config.silent = true;

const platformStatus = require(rootPrefix + '/node_modules/@openstfoundation/openst-platform/services/utils/platform_status')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger.js')
;

const homeAbsolutePath = process.env.HOME
  , binFolderAbsolutePath = homeAbsolutePath + '/openst-setup/bin';

/**
 * Constructor for start services
 *
 * @constructor
 */
const StartServicesKlass = function () {};

StartServicesKlass.prototype = {
  /**
   * Start all platform services
   */
  perform: async function () {
    const oThis = this
      , servicesList = [];

    // Start REDIS server
    logger.step("** Starting Redis Server");
    var cmd = "redis-server --port 6379  --requirepass 'st123'"
      + " >> " + homeAbsolutePath + "/openst-setup/logs/redis.log";
    // servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    // Start Memcached server
    logger.step("** Starting Memcached Server");
    var cmd = "memcached -p 11211 -d"
      + " >> " + homeAbsolutePath + "/openst-setup/logs/memcached.log";
    // servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    // Start RabbitMQ server
    logger.step("** Starting RabbitMQ Server");
    var cmd = "rabbitmq-server"
      + " >> " + homeAbsolutePath + "/openst-setup/logs/rabbitmq.log";
    // servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    // Start Value Chain
    logger.step("** Start value chain");
    var cmd = "sh " + binFolderAbsolutePath + "/run-value.sh";
    servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    // Start Utility Chain
    logger.step("** Start utility chain");
    var cmd = "sh " + binFolderAbsolutePath + "/run-utility.sh";
    servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    // Wait for 5 seconds for geth to come up
    const sleep = function(ms) {
      return new Promise(function(resolve) {setTimeout(resolve, ms)});
    };
    await sleep(5000);

    // Check geths are up and running
    logger.step("** Check chains are up and responding");
    const statusObj = new platformStatus()
      , servicesResponse = await statusObj.perform();
    if (servicesResponse.isFailure()) {
      logger.error("* Error ", servicesResponse);
      process.exit(1);
    } else {
      logger.info("* Value Chain:", servicesResponse.data.chain.value, "Utility Chain:", servicesResponse.data.chain.utility);
    }

    // Start intercom processes in openST env
    logger.step("** Starting Register Branded Token Intercom");
    var cmd = "node executables/inter_comm/register_branded_token.js "
      + homeAbsolutePath
      + "/openst-setup/logs/register_branded_token.data"
      + " >> " + homeAbsolutePath + "/openst-setup/logs/register_branded_token.log";
    servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    logger.step("** Starting Stake & Mint Intercom");
    var cmd = "node executables/inter_comm/stake_and_mint.js "
      + homeAbsolutePath
      + "/openst-setup/logs/stake_and_mint.data"
      + " >> " + homeAbsolutePath + "/openst-setup/logs/stake_and_mint.log";
    servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    logger.step("** Starting Stake & Mint Processor Intercom");
    var cmd = "node executables/inter_comm/stake_and_mint_processor.js "
      + homeAbsolutePath
      + "/openst-setup/logs/stake_and_mint_processor.data"
      + " >> " + homeAbsolutePath + "/openst-setup/logs/stake_and_mint_processor.log";
    servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    logger.step("** Starting Processor to execute transactions");
    var cmd = "node executables/rmq_subscribers/execute_transaction.js 1"
      + " >> " + homeAbsolutePath + "/openst-setup/logs/execute_transaction.log";
    servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    logger.step("** Starting Slow Processor to execute transactions");
    var cmd = "node executables/rmq_subscribers/execute_transaction.js 2 slow"
      + " >> " + homeAbsolutePath + "/openst-setup/logs/slow_execute_transaction.log";
    servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    logger.step("** Starting Block Scanner to mark mined transactions as done");
    var cmd = "node executables/block_scanner/execute_transaction.js 1 "
      + homeAbsolutePath
      + "/openst-setup/logs/block_scanner_execute_transaction.data"
      + " >> " + homeAbsolutePath + "/openst-setup/logs/block_scanner_execute_transaction.log";
    servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    logger.step("** Starting worker to process events");
    var cmd = "node executables/rmq_subscribers/factory.js 1 'temp' '[\"on_boarding.#\",\"airdrop_allocate_tokens\",\"stake_and_mint.#\",\"event.stake_and_mint_processor.#\",\"airdrop.approve.contract\"]'"
      + " >> " + homeAbsolutePath + "/openst-setup/logs/executables_rmq_subscribers_factory.log";
    // servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    logger.step("** Starting allocate airdrop worker");
    var cmd = "node executables/rmq_subscribers/start_airdrop.js"
      + " >> " + homeAbsolutePath + "/openst-setup/logs/start_airdrop.log";
    servicesList.push(cmd);
    oThis._asyncCommand(cmd);

    // logger.step("** Starting SAAS App");
    // var cmd = "node app.js"
    //   + " >> " + homeAbsolutePath + "/openst-setup/logs/node_app.log";
    // servicesList.push(cmd);
    // oThis._asyncCommand(cmd);

    logger.win("\n** Congratulation! All services are up and running. \n" +
      "NOTE: We will keep monitoring the services, and notify you if any service stops.");

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
    const oThis = this
    ;
    logger.info(cmd);
    shellAsyncCmd.run(cmd);
  },

  /**
   * Check if all services are up and running
   *
   * @params {array} cmds - Array of all running service commands
   * @private
   */
  _uptime: function (cmds) {
    setInterval(function () {
      for (var i=0; i < cmds.length; i++) {
        var processID = (shell.exec("ps -ef | grep '" + cmds[i] + "' | grep -v grep | awk '{print $2}'") || {}).stdout;
        if (processID == "") {
          logger.error("* Process stopped:", cmds[i], " Please restart the services.");
        }
      }
    }, 5000);
  }
};

const services = new StartServicesKlass();
services.perform();

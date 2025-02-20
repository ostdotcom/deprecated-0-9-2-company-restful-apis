'use strict';

/**
 * Perform basic validations
 *
 * @module helpers/basic
 */

const BigNumber = require('bignumber.js');

const rootPrefix = '..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  apiErrorConfig = require(rootPrefix + '/config/api_params/api_error_config'),
  v0ParamErrorConfig = require(rootPrefix + '/config/api_params/v0/error_config'),
  v1ParamErrorConfig = require(rootPrefix + '/config/api_params/v1/error_config'),
  v1Dot1ParamErrorConfig = require(rootPrefix + '/config/api_params/v1.1/error_config'),
  internalParamErrorConfig = require(rootPrefix + '/config/api_params/internal/error_config');

/**
 * Basic helper methods constructor
 *
 * @constructor
 *
 */
const BasicHelperKlass = function() {};

BasicHelperKlass.prototype = {
  convertToNormal: function(numInWei) {
    return this.convertToBigNumber(numInWei).div(this.convertToBigNumber(10).toPower(18));
  },

  convertToWei: function(num) {
    return this.convertToBigNumber(num).mul(this.convertToBigNumber(10).toPower(18));
  },

  /**
   * Check if amount is valid wei number and not zero
   *
   * @param {number} amountInWei - amount in wei
   *
   * @return {boolean}
   */
  isWeiValid: function(amountInWei) {
    const oneForMod = new BigNumber('1');

    // Convert amount in BigNumber
    let bigNumAmount = null;
    if (amountInWei instanceof BigNumber) {
      bigNumAmount = amountInWei;
    } else {
      let numAmount = Number(amountInWei);
      if (!isNaN(numAmount)) {
        bigNumAmount = new BigNumber(amountInWei);
      }
    }

    return !bigNumAmount ||
      bigNumAmount.lessThan(1) ||
      bigNumAmount.isNaN() ||
      !bigNumAmount.isFinite() ||
      bigNumAmount.mod(oneForMod) != 0
      ? false
      : true;
  },

  /**
   * Convert wei to proper string. Make sure it's a valid number
   *
   * @param {number} amountInWei - amount in wei to be formatted
   *
   * @return {string}
   */
  formatWeiToString: function(amountInWei) {
    const oThis = this;
    return oThis.convertToBigNumber(amountInWei).toString(10);
  },

  /**
   * Convert number to big number. Make sure it's a valid number
   *
   * @param {number} number - number to be formatted
   *
   * @return {BigNumber}
   */
  convertToBigNumber: function(number) {
    return number instanceof BigNumber ? number : new BigNumber(number);
  },

  /**
   * Convert number to Hex
   *
   * @param {number} number - number to be formatted
   *
   * @return {BigNumber}
   */
  convertToHex: function(number) {
    return '0x' + new BigNumber(number).toString(16).toUpperCase();
  },

  /**
   * Check if address is valid or not
   *
   * @param {string} address - Address
   *
   * @return {boolean}
   */
  isAddressValid: function(address) {
    if (typeof address !== 'string') {
      return false;
    }
    return /^0x[0-9a-fA-F]{40}$/.test(address);
  },

  /**
   * Check if branded token name is valid or not
   *
   * @param {string} name - Branded token name
   *
   * @return {boolean}
   */
  isBTNameValid: function(name) {
    const oThis = this;
    if (typeof name !== 'string') {
      return false;
    }
    return /^[a-z0-9\s]{1,}$/i.test(name) && !oThis.hasStopWords(name);
  },

  /**
   * Check if transaction kind name is valid or not
   *
   * @param {string} name - Tx Kind name
   *
   * @return {boolean}
   */
  isTxKindNameValid: function(name) {
    if (typeof name !== 'string') {
      return false;
    }
    return /^[a-z0-9\s]{3,20}$/i.test(name);
  },

  /**
   * Check if user name is valid or not
   *
   * @param {string} name - username
   *
   * @return {boolean}
   */
  isUserNameValid: function(name) {
    const oThis = this;
    if (typeof name !== 'string') {
      return false;
    }
    return /^[a-z0-9\s]{3,20}$/i.test(name);
  },

  /**
   * Check if branded token symbol is valid or not
   *
   * @param {string} symbol - Branded token symbol
   *
   * @return {boolean}
   */
  isBTSymbolValid: function(symbol) {
    if (typeof symbol !== 'string') {
      return false;
    }
    return /^[a-z0-9]{3,4}$/i.test(symbol);
  },

  /**
   * Check if branded token conversion rate is valid or not
   *
   * @param {number} conversionRate - Branded token conversion rate
   *
   * @return {boolean}
   */
  isBTConversionRateValid: function(conversionRate) {
    return !isNaN(conversionRate) && parseFloat(conversionRate) > 0;
  },

  /**
   * Check if uuid is valid or not
   *
   * @param {string} uuid - UUID of user, branded token etc.
   *
   * @return {boolean}
   */
  isUuidValid: function(uuid) {
    if (typeof uuid !== 'string') {
      return false;
    }

    return /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$/.test(uuid);
  },

  /**
   * Check if Token UUID is valid or not (hex format)
   *
   * @param {string} uuid - Branded Token UUID
   *
   * @return {boolean}
   */
  isTokenUuidValid: function(uuid) {
    if (typeof uuid !== 'string') {
      return false;
    }
    return /^0x[0-9a-fA-F]{64}$/.test(uuid);
  },

  /**
   * Check if eth address is valid or not
   *
   * @param {string} address - address
   *
   * @return {boolean}
   */
  isEthAddressValid: function(address) {
    if (typeof address !== 'string') {
      return false;
    }
    return /^0x[0-9a-fA-F]{40}$/.test(address);
  },

  /**
   * Check if string has stop words
   *
   * @param {string} string
   *
   * @return {boolean}
   */
  hasStopWords: function(string) {
    if (typeof string !== 'string') {
      return false;
    }
    let reg_ex = /\b(?:anal|anus|arse|ballsack|bitch|biatch|blowjob|blow job|bollock|bollok|boner|boob|bugger|bum|butt|buttplug|clitoris|cock|coon|crap|cunt|dick|dildo|dyke|fag|feck|fellate|fellatio|felching|fuck|f u c k|fudgepacker|fudge packer|flange|Goddamn|God damn|homo|jerk|Jew|jizz|Kike|knobend|knob end|labia|muff|nigger|nigga|penis|piss|poop|prick|pube|pussy|scrotum|sex|shit|s hit|sh1t|slut|smegma|spunk|tit|tosser|turd|twat|vagina|wank|whore|porn)\b/i;
    return reg_ex.test(string);
  },

  /**
   * Shuffle a array
   *
   * @param {Array} array
   *
   * @return {Array}
   */
  shuffleArray: function(array) {
    for (let i = array.length - 1; i >= 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      let temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }

    return array;
  },

  /**
   * Fetch Error Config
   *
   * @param {String} apiVersion
   *
   * @return {object}
   */
  fetchErrorConfig: function(apiVersion) {
    let paramErrorConfig;

    if (apiVersion === apiVersions.v0) {
      paramErrorConfig = v0ParamErrorConfig;
    } else if (apiVersion === apiVersions.v1) {
      paramErrorConfig = v1ParamErrorConfig;
    } else if (apiVersion === apiVersions.v1Dot1) {
      paramErrorConfig = v1Dot1ParamErrorConfig;
    } else if (apiVersion === apiVersions.internal) {
      paramErrorConfig = internalParamErrorConfig;
    } else if (apiVersion === apiVersions.general) {
      paramErrorConfig = {};
    } else {
      throw 'unsupported API Version ' + apiVersion;
    }

    return {
      param_error_config: paramErrorConfig,
      api_error_config: apiErrorConfig
    };
  },

  /**
   * Convert a common separated string to array
   *
   * @param {String} str
   *
   * @return {Array}
   */
  commaSeperatedStrToArray: function(str) {
    return str.split(',').map((ele) => ele.trim());
  },

  /**
   * check if number is already in wei
   * by checking if it is greater then min wei value
   *
   * @param {String} str
   *
   * @return {Array}
   */
  isGreaterThanMinWei: function(str) {
    return this.convertToBigNumber(str) >= this.convertToBigNumber(10).toPower(18);
  },

  /**
   * check if sub environment is main
   *
   * @return {Boolean}
   */
  isProduction: function() {
    return coreConstants.ENVIRONMENT == 'production';
  },

  /**
   * check if sub environment is main
   *
   * @return {Boolean}
   */
  isMainSubEnvironment: function() {
    return coreConstants.SUB_ENVIRONMENT == 'main';
  },

  /**
   * check if sub environment is Sandbox
   *
   * @return {Boolean}
   */
  isSandboxSubEnvironment: function() {
    return coreConstants.SUB_ENVIRONMENT == 'sandbox';
  },

  /**
   * Alert If ST Prime Balance is below this balance.
   *
   * @return {Map}
   *
   */
  reserveAlertBalanceWei: function() {
    const oThis = this;

    if (oThis.isMainSubEnvironment()) {
      return oThis.convertToWei(0.05);
    } else {
      return oThis.convertToWei(0.5);
    }
  },

  /**
   * ST Prime Balance to Transfer to Workers address
   *
   * @return {Map}
   *
   */
  transferSTPrimeToWorker: function() {
    const oThis = this;

    if (oThis.isMainSubEnvironment()) {
      return oThis.convertToWei(0.5);
    } else {
      return oThis.convertToWei(2);
    }
  },

  /**
   * ST Prime Balance to Transfer to Budget Holder address
   *
   * @return {Map}
   *
   */
  transferSTPrimeToBudgetHolder: function() {
    const oThis = this;

    if (oThis.isMainSubEnvironment()) {
      return oThis.convertToWei(0.05);
    } else {
      return oThis.convertToWei(1);
    }
  },

  /**
   * ST Prime Balance transfer if balance is below this balance.
   *
   * @return {Map}
   *
   */
  isSTPrimeTransferRequiredBal: function() {
    const oThis = this;

    if (oThis.isMainSubEnvironment()) {
      return oThis.convertToWei(0.01);
    } else {
      return oThis.convertToWei(0.5);
    }
  },

  /**
   *
   * Pauses flow of execution for a few milliseconds.
   *
   * @param timeInMilliSeconds
   * @returns {Promise<any>}
   */
  pauseForMilliSeconds: async function(timeInMilliSeconds) {
    return new Promise(function(onResolve) {
      setTimeout(function() {
        onResolve();
      }, timeInMilliSeconds);
    });
  },

  /**
   * Returns the index of workingProcesses array which needs to be used.
   *
   * @param {Number} fromUserId
   * @param {Array} workingProcesses
   * @returns {Object}
   */
  transactionDistributionLogic: function(fromUserId, workingProcesses) {
    let index = fromUserId % workingProcesses.length,
      workerUuid = workingProcesses[index].workerUuid;

    return { index: index, workerUuid: workerUuid };
  }
};

module.exports = new BasicHelperKlass();

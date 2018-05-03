"use strict";

/**
 * Perform basic validations
 *
 * @module helpers/basic
 */

const BigNumber = require('bignumber.js')
;

const rootPrefix = '..'
  , apiVersions = require(rootPrefix + '/lib/global_constant/api_versions')
  , v0ParamErrorConfig = require(rootPrefix + '/config/api_params/v0/error_config')
  , v1ParamErrorConfig = require(rootPrefix + '/config/api_params/v1/error_config')
  , internalParamErrorConfig = require(rootPrefix + '/config/api_params/internal/error_config')
  , apiErrorConfig = require(rootPrefix + '/config/api_params/api_error_config')
;

/**
 * Basic helper methods constructor
 *
 * @constructor
 *
 */
const BasicHelperKlass = function() {};

BasicHelperKlass.prototype = {

  convertToNormal: function (numInWei) {
    return this.convertToBigNumber(numInWei).div(this.convertToBigNumber(10).toPower(18))
  },

  convertToWei: function (num) {
    return this.convertToBigNumber(num).mul(this.convertToBigNumber(10).toPower(18))
  },

  /**
   * Check if amount is valid wei number and not zero
   *
   * @param {number} amountInWei - amount in wei
   *
   * @return {boolean}
   */
  isWeiValid: function (amountInWei) {
    const oneForMod = new BigNumber('1');

    // Convert amount in BigNumber
    var bigNumAmount = null;
    if (amountInWei instanceof BigNumber) {
      bigNumAmount = amountInWei;
    } else {
      var numAmount = Number(amountInWei);
      if (!isNaN(numAmount)) {
        bigNumAmount = new BigNumber(amountInWei);
      }
    }

    return (!bigNumAmount || bigNumAmount.lessThan(1) || bigNumAmount.isNaN() ||
      !bigNumAmount.isFinite() || bigNumAmount.mod(oneForMod) != 0) ? false : true;
  },

  /**
   * Convert wei to proper string. Make sure it's a valid number
   *
   * @param {number} amountInWei - amount in wei to be formatted
   *
   * @return {string}
   */
  formatWeiToString: function (amountInWei) {
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
  convertToBigNumber: function (number) {
    return (number instanceof BigNumber) ? number : new BigNumber(number);
  },

  /**
   * Convert number to Hex
   *
   * @param {number} number - number to be formatted
   *
   * @return {BigNumber}
   */
  convertToHex: function (number) {
    return '0x' + new BigNumber(number).toString(16).toUpperCase();
  },

  /**
   * Check if address is valid or not
   *
   * @param {string} address - Address
   *
   * @return {boolean}
   */
  isAddressValid: function (address) {
    if (typeof address !== "string") {
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
  isBTNameValid: function (name) {
    const oThis = this;
    if (typeof name !== "string") {
      return false;
    }
    return (/^[a-z0-9\s]{1,}$/i).test(name) && !oThis.hasStopWords(name);
  },

  /**
   * Check if transaction kind name is valid or not
   *
   * @param {string} name - Tx Kind name
   *
   * @return {boolean}
   */
  isTxKindNameValid: function (name) {
    const oThis = this;
    if (typeof name !== "string") {
      return false;
    }
    return (/^[a-z0-9\s]{3,20}$/i).test(name);
  },

  /**
   * Check if user name is valid or not
   *
   * @param {string} name - username
   *
   * @return {boolean}
   */
  isUserNameValid: function (name) {
    const oThis = this;
    if (typeof name !== "string") {
      return false;
    }
    return (/^[a-z0-9\s]{3,20}$/i).test(name);
  },

  /**
   * Check if branded token symbol is valid or not
   *
   * @param {string} symbol - Branded token symbol
   *
   * @return {boolean}
   */
  isBTSymbolValid: function (symbol) {
    if (typeof symbol !== "string") {
      return false;
    }
    return (/^[a-z0-9]{1,}$/i).test(symbol);
  },

  /**
   * Check if branded token conversion rate is valid or not
   *
   * @param {number} conversionRate - Branded token conversion rate
   *
   * @return {boolean}
   */
  isBTConversionRateValid: function (conversionRate) {
    if (!isNaN(conversionRate) && parseFloat(conversionRate) > 0) {
      return true;
    }
    return false;
  },

  /**
   * Check if uuid is valid or not
   *
   * @param {string} uuid - Branded Token UUID
   *
   * @return {boolean}
   */
  isUuidValid: function (uuid) {
    if (typeof uuid !== "string") {
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
  isEthAddressValid: function (address) {
    if (typeof address !== "string") {
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
  hasStopWords: function (string) {
    if (typeof string !== "string") {
      return false;
    }
    var reg_ex = /\b(?:anal|anus|arse|ballsack|bitch|biatch|blowjob|blow job|bollock|bollok|boner|boob|bugger|bum|butt|buttplug|clitoris|cock|coon|crap|cunt|dick|dildo|dyke|fag|feck|fellate|fellatio|felching|fuck|f u c k|fudgepacker|fudge packer|flange|Goddamn|God damn|homo|jerk|Jew|jizz|Kike|knobend|knob end|labia|muff|nigger|nigga|penis|piss|poop|prick|pube|pussy|scrotum|sex|shit|s hit|sh1t|slut|smegma|spunk|tit|tosser|turd|twat|vagina|wank|whore|porn)\b/i;
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

    for (var i = array.length - 1; i >= 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = array[i];
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
  fetchErrorConfig: function (apiVersion) {

    var paramErrorConfig;

    if (apiVersion === apiVersions.v0) {
      paramErrorConfig = v0ParamErrorConfig;
    } else if (apiVersion === apiVersions.v0) {
      paramErrorConfig = v1ParamErrorConfig;
    } else if (apiVersion === apiVersions.internal) {
      paramErrorConfig = internalParamErrorConfig;
    } else if (apiVersion === apiVersions.general) {
      paramErrorConfig = {}
    } else {
      throw "unsupported API Version " + apiVersion;
    }

    return {
      param_error_config: paramErrorConfig,
      api_error_config: apiErrorConfig
    }

  }

};

module.exports = new BasicHelperKlass();
'use strict';

const rootPrefix = '../..',
  basicHelper = require(rootPrefix + '/helpers/basic');

/**
 * CommonValidator
 * @constructor
 */
const CommonValidator = function() {};

CommonValidator.prototype = {
  /**
   * Validation for arbitrary commission flag
   *
   * @param commission_percent
   * @param arbitrary_commission
   */
  validateArbitraryCommissionPercent(commission_percent, arbitrary_commission) {
    const oThis = this;

    if (!oThis.isVarNull(arbitrary_commission) && !oThis.isValidBoolean(arbitrary_commission)) {
      return false;
    }

    if (oThis.isVarTrue(arbitrary_commission) && !oThis.isVarNull(commission_percent)) {
      return false;
    }

    if (oThis.isVarFalse(arbitrary_commission)) {
      if (oThis.isVarNull(commission_percent)) {
        return false;
      } else if (!oThis.commissionPercentValid(commission_percent)) {
        return false;
      }
    }

    return true;
  },

  /**
   * Validation for commission percent
   *
   * @param commission_percent
   * @returns {boolean}
   */
  commissionPercentValid: function(commission_percent) {
    const oThis = this;

    if (oThis.isVarNull(commission_percent)) {
      return true;
    }
    if (parseFloat(commission_percent) >= 0 && parseFloat(commission_percent) <= 100) {
      return true;
    }

    return false;
  },

  /**
   * Validation for arbitrary amount flag
   *
   * @param amount
   * @param arbitrary_amount
   * @returns {boolean}
   */
  validateArbitraryAmount: function(amount, arbitrary_amount) {
    const oThis = this;

    // arbitrary_amount can be null or a boolean. any other value is not acceptable.
    if (!oThis.isVarNull(arbitrary_amount) && !oThis.isValidBoolean(arbitrary_amount)) {
      return false;
    }

    // if arbitrary_amount is true, amount should NOT be sent.
    if (oThis.isVarTrue(arbitrary_amount) && amount >= 0) {
      return false;
    }

    // if arbitrary_amount is false, amount should be sent.
    if (oThis.isVarFalse(arbitrary_amount) && oThis.isVarNull(amount)) {
      return false;
    }

    return true;
  },

  /**
   * Validation for BT amount
   *
   * @param amount
   * @returns {boolean}
   */
  validateBtAmount: function(amount) {
    const oThis = this;

    if (oThis.isVarNull(amount)) {
      return true;
    }

    // amount = amount.trim();

    if (isNaN(parseFloat(amount)) || amount < 0.00001 || amount > 100) {
      return false;
    }
    return true;
  },

  /**
   * Validation for USD amount
   *
   * @param amount
   * @returns {boolean}
   */
  validateUsdAmount: function(amount) {
    const oThis = this;

    if (oThis.isVarNull(amount)) {
      return true;
    }

    // amount = amount.trim();

    if (isNaN(parseFloat(amount)) || amount < 0.01 || amount > 100) {
      return false;
    }
    return true;
  },

  /**
   * Validate page no
   *
   * @param pageNo
   * @return {Array<boolean, number>}
   */
  validateAndSanitizePageNo: function(pageNo) {
    const oThis = this;

    if (oThis.isVarNull(pageNo)) {
      return [true, 1];
    }

    if (!pageNo) {
      return [false, 0];
    }

    if (isNaN(parseInt(pageNo))) {
      return [false, 0];
    }

    if (pageNo < 1 || pageNo > 1000) {
      return [false, 0];
    }

    if (parseInt(pageNo) != pageNo) {
      return [false, 0];
    }

    return [true, parseInt(pageNo)];
  },

  /**
   * Validate limit
   *
   * @param limit
   * @return {Array<boolean, number>}
   */
  validateAndSanitizeLimit: function(limit) {
    const oThis = this;

    if (oThis.isVarNull(limit)) {
      return [true, 10];
    }

    if (!limit) {
      return [false, 0];
    }

    if (isNaN(parseInt(limit))) {
      return [false, 0];
    }

    if (limit < 1 || limit > 100) {
      return [false, 0];
    }

    if (parseInt(limit) != limit) {
      return [false, 0];
    }

    return [true, parseInt(limit)];
  },

  /**
   * Validation for USD amount
   *
   * @param amount
   * @returns {boolean}
   */
  validateAmount: function(amount) {
    if (isNaN(parseFloat(amount)) || amount < 0) {
      return false;
    }
    return true;
  },

  /**
   *
   * Is valid Boolean
   *
   * @return {Boolean}
   *
   */
  isValidBoolean: function(str) {
    const oThis = this;

    if (oThis.isVarNull(str)) {
      return false;
    } else if (str === 'true' || str === 'false' || str === true || str === false) {
      return true;
    } else {
      return false;
    }
  },

  /**
   *
   * Is var null ?
   *
   * @return {Boolean}
   *
   */
  isVarNull: function(variable) {
    return typeof variable === 'undefined' || variable == null;
  },

  /**
   *
   * Is var null ?
   *
   * @return {Boolean}
   *
   */
  isVarTrue: function(variable) {
    return variable === true || variable === 'true';
  },

  /**
   *
   * Is var null ?
   *
   * @return {Boolean}
   *
   */
  isVarFalse: function(variable) {
    return variable === false || variable === 'false';
  },

  /**
   *
   * Is var integer ?
   *
   * @return {Boolean}
   *
   */
  isVarInteger: function(variable) {
    return typeof variable === 'number' && variable % 1 === 0;
  },

  /**
   *
   * Is valid Boolean
   *
   * @return {Boolean}
   *
   */
  isValidOrderingString: function(str) {
    return ['asc', 'desc'].includes(str.toLowerCase());
  },

  /**
   *
   * Is valid UUID Array
   *
   * @param {Array} array
   *
   * @return {Boolean}
   *
   */
  isValidUuidArray: function(array) {
    if (Array.isArray(array)) {
      for (let i = 0; i < array.length; i++) {
        if (!basicHelper.isUuidValid(array[i])) {
          return false;
        }
      }
      return true;
    } else {
      return false;
    }
  },

  /**
   * Checks if the given string is an address
   *
   * @param address {String} address the given HEX adress
   * @return {Boolean}
   */
  validateEthAddress: function(address) {
    const oThis = this;

    if (oThis.isVarNull(address) || typeof address != 'string' || address == '') {
      return false;
    }

    address = address.trim().toLowerCase();

    return /^(0x)?[0-9a-f]{40}$/i.test(address);
  }
};

module.exports = new CommonValidator();

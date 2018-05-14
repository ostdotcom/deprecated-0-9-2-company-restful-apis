"use strict";

const rootPrefix = '../..'
;

/**
 * CommonValidator
 * @constructor
 */
const CommonValidator = function () {

};

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

    if (oThis.isVarTrue(arbitrary_commission) && (commission_percent >= 0) ) {
      return false;
    }

    if (oThis.isVarFalse(arbitrary_commission) && oThis.isVarNull(commission_percent) ) {
      return false;
    }
    return true;
  },

  /**
   * Validation for commission percent
   *
   * @param commission_percent
   * @returns {boolean}
   */
  commissionPercentValid: function (commission_percent) {
    const oThis = this;

    if (!oThis.isVarNull(commission_percent) && (parseInt(commission_percent) < 0 || parseFloat(commission_percent) > 100)) {
      return false;
    }
    return true;
  },

  /**
   * Validation for arbitrary amount flag
   *
   * @param amount
   * @param arbitrary_amount
   * @returns {boolean}
   */
  validateArbitraryAmount: function (amount, arbitrary_amount) {

    const oThis = this;

    // arbitrary_amount can be null or a boolean. any other value is not acceptable.
    if (!oThis.isVarNull(arbitrary_amount) && !oThis.isValidBoolean(arbitrary_amount)) {
      return false;
    }

    // if arbitrary_amount is true, amount should NOT be sent.
    if (oThis.isVarTrue(arbitrary_amount) && (amount >= 0) ) {
      return false;
    }

    // if arbitrary_amount is false, amount should be sent.
    if (oThis.isVarFalse(arbitrary_amount) && oThis.isVarNull(amount) ) {
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
  validateBtAmount: function (amount) {
    if ( (amount >= 0) && (amount < 0.00001 || amount > 100)) {
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
  validateUsdAmount: function (amount) {
    if ( (amount >=0) && (amount < 0.001 || amount > 100)) {
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
  isValidBoolean: function (str) {

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
  isVarNull: function (variable) {
    return (typeof variable === 'undefined' || variable == null);
  },

  /**
   *
   * Is var null ?
   *
   * @return {Boolean}
   *
   */
  isVarTrue: function (variable) {
    return (variable === true || variable === 'true');
  },

  /**
   *
   * Is var null ?
   *
   * @return {Boolean}
   *
   */
  isVarFalse: function (variable) {
    return (variable === false || variable === 'false');
  },

  /**
   *
   * Is valid Boolean
   *
   * @return {Boolean}
   *
   */
  isValidOrderingString: function (str) {

    return ['asc', 'desc'].includes(str.toLowerCase());

  }

};

module.exports = new CommonValidator();
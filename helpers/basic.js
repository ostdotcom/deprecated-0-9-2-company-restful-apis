"use strict";

/**
 * Perform basic validations
 *
 * @module helpers/basic
 */

const BigNumber = require('bignumber.js')
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
   * @param {number} amountInWei - amount in wei to be formatted
   *
   * @return {BigNumber}
   */
  convertToBigNumber: function (number) {
    return (number instanceof BigNumber) ? number : new BigNumber(number);
  }

};

module.exports = new BasicHelperKlass();
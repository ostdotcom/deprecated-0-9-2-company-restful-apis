"use strict";

const rootPrefix = '../..'
;

/**
 * CommonValidator
 * @constructor
 */
const CommonValidator = function(){

};

CommonValidator.prototype = {
  /**
   * Validation for commission percent
   *
   * @param commission_percent
   * @returns {boolean}
   */
  commissionPercentValid: function (commission_percent) {
    const oThis = this;

    if(commission_percent && (parseInt(commission_percent) < 0 || parseFloat(commission_percent) > 100)){
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
  validateArbitraryAmount: function(amount, arbitrary_amount){
    if( ( amount && arbitrary_amount ) || ( !amount && !arbitrary_amount ) ){
      return false;
    }
    return true;
  },

  /**
   * Validation for amount
   *
   * @param amount
   * @returns {boolean}
   */
  validateAmount: function(amount){
    if (amount && (amount < 0.00001 || amount > 100){
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

    if(oThis.isVarNull(str)) {
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
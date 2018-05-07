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

  },

};

module.exports = new CommonValidator();
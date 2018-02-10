"use strict";

const conversionRates = {

  ost_currency: function(){
    return 'OST';
  },

  usd_currency: function(){
    return 'USD'
  },

  active_status: function(){
    return 'active';
  },

  inactive_status: function(){
    return 'inactive';
  },

  inprocess_status: function(){
    return 'in-process'
  }

};

module.exports = conversionRates;
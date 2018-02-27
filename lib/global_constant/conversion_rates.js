"use strict";

const conversionRates = {

  ost_currency: function(){
    return 'OST';
  },

  usd_currency: function(){
    return 'USD'
  },

  eur_currency: function(){
    return 'EUR'
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
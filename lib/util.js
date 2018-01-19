"use strict";

const Util = function () {};

Util.prototype = {

  constructor: Util,

  formatDbDate: function (dateObj) {
    function pad(n) {
      return n<10 ? "0"+n : n
    }

    return dateObj.getFullYear()+"-"+
      pad(dateObj.getMonth()+1)+"-"+
      pad(dateObj.getDate())+" "+
      pad(dateObj.getHours())+":"+
      pad(dateObj.getMinutes())+":"+
      pad(dateObj.getSeconds())
  }

};

module.exports = new Util;
"use strict";

const OpenStPaymentsKlass = require('@openstfoundation/openst-payments')
  , openStPaymentsDeployer = new OpenStPaymentsKlass.deployer()
;

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

const SetWorkerKlass = function (params) {

};

SetWorkerKlass.prototype = {

  perform: function () {
    return Promise.resolve(responseHelper.successWithData({done: 'complete'}));
  }

};

module.exports = SetWorkerKlass;
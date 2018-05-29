"use strict";

/*
 * Autoscaling Service Object
 */

const OSTStorage = require('@openstfoundation/openst-storage');

const rootPrefix = '..'
    , autoScalingConfig = require(rootPrefix + '/config/autoscaling')
    , autoscalingServiceObj = new OSTStorage.AutoScaling(autoScalingConfig)
;

module.exports = autoscalingServiceObj;
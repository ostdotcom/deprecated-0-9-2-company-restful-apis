'use strict';

/**
 * OpenStPlatform Provider
 *
 * @module lib/providers/platform
 */

const OSTPlatform = require('@openstfoundation/openst-platform');

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * Constructor
 *
 * @constructor
 */
const PlatformProviderKlass = function(configStrategy, instanceComposer) {};

PlatformProviderKlass.prototype = {
  /**
   * get provider
   *
   * @return {object}
   */
  getInstance: function() {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy;
    return new OSTPlatform(configStrategy);
  }
};

InstanceComposer.register(PlatformProviderKlass, 'getPlatformProvider', true);

module.exports = PlatformProviderKlass;

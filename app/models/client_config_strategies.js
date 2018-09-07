'use strict';

/**
 * Model to get client config strategy details.
 *
 * @module /app/models/client_config_strategies
 */

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base');

const dbName = 'saas_config_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT;

const ClientConfigStrategiesModel = function() {
  const oThis = this;

  ModelBaseKlass.call(oThis, { dbName: dbName });
};

ClientConfigStrategiesModel.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const ClientConfigStrategiesModelSpecificPrototype = {
  tableName: 'client_config_strategies',

  enums: {},

  /**
   * Get details using the id.
   *
   * @param id
   * @returns {*}
   *
   */
  getById: function(id) {
    const oThis = this;

    return oThis
      .select(['client_id', 'config_strategy_id'])
      .where({ id: id })
      .fire();
  },

  /**
   * Get details for multiple ids.
   *
   * @param ids
   * @returns {*}
   *
   */
  getByIds: function(ids) {
    const oThis = this;

    return oThis
      .select(['client_id', 'config_strategy_id'])
      .where(['id IN (?)', ids])
      .fire();
  },

  /**
   * Get details using the clientId.
   *
   * @param clientId
   * @returns {*}
   *
   */
  getByClientId: function(clientId) {
    const oThis = this;

    return oThis
      .select(['client_id', 'config_strategy_id', 'auxilary_data'])
      .where({ client_id: clientId })
      .fire();
  },

  /**
   * Get details for multiple clientIds.
   *
   * @param clientIds
   * @returns {*}
   *
   */
  getByClientIds: function(clientIds) {
    const oThis = this;

    return oThis
      .select(['client_id', 'config_strategy_id', 'auxilary_data'])
      .where(['client_id IN (?)', clientIds])
      .fire();
  },

  /**
   * Get details using the configStrategyId.
   *
   * @param configStrategyId
   * @returns {*}
   *
   */
  getByConfigStrategyId: function(configStrategyId) {
    const oThis = this;

    return oThis
      .select(['client_id', 'config_strategy_id'])
      .where({ config_strategy_id: configStrategyId })
      .fire();
  },

  /**
   * Add a record in the table.
   *
   * @param data
   *        data.client_id: clientId to be added.
   *        data.config_strategy_id: configStrategyId to be added.
   * @returns {*}
   *
   */
  insertRecord: function(data) {
    const oThis = this;

    if (!data.client_id || !data.config_strategy_id) {
      throw 'Mandatory parameters are missing.';
    }

    if (typeof data.client_id !== 'number' || typeof data.config_strategy_id !== 'number') {
      throw 'Insertion parameters should be integers.';
    }

    return oThis.insert(data).fire();
  },

  /**
   * Updated a record using the clientId and configStrategyId.
   *
   * @param params
   *        params.client_id: clientId for which record is to be updated.
   *        params.old_config_strategy_id: previous configStrategyId to be updated.
   *        params.new_config_strategy_id: new configStrategyId value.
   * @returns {*}
   *
   */
  updateByClientId: function(params) {
    const oThis = this;

    if (!params.client_id || !params.old_config_strategy_id || !params.new_config_strategy_id) {
      throw 'Mandatory parameters are missing. Expected an object with the following keys: {client_id, old_config_strategy_id, new_config_strategy_id}';
    }

    if (typeof params.new_config_strategy_id !== 'number') {
      throw 'new_config_strategy_id should be an integer.';
    }

    return oThis
      .update({ config_strategy_id: params.new_config_strategy_id })
      .where({
        client_id: params.client_id,
        config_strategy_id: params.old_config_strategy_id
      })
      .fire();
  },

  /**
   * Updated a record using configStrategyId.
   *
   * @param params
   *        params.old_config_strategy_id: previous configStrategyId to be updated.
   *        params.new_config_strategy_id: new configStrategyId value.
   * @returns {*}
   *
   */
  updateByConfigStrategyId: async function(params) {
    const oThis = this;

    if (!params.old_config_strategy_id || !params.new_config_strategy_id) {
      throw 'Mandatory parameters are missing. Expected an object with the following keys: {old_config_strategy_id, new_config_strategy_id}';
    }

    if (typeof params.new_config_strategy_id !== 'number') {
      throw 'new_config_strategy_id should be an integer.';
    }

    let clientAndConfigStrategyIdMapping = await new ClientConfigStrategiesModel().getByConfigStrategyId(
      params.old_config_strategy_id
    );
    let clientIds = [];
    for (let i = 0; i < clientAndConfigStrategyIdMapping.length; i++) {
      clientIds.push(clientAndConfigStrategyIdMapping[i].client_id);
    }

    await oThis
      .update({ config_strategy_id: params.new_config_strategy_id })
      .where({
        config_strategy_id: params.old_config_strategy_id
      })
      .fire();

    return Promise.resolve({ updatedClientIds: clientIds });
  },

  /**
   * Deletes a record using the clientId and configStrategyId.
   *
   * @param params
   *        params.client_id: clientId for which record is to be deleted.
   *        params.config_strategy_id: configStrategyId for which record is to be deleted.
   * @returns {*}
   *
   */
  deleteByClientId: function(params) {
    const oThis = this;

    if (!params.client_id || !params.config_strategy_id) {
      throw 'Mandatory parameters are missing. Expected an object with the following keys: {client_id, config_strategy_id}';
    }

    return oThis
      .delete()
      .where({
        client_id: params.client_id,
        config_strategy_id: params.config_strategy_id
      })
      .fire();
  },

  /**
   * Deletes a record using the configStrategyId.
   *
   * @param configStrategyId: configStrategyId for which records are to be deleted.
   * @returns {*}
   *
   */
  deleteByConfigStrategyId: async function(configStrategyId) {
    const oThis = this;

    if (!configStrategyId) {
      throw 'config_strategy_id is missing.';
    }

    if (typeof configStrategyId !== 'number') {
      throw 'config_strategy_id should be an integer.';
    }

    let clientAndConfigStrategyIdMapping = await new ClientConfigStrategiesModel().getByConfigStrategyId(
      configStrategyId
    );
    let clientIds = [];
    for (let i = 0; i < clientAndConfigStrategyIdMapping.length; i++) {
      clientIds.push(clientAndConfigStrategyIdMapping[i].client_id);
    }

    await oThis
      .delete()
      .where({ config_strategy_id: configStrategyId })
      .fire();

    return Promise.resolve({ deletedClientIds: clientIds });
  }
};

Object.assign(ClientConfigStrategiesModel.prototype, ClientConfigStrategiesModelSpecificPrototype);

module.exports = ClientConfigStrategiesModel;

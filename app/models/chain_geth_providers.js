'use strict';

/**
 * Model to get geth provider details.
 *
 * @module /app/models/chain_geth_providers
 */

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base');

const dbName = 'saas_config_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT;

const ChainGethProvidersModel = function() {
  const oThis = this;

  ModelBaseKlass.call(oThis, { dbName: dbName });
};

ChainGethProvidersModel.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const ChainGethProvidersModelModelSpecificPrototype = {
  tableName: 'chain_geth_providers',

  enums: {},

  /**
   * Get details using the id.
   *
   * @param id
   * @return {*}
   *
   */
  getById: function(id) {
    const oThis = this;

    return oThis
      .select(['chain_id', 'chain_kind', 'ws_provider', 'rpc_provider'])
      .where({ id: id })
      .fire();
  },

  /**
   * Get details for multiple ids.
   *
   * @param ids
   * @return {*}
   *
   */
  getByIds: function(ids) {
    const oThis = this;

    return oThis
      .select(['chain_id', 'chain_kind', 'ws_provider', 'rpc_provider'])
      .where(['id IN (?)', ids])
      .fire();
  },

  /**
   * Get details using the chainId.
   *
   * @param chainId
   * @return {*}
   *
   */
  getByChainId: function(chainId) {
    const oThis = this;

    return oThis
      .select(['chain_id', 'chain_kind', 'ws_provider', 'rpc_provider'])
      .where({ chain_id: chainId })
      .fire();
  },

  /**
   * Get details for multiple clientIds.
   *
   * @param chainIds
   * @return {*}
   *
   */
  getByChainIds: function(chainIds) {
    const oThis = this;

    return oThis
      .select(['chain_id', 'chain_kind', 'ws_provider', 'rpc_provider'])
      .where(['chain_id IN (?)', chainIds])
      .fire();
  },

  /**
   * Get Ws providers using the chainId and the chainKind.
   *
   * @param params
   *        params.chain_id: chainId to be added.
   *        params.chain_kind: chainKind to be added.
   * @return {*}
   *
   */
  getWsProviders: function(params) {
    const oThis = this;

    return oThis
      .select('ws_provider')
      .where({
        chain_id: params.chain_id,
        chain_kind: params.chain_kind
      })
      .fire();
  },

  /**
   * Get Rpc providers using the chainId and the chainKind.
   *
   * @param params
   *        params.chain_id: chainId to be added.
   *        params.chain_kind: chainKind to be added.
   * @return {*}
   *
   */
  getRpcProviders: function(params) {
    const oThis = this;

    return oThis
      .select('rpc_provider')
      .where({
        chain_id: params.chain_id,
        chain_kind: params.chain_kind
      })
      .fire();
  },

  /**
   * Return sibling endpoints given a geth provider.
   *
   * @param gethEndpoint
   * @returns {*}
   */
  getSiblingProviders: async function(gethEndpoint) {
    const oThis = this;

    let siblingEndPoints = [],
      chainIds = [],
      chainKinds = [],
      WsProviders = [],
      RpcProviders = [];

    let chainsInfo = await oThis.select('*').fire();

    for (let i = 0; i < chainsInfo.length; i++) {
      chainIds.push(chainsInfo[i].chain_id);
      chainKinds.push(chainsInfo[i].chain_kind);
      WsProviders.push(chainsInfo[i].ws_provider);
      RpcProviders.push(chainsInfo[i].rpc_provider);
    }

    if (WsProviders.includes(gethEndpoint)) {
      let index = WsProviders.indexOf(gethEndpoint);
      let requiredChainId = chainIds[index],
        requiredChainKind = chainKinds[index];

      for (let i = 0; i < chainsInfo.length; i++) {
        if (chainsInfo[i].chain_id === requiredChainId && chainsInfo[i].chain_kind === requiredChainKind) {
          siblingEndPoints.push(chainsInfo[i].ws_provider);
        }
      }
    } else if (RpcProviders.includes(gethEndpoint)) {
      let index = RpcProviders.indexOf(gethEndpoint);
      let requiredChainId = chainIds[index],
        requiredChainKind = chainKinds[index];

      for (let i = 0; i < chainsInfo.length; i++) {
        if (chainsInfo[i].chain_id === requiredChainId && chainsInfo[i].chain_kind === requiredChainKind) {
          siblingEndPoints.push(chainsInfo[i].rpc_provider);
        }
      }
    } else {
      throw 'This endpoint does not exist.';
    }

    return siblingEndPoints;
  },

  /**
   * Add a record in the table.
   *
   * @param data
   *        data.chain_id: chainId to be added.
   *        data.chain_kind: chainKind to be added.
   *        data.ws_provider: Ws provider to be added.
   *        data.rpc_provider: Rpc provider to be added.
   * @return {*}
   *
   */
  insertRecord: function(data) {
    const oThis = this;

    if (!data.chain_id || !data.chain_kind || !data.ws_provider || !data.rpc_provider) {
      throw 'Mandatory parameters are missing.';
    }

    if (
      typeof data.chain_id !== 'number' ||
      typeof data.chain_kind !== 'number' ||
      typeof data.ws_provider !== 'string' ||
      typeof data.rpc_provider !== 'string'
    ) {
      throw 'Insertion parameter are of wrong data types.';
    }

    return oThis.insert(data).fire();
  },

  /**
   * Update a Ws provider entry using the id.
   *
   * @param params
   *        params.id: Id for which record is to be updated.
   *        params.old_ws_provider: previous Ws Provider to be updated.
   *        params.new_ws_provider: new Ws Provider value.
   * @return {*}
   */
  updateWsProvider: function(params) {
    const oThis = this;

    if (!params.id || !params.old_ws_provider || !params.new_ws_provider) {
      throw 'Mandatory parameters are missing. Expected an object with the following keys: {id, old_ws_provider, new_ws_provider}';
    }

    if (typeof params.new_ws_provider !== 'string') {
      throw 'new_ws_provider should be a string.';
    }

    let existingEntry = oThis
      .select('ws_provider')
      .where({ id: params.id })
      .fire();

    if (existingEntry[0].ws_provider !== params.old_ws_provider) {
      throw 'old_ws_provider does not match the entry in the database.';
    }

    return oThis
      .update({ ws_provider: params.new_ws_provider })
      .where({
        id: params.id,
        ws_provider: params.old_ws_provider
      })
      .fire();
  },

  /**
   * Update a Rpc provider entry using the id.
   *
   * @param params
   *        params.id: Id for which record is to be updated.
   *        params.old_rpc_provider: previous Rpc Provider to be updated.
   *        params.new_rpc_provider: new Rpc Provider value.
   * @return {*}
   */
  updateRpcProvider: function(params) {
    const oThis = this;

    if (!params.id || !params.old_rpc_provider || !params.new_rpc_provider) {
      throw 'Mandatory parameters are missing. Expected an object with the following keys: {id, old_rpc_provider, new_rpc_provider}';
    }

    if (typeof params.new_rpc_provider !== 'string') {
      throw 'new_rpc_provider should be a string.';
    }

    let existingEntry = oThis
      .select('ws_provider')
      .where({ id: params.id })
      .fire();

    if (existingEntry[0].ws_provider !== params.old_rpc_provider) {
      throw 'old_rpc_provider does not match the entry in the database.';
    }

    return oThis
      .update({ ws_provider: params.new_rpc_provider })
      .where({
        id: params.id,
        ws_provider: params.old_rpc_provider
      })
      .fire();
  },

  /**
   * Deletes a record using the Id.
   *
   * @param params
   *        params.id: Id for which record is to be deleted.
   * @return {*}
   *
   */
  deleteById: function(params) {
    const oThis = this;

    if (!params.id) {
      throw 'id is missing.';
    }

    return oThis
      .delete()
      .where({
        id: params.id
      })
      .fire();
  }
};

Object.assign(ChainGethProvidersModel.prototype, ChainGethProvidersModelModelSpecificPrototype);

module.exports = ChainGethProvidersModel;

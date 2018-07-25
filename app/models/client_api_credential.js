'use strict';

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base');

const dbName = 'company_saas_shared_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT,
  tableName = 'client_api_credentials';

const ClientAPICredentialModel = function() {
  const oThis = this;

  ModelBaseKlass.call(oThis, { dbName: dbName });
};

ClientAPICredentialModel.prototype = Object.create(ModelBaseKlass.prototype);

const ClientAPICredentialModelSpecificPrototype = {
  tableName: tableName,

  getClientApi: function(apiKey) {
    const oThis = this;

    return oThis
      .select(['client_id', 'api_key', 'api_secret', 'api_salt', 'expiry_timestamp'])
      .where({ api_key: apiKey })
      .fire();
  }
};

Object.assign(ClientAPICredentialModel.prototype, ClientAPICredentialModelSpecificPrototype);

module.exports = ClientAPICredentialModel;

'use strict';

const rootPrefix = '../..',
  ClientConfigStrategiesModel = require(rootPrefix + '/app/models/client_config_strategies'),
  ConfigStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

const AssignStrategies = function(client_id) {
  const oThis = this;

  oThis.clientId = client_id;
};

AssignStrategies.prototype = {
  /*
  *
  * This function will accept an array of strategy ids.
  * First it will check if those associations are present in the database.
  * If any of the association is missing it will add. For the exisiting association it should give an error/reject saying
  * association is already present. Call update method to update the strategy.
  *
  * */
  associateStrategyIds: async function(strategyIdsToAssociate) {
    const oThis = this,
      dbFields = ['client_id', 'config_strategy_id'];

    let newStrategyIdsToAssociate = strategyIdsToAssociate,
      strategyIdsValues = [];

    if (newStrategyIdsToAssociate.length == 0) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'li_ob_as_1',
          api_error_identifier: 'invalid_params',
          error_config: errorConfig
        })
      );
    }

    //ToDo: Fetch the following data from cache class.
    const clientStrategiesRspArray = await new ClientConfigStrategiesModel().getByClientId(oThis.clientId);

    if (clientStrategiesRspArray.length == 0) {
      //No config strategy is associated. Associate all the strategy ids to the client id

      for (let i = 0; i < newStrategyIdsToAssociate.length; i++) {
        let rowValueToInsert = [oThis.clientId, newStrategyIdsToAssociate[i]];

        strategyIdsValues.push(rowValueToInsert);
      }

      await new ClientConfigStrategiesModel().insertMultiple(dbFields, strategyIdsValues).fire();
    } else {
      let strategyIdsAlreadyPresentInDB = [];

      for (let i = 0; i < clientStrategiesRspArray.length; i++) {
        strategyIdsAlreadyPresentInDB.push(clientStrategiesRspArray[i].config_strategy_id);

        //Removing strategy id from the array provided by user if that strategy id is already associated with that user.
        let index = newStrategyIdsToAssociate.indexOf(clientStrategiesRspArray[i].config_strategy_id);
        if (index >= 0) {
          newStrategyIdsToAssociate.splice(index, 1);
        }
      }
      console.log('Already present Ids in DB', strategyIdsAlreadyPresentInDB);
      console.log('New strategy Ids', newStrategyIdsToAssociate);

      let intendedConfigStrategyIds = strategyIdsAlreadyPresentInDB.concat(newStrategyIdsToAssociate),
        intendedConfigStrategyIdsDetails = await new ConfigStrategyModel().getByIds(intendedConfigStrategyIds);

      let finalHash = {},
        conflictHash = {};

      //Following loop is to check if there are any duplicate kind entries that are attempted to be inserted.
      for (let configStrategyId in intendedConfigStrategyIdsDetails) {
        let configStrategyKind = Object.keys(intendedConfigStrategyIdsDetails[configStrategyId])[0];
        console.log(configStrategyKind);

        if (finalHash[configStrategyKind] == undefined) {
          finalHash[configStrategyKind] = 1;
        } else {
          conflictHash[configStrategyKind] = 1;
        }
      }
      console.log('finalHash', finalHash);
      console.log('conflictHash', conflictHash);
      let conflictHashKeys = Object.keys(conflictHash);

      if (conflictHashKeys.length > 0) {
        throw 'Error: Attempt to insert already associated kinds: ';
      }

      /*
      for(let i = 0 ; i < newStrategyIdsToAssociate.length ; i++){
        let rowValueToInsert = [oThis.clientId,newStrategyIdsToAssociate[i]];

        strategyIdsValues.push(rowValueToInsert);
      }

      //console.log('New',newStrategyIdsToAssociate);
      await new ClientConfigStrategiesModel().insertMultiple(dbFields, strategyIdsValues).fire();
    */
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  _filter: function(dataArray, dataToRemoveArray) {
    let finalArray = [];
    for (let i = 0; i < dataArray.length; i++) {
      if (dataToRemoveArray.indexOf(dataArray[i]) < 0) {
        finalArray.push(dataArray[i]);
      }
    }

    return finalArray;
  }
};

module.exports = AssignStrategies;

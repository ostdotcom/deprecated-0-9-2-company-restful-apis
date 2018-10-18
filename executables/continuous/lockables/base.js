const rootPrefix = '../../..',
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * constructor
 *
 * @param {Integer} params - Process Id - This would be used as prefix in lockId.
 * @param {Integer} params - no_of_rows_to_process - Number of rows to process.
 *
 * @constructor
 */
const ContinuousLockableBaseKlass = function(params) {
  const oThis = this;

  oThis.processId = params.process_id;

  oThis.noOfRowsToProcess = params.no_of_rows_to_process;
  oThis.dataToUpdateMap = {};
};

ContinuousLockableBaseKlass.prototype = {
  dataToUpdateMap: null,

  /**
   * Perform Cron Operations
   *
   * @return {Promise<Result>} - On success, data.value has value. On failure, error details returned.
   */
  perform: async function() {
    const oThis = this;

    await oThis.acquireLock();

    await oThis.execute();

    await oThis.releaseLock();
  },

  /**
   * Acquire lock on rows to process in this execution.
   *
   * @return {Promise<Result>}
   */
  acquireLock: function() {
    const oThis = this;

    let modelKlass = oThis.getLockableModel(),
      query = oThis.getQuery();

    query[0] += ' AND lock_id = NULL';

    new modelKlass()
      .update(['lock_id = ?', oThis.getLockId()])
      .where(query)
      .limit(oThis.getNoOfRowsToProcess())
      .fire();
  },

  /**
   * Release lock acquired from rows.
   *
   * @return {Promise<Result>}
   */
  releaseLock: async function() {
    const oThis = this;

    if (Object.keys(oThis.dataToUpdateMap).length > 0) {
      // {row_id: {column: 'value'}}
      // Update Data accordingly
      console.log(oThis.dataToUpdateMap);
    } else {
      let modelKlass = oThis.getLockableModel();

      await new modelKlass()
        .update(['lock_id = ?', null])
        .where(['lock_id = ?', oThis.getLockId()])
        .fire();
    }
  },

  execute: function() {
    throw 'sub class to implement';
  },

  getLockId: function() {
    throw 'sub class to implement';
  },

  getLockableModel: function() {
    throw 'sub class to implement';
  },

  getQuery: function() {
    throw 'sub class to implement';
  },

  getNoOfRowsToProcess: function() {
    throw 'sub class to implement';
  }
};

InstanceComposer.registerShadowableClass(ContinuousLockableBaseKlass, 'getContinuousLockableBase');
module.exports = ContinuousLockableBaseKlass;

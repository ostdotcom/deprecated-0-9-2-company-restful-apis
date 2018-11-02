const rootPrefix = '../../..',
  commonUtils = require(rootPrefix + '/lib/validators/common'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * constructor
 *
 * @param {Integer} params - Process Id - This would be used as prefix in lockId.
 * @param {Integer} params - no_of_rows_to_process - Number of rows to process.
 * @param {Boolean} params - release_lock_required - Lock has to be released or not.
 *
 * @constructor
 */
const ContinuousLockableBaseKlass = function(params) {
  const oThis = this;

  oThis.processId = params.process_id;
  oThis.lockAcquired = false;

  oThis.noOfRowsToProcess = params.no_of_rows_to_process;
  if (commonUtils.isVarNull(params.release_lock_required)) {
    oThis.lockReleaseRequired = true;
  } else {
    oThis.lockReleaseRequired = params.release_lock_required;
  }
};

ContinuousLockableBaseKlass.prototype = {
  /**
   * Perform Cron Operations
   *
   * @return {Promise<Result>} - On success, data.value has value. On failure, error details returned.
   */
  perform: async function() {
    const oThis = this;

    oThis.lockAcquired = true;
    await oThis.acquireLock();
    oThis.lockAcquired = true;

    await oThis.execute();

    if (oThis.lockReleaseRequired) {
      await oThis.releaseLock();
    }
    oThis.lockAcquired = false;
  },

  /**
   * Acquire lock on rows to process in this execution.
   *
   * @return {Promise<Result>}
   */
  acquireLock: async function() {
    const oThis = this;

    let modelKlass = oThis.getModel();

    await new modelKlass().acquireLock(
      oThis.getLockId(),
      oThis.lockingConditions(),
      oThis.updateItems(),
      oThis.getNoOfRowsToProcess()
    );
  },

  /**
   * Release lock acquired from rows.
   *
   * @return {Promise<Result>}
   */
  releaseLock: async function() {
    const oThis = this;

    let modelKlass = oThis.getModel();

    await new modelKlass().releaseLock(oThis.getLockId(), oThis.lockingConditions(), oThis.updateItems());
  },

  execute: function() {
    throw 'sub class to implement';
  },

  /**
   * Sets the lockId for this particular process.
   */
  getLockId: function() {
    throw 'sub class to implement';
  },

  /**
   * Sets model to acquire lock on.
   */
  getModel: function() {
    throw 'sub class to implement';
  },

  /**
   * Conditions for acquiring lock, this would be used as where clause in locking.
   */
  lockingConditions: function() {
    throw 'sub class to implement';
  },

  /**
   * Items for atomic update during acquiring or releasing lock.
   */
  updateItems: function() {
    throw 'sub class to implement';
  }
};

InstanceComposer.registerShadowableClass(ContinuousLockableBaseKlass, 'getContinuousLockableBase');
module.exports = ContinuousLockableBaseKlass;

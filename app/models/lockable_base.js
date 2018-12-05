'use strict';

/**
 * Extend this in Model which needs to be lockable.
 *
 * @module app/models/lockable_base
 */

/**
 * constructor
 *
 * @constructor
 */
const LockableModelBaseKlass = function() {};

LockableModelBaseKlass.prototype = {
  /**
   * Acquire lock on rows to process in this execution.
   *
   * @return {Promise<Result>}
   */
  acquireLock: function(lockId, whereClause, updateOptions, rowsLimit) {
    const oThis = this;

    if (whereClause && whereClause.length > 0) {
      whereClause[0] += ' AND lock_id IS NULL';
    } else {
      whereClause = ['lock_id IS NULL'];
    }

    if (updateOptions && updateOptions.length > 0) {
      updateOptions[0] += ', lock_id = ?';
    } else {
      updateOptions = ['lock_id = ?'];
    }
    updateOptions.push(lockId);

    rowsLimit = rowsLimit || 100;

    return oThis
      .update(updateOptions)
      .where(whereClause)
      .limit(rowsLimit)
      .fire();
  },

  /**
   * Release lock acquired from rows.
   *
   * @return {Promise<Result>}
   */
  releaseLock: function(lockId, whereClause, updateOptions) {
    const oThis = this;

    if (updateOptions && updateOptions.length > 0) {
      updateOptions[0] += ', lock_id = NULL';
    } else {
      updateOptions = ['lock_id = NULL'];
    }

    if (whereClause && whereClause.length > 0) {
      whereClause[0] += ' AND lock_id = ?';
    } else {
      whereClause = ['lock_id = ?'];
    }
    whereClause.push(lockId);

    return oThis
      .update(updateOptions)
      .where(whereClause)
      .fire();
  }
};

module.exports = LockableModelBaseKlass;

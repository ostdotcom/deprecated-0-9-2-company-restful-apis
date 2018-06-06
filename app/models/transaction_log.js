"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , util = require(rootPrefix + '/lib/util')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
;

const dbName = "saas_transaction_" + coreConstants.SUB_ENVIRONMENT + "_" + coreConstants.ENVIRONMENT

  , statuses = {
    '1': transactionLogConst.processingStatus,
    '2': transactionLogConst.completeStatus,
    '3': transactionLogConst.failedStatus,
    '4': transactionLogConst.waitingForMiningStatus
  }
  , chainTypes = {
    '1': transactionLogConst.valueChainType,
    '2': transactionLogConst.utilityChainType
  }
  , transactionTypes = {
    '1': transactionLogConst.tokenTransferTransactionType,
    '2': transactionLogConst.stpTransferTransactionType,
    '3': transactionLogConst.extenralTokenTransferTransactionType
  }
  , invertedStatuses = util.invert(statuses)
  , invertedChainTypes = util.invert(chainTypes)
  , invertedTransactionTypes = util.invert(transactionTypes)

;

const TransactionLogKlass = function () {
  ModelBaseKlass.call(this, {dbName: dbName});
};

TransactionLogKlass.prototype = Object.create(ModelBaseKlass.prototype);

const TransactionLogKlassPrototype = {

  tableName: 'transaction_logs',

  statuses: statuses,

  invertedStatuses: invertedStatuses,

  chainTypes: chainTypes,

  invertedChainTypes: invertedChainTypes,

  transactionTypes: transactionTypes,

  invertedTransactionTypes: invertedTransactionTypes,

  enums: {
    'status': {
      val: statuses,
      inverted: invertedStatuses
    },
    'chain_type': {
      val: chainTypes,
      inverted: invertedChainTypes
    },
    'transaction_type': {
      val: transactionTypes,
      inverted: invertedTransactionTypes
    }
  },

  /**
   * Insert One record in DB
   *
   * @param {Object} data - hash containing data for a row which is to be inserted
   *
   * @return {promise<object>}
   */
  insertRecord: function(data){

    const oThis = this;

    data = oThis._shortenDataForInsert(data);

    return oThis.insert(data).fire();

  },

  /**
   * Update One record in DB
   *
   * @param {number} - id to be updated
   * @param {Object} dataToUpdate - hash containing data for a row which is to be inserted
   *
   * @return {promise<object>}
   */
  updateRecord: async function (idToUpdate, dataToUpdate) {

    const oThis = this;

    var dataCopy = util.clone(dataToUpdate);

    if (dataCopy.input_params) {
      dataCopy.input_params = oThis._shortenInputParams(dataCopy.input_params);
      dataCopy.input_params = JSON.stringify(dataCopy.input_params);
    }

    if (dataCopy.formatted_receipt) {
      dataCopy.formatted_receipt = oThis._shortenFormattedReceipt(dataCopy.formatted_receipt);
      dataCopy.formatted_receipt = JSON.stringify(dataCopy.formatted_receipt);
    }

    return oThis.update(dataCopy).where({id: idToUpdate}).fire();

  },

  /**
   *
   * @param [Array] uuids - Array of Transaction uuids
   * @return {Promise<>}
   */
  getByTransactionUuid: async function (uuids) {
    const oThis = this;
    const dbRecords = await oThis.select('*').where(['transaction_uuid IN (?)', uuids]).fire();
    return oThis._formatDbRecords(dbRecords);
  },

  /**
   *
   * @param transaction_hashes - Array of Transaction hash
   * @return {Promise<>}
   */
  getByTransactionHash: async function (transaction_hashes) {
    const oThis = this;
    const dbRecords = await oThis.select(['id', 'transaction_hash', 'transaction_uuid', 'process_uuid', 'status', 'input_params', 'transaction_type']).
              where(['transaction_hash IN (?)', transaction_hashes]).fire();
    return oThis._formatDbRecords(dbRecords);
  },

  /**
   *
   * @param transaction_hashes - Array of Transaction hash
   * @return {Promise<>}
   */
  getAllColumnsByTransactionHash: async function (transaction_hashes) {
    const oThis = this;
    const dbRecords = await oThis.select('*').where(['transaction_hash IN (?)', transaction_hashes]).fire();
    return oThis._formatDbRecords(dbRecords);
  },

  /**
   *
   * @return {Promise<>}
   */
  getByRange: async function (startId, endId, pageLimit, offset) {
    const oThis = this;
    const dbRecords = await oThis.select('*').where(['id >= ? AND id <= ?', startId, endId]).limit(pageLimit).offset(offset).fire();
    return oThis._formatDbRecords(dbRecords);
  },

  /**
   * @param ids - Array of Ids
   * @return {Promise<>}
   */
  getById: async function (ids) {
    const oThis = this;
    const dbRecords = await oThis.select('*').
              where(['id IN (?)', ids]).fire();
    return oThis._formatDbRecords(dbRecords);
  },

  /**
   * @param clientId - client id
   * @param kind - kind
   * @param paginationParams - pagination params
   * @param filters - filters
   *
   * @return {promise}
   */
  getList: async function (clientId, kind, paginationParams, filters, options) {
    const oThis = this
    ;

    // following is to support both string and int values for kind
    if (!(kind > 0)) {
      kind = oThis.invertedTransactionTypes[kind]
    }

    let limit = paginationParams.limit
      , offset = paginationParams.offset
      , orderBy = paginationParams.orderBy
      , order = paginationParams.order
    ;

    let query = oThis.select('*').where(['client_id = ? AND transaction_type = ?', clientId, kind])
      .limit(limit).offset(offset).order_by(`${orderBy} ${order}`);

    if(filters.id && filters.id.length > 0) {
      query.where(['transaction_uuid IN (?)', filters.id]);
    }

    const dbRecords = await query.fire();

    return oThis._formatDbRecords(dbRecords);
  },

  /**
   * Handles logic of shortening Data that goes in db
   *
   * @private
   * @param data - data which needs to be shortened
   * @return {Object}
   */
  _shortenDataForInsert: function (data) {

    const oThis = this;

    var dataCopy = util.clone(data);

    if (!dataCopy.input_params) {
      dataCopy.input_params = '{}';
    } else {
      dataCopy.input_params = oThis._shortenInputParams(dataCopy.input_params);
      dataCopy.input_params = JSON.stringify(dataCopy.input_params);
    }

    if (!dataCopy.formatted_receipt) {
      dataCopy.formatted_receipt = '{}';
    } else {
      dataCopy.formatted_receipt = oThis._shortenFormattedReceipt(dataCopy.formatted_receipt);
      dataCopy.formatted_receipt = JSON.stringify(dataCopy.formatted_receipt);
    }

    return dataCopy;

  },

  /**
   * Handles logic of formatting Db Data
   *
   * @private
   * @param dbRecords - Array of dbRecords
   * @return {Promise<>}
   */
  _formatDbRecords: function (dbRecords) {

    const oThis = this;

    var fDbRecords = []
        , dbRecord = null;

    for(var i=0; i<dbRecords.length; i++) {

      dbRecord = dbRecords[i];

      if (dbRecord.input_params) {
        dbRecord.input_params = JSON.parse(dbRecord.input_params);
        dbRecord.input_params = oThis._elongateInputParams(dbRecord.input_params);
      } else {
        dbRecord.input_params = {};
      }

      if (dbRecord.formatted_receipt) {
        dbRecord.formatted_receipt = JSON.parse(dbRecord.formatted_receipt);
        dbRecord.formatted_receipt = oThis._elongateFormattedReceipt(dbRecord.formatted_receipt);
      } else {
        dbRecord.formatted_receipt = {};
      }

      fDbRecords.push(dbRecord);

    }

    return Promise.resolve(fDbRecords);

  },

  /**
   * Handles logic of shorting input param keys
   *
   * @private
   * @param elongatedInputParams - Hash with keys which need to be shortened
   * @return {Object}
   */
  _shortenInputParams: function (elongatedInputParams) {
    let shortenedInputParams = {};
    shortenedInputParams.fu = elongatedInputParams.from_uuid;
    shortenedInputParams.tu = elongatedInputParams.to_uuid;
    shortenedInputParams.tk = elongatedInputParams.transaction_kind;
    shortenedInputParams.tki = elongatedInputParams.transaction_kind_id;
    shortenedInputParams.ts = elongatedInputParams.token_symbol;
    shortenedInputParams.prpp = elongatedInputParams.postReceiptProcessParams;
    shortenedInputParams.cp = elongatedInputParams.commission_percent;
    shortenedInputParams.a = elongatedInputParams.amount;
    shortenedInputParams.aiw = elongatedInputParams.amount_in_wei;
    shortenedInputParams.ta = elongatedInputParams.to_address;
    shortenedInputParams.fa = elongatedInputParams.from_address;
    return shortenedInputParams;
  },

  /**
   * Handles logic of elongating input param keys
   *
   * @private
   * @param shortInputParams - Hash with keys which need to be elongated
   * @return {Object}
   */
  _elongateInputParams: function (shortInputParams) {
    let elongatedInputParams = {};
    // TODO: After migrating remove support for long keys
    elongatedInputParams.from_uuid = shortInputParams.from_uuid || shortInputParams.fu;
    elongatedInputParams.to_uuid = shortInputParams.to_uuid || shortInputParams.tu;
    elongatedInputParams.transaction_kind = shortInputParams.transaction_kind || shortInputParams.tk;
    elongatedInputParams.transaction_kind_id = shortInputParams.transaction_kind_id || shortInputParams.tki;
    elongatedInputParams.token_symbol = shortInputParams.token_symbol || shortInputParams.ts;
    elongatedInputParams.postReceiptProcessParams = shortInputParams.prpp;
    elongatedInputParams.commission_percent = shortInputParams.cp;
    elongatedInputParams.amount = shortInputParams.a;
    elongatedInputParams.amount_in_wei = shortInputParams.aiw;
    elongatedInputParams.to_address = shortInputParams.ta;
    elongatedInputParams.from_address = shortInputParams.fa;
    return elongatedInputParams;
  },

  /**
   * Handles logic of shorting formatted receipt keys
   *
   * @private
   * @param elongatedFormattedReceipt - Hash with keys which need to be shortened
   * @return {Object}
   */
  _shortenFormattedReceipt: function (elongatedFormattedReceipt) {
    var shortenedFormattedReceipt = {};
    shortenedFormattedReceipt.caiw = elongatedFormattedReceipt.commission_amount_in_wei;
    shortenedFormattedReceipt.btiw = elongatedFormattedReceipt.bt_transfer_in_wei;
    // error related data. this is temp as would move out to error_code later.
    shortenedFormattedReceipt.e_c = elongatedFormattedReceipt.code;
    shortenedFormattedReceipt.e_m = elongatedFormattedReceipt.msg;
    return shortenedFormattedReceipt;
  },

  /**
   * Handles logic of elongating formatted receipt keys
   *
   * @private
   * @param shortFormattedReceipt - Hash with keys which need to be elongated
   * @return {Object}
   */
  _elongateFormattedReceipt: function (shortFormattedReceipt) {
    var elongatedFormattedReceipt = {};
    elongatedFormattedReceipt.commission_amount_in_wei = shortFormattedReceipt.commission_amount_in_wei || shortFormattedReceipt.caiw;
    elongatedFormattedReceipt.bt_transfer_in_wei = shortFormattedReceipt.bt_transfer_in_wei || shortFormattedReceipt.btiw;
    elongatedFormattedReceipt.code = shortFormattedReceipt.code || shortFormattedReceipt.e_c;
    elongatedFormattedReceipt.msg = shortFormattedReceipt.msg || shortFormattedReceipt.e_m;
    return elongatedFormattedReceipt;
  }

};

Object.assign(TransactionLogKlass.prototype, TransactionLogKlassPrototype);

module.exports = TransactionLogKlass;